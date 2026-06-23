import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/index.ts"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const firebaseProjectId = "foodorder-61363"
const firebaseClientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')
const firebasePrivateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n')

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  }

  try {
    // Check if Firebase credentials are set
    if (!firebaseClientEmail || !firebasePrivateKey) {
      console.error('Firebase credentials not set')
      console.error('Client email exists:', !!firebaseClientEmail)
      console.error('Private key exists:', !!firebasePrivateKey)
      return new Response(
        JSON.stringify({ error: 'Firebase credentials not configured' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    console.log('Firebase credentials loaded')
    console.log('Client email:', firebaseClientEmail)
    console.log('Private key length:', firebasePrivateKey.length)
    console.log('Private key (first 100 chars):', firebasePrivateKey.substring(0, 100))

    // This function is called by a webhook or trigger
    // For now, we'll use it as a manual trigger or via pg_net

    const { notificationId } = await req.json()

    if (!notificationId) {
      return new Response(
        JSON.stringify({ error: 'Missing notificationId' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    // Fetch the notification
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single()

    if (fetchError || !notification) {
      console.error('Error fetching notification:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Notification not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    // Fetch user's FCM tokens
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint')
      .eq('user_id', notification.user_id)

    if (subError) {
      console.error('Error fetching push subscriptions:', subError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', notification.user_id)
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    // Send push notification with translated content
    const fcmTokens = subscriptions.map(sub => sub.endpoint)
    const accessToken = await getAccessToken()

    // Get translated notification content
    const { title, body } = getTranslatedNotification(notification)

    const results = await sendFCMV1Notification(
      fcmTokens,
      accessToken,
      title,
      body,
      notification.data
    )

    return new Response(
      JSON.stringify({
        success: true,
        results,
        tokensSent: fcmTokens.length
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('Error in notification-push-handler:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})

async function sendFCMV1Notification(tokens: string[], accessToken: string, title: string, body?: string, data?: any) {
  const results = []
  const invalidTokens: string[] = []

  // Convert all data values to strings (FCM requirement)
  const stringData: Record<string, string> = {}
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = String(value)
    }
  }

  for (const token of tokens) {
    try {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: {
                title,
                body: body || ''
              },
              data: stringData,
              webpush: {
                fcm_options: {
                  link: '/'
                }
              }
            }
          })
        }
      )

      const result = await response.json()
      const success = response.ok

      // Check if token is invalid (NotRegistered error or Unregistered)
      if (!success) {
        const errorCode = result.error?.code
        const errorMessage = result.error?.message || result.error
        
        if (errorCode === 404 || errorMessage?.includes('UNREGISTERED') || errorMessage?.includes('Device unregistered')) {
          console.log('Invalid token detected, marking for cleanup:', token, 'Error:', errorMessage)
          invalidTokens.push(token)
        } else {
          console.log('Failed to send notification to token:', token, 'Error:', errorMessage)
        }
      }

      results.push({ token, success, result })
    } catch (error) {
      console.error('Error sending to token:', token, error)
      results.push({ token, success: false, error: error.message })
    }
  }

  return results
}

async function cleanupInvalidTokens(tokens: string[]) {
  try {
    console.log('Cleaning up invalid tokens:', tokens.length, 'tokens:', tokens)
    const { error, count } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', tokens)
      .select()

    if (error) {
      console.error('Error cleaning up invalid tokens:', error)
    } else {
      console.log('Successfully cleaned up invalid tokens. Deleted count:', count)
    }
  } catch (error) {
    console.error('Error in cleanupInvalidTokens:', error)
  }
}

function getTranslatedNotification(notification: any) {
  const data = notification.data || {}
  const orderTitle = data.order_title || data.order_id || notification.title
  const itemName = data.item_name

  // Arabic translations (mirroring the frontend copy)
  const arabicCopy = {
    unknown: 'غير معروف',
    notificationOrderCreated: 'تم إنشاء طلب جديد: {orderTitle}',
    notificationOrderCreatedBody: 'تم إنشاء طلب جديد',
    notificationOrderUpdated: 'تم تحديث الطلب: {orderTitle}',
    notificationItemAdded: 'تم إضافة عنصر جديد: {itemName}',
    notificationItemStatusChanged: 'تم تغيير حالة العنصر {itemName} إلى {status}',
    notificationItemDeleted: 'تم حذف العنصر {itemName}',
    notificationStatusChanged: 'تم تغيير حالة الطلب إلى {status}',
    notificationOrderStatusUpdate: 'تم تحديث حالة الطلب: {orderTitle}',
    notificationOrderStatusUpdateBody: 'حالة الطلب {orderTitle} أصبحت {status}',
    notificationDeliveryRequestCreated: 'تم إنشاء طلب تسليم جديد',
    notificationDeliveryRequestCreatedBody: 'أرسل {requesterName} ({requesterEmail}) طلب تسليم إليك',
    notificationDeliveryRequestCreatedBodyFallback: 'أرسل عميل طلب تسليم إليك',
    notificationDeliveryRequestAccepted: 'تم قبول طلب التسليم',
    notificationDeliveryRequestAcceptedBody: 'تم قبول طلب التسليم الخاص بك من قبل {requesterName} ({requesterEmail})',
    notificationDeliveryRequestAcceptedBodyFallback: 'تم قبول طلب التسليم الخاص بك',
    notificationDeliveryRequestRejected: 'تم رفض طلب التسليم',
    notificationDeliveryRequestRejectedBody: 'تم رفض طلب التسليم الخاص بك من قبل {requesterName} ({requesterEmail})',
    notificationDeliveryRequestRejectedBodyFallback: 'تم رفض طلب التسليم الخاص بك',
  }

  // Arabic status translations
  const arabicStatusTranslations: Record<string, string> = {
    'pending': 'قيد الانتظار',
    'accepted': 'مقبول',
    'preparing': 'جار التحضير',
    'on_the_way': 'في الطريق',
    'on the way': 'في الطريق',
    'rejected': 'مرفوض',
    'in_progress': 'قيد التنفيذ',
    'completed': 'مكتمل',
    'cancelled': 'ملغي',
    'canceled': 'ملغي',
    'collected': 'تم الجمع',
    'delivered': 'تم التوصيل',
    'ready': 'جاهز',
  }

  const translatedStatus = arabicStatusTranslations[data.status] || data.status
  const requesterName = data.requester_name || arabicCopy.unknown
  const requesterEmail = data.requester_email || ''

  let title = notification.title
  let body = notification.body

  // Apply Arabic translations based on notification type
  switch (notification.type) {
    case 'order_created':
      title = arabicCopy.notificationOrderCreated?.replace('{orderTitle}', orderTitle) || notification.title
      body = arabicCopy.notificationOrderCreatedBody || notification.body
      break
    case 'item_added':
      title = arabicCopy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title
      body = arabicCopy.notificationItemAdded?.replace('{itemName}', itemName) || notification.body
      break
    case 'item_update':
      title = arabicCopy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title
      body = arabicCopy.notificationItemStatusChanged?.replace('{itemName}', itemName).replace('{status}', translatedStatus) || notification.body
      break
    case 'item_deleted':
      title = arabicCopy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title
      body = arabicCopy.notificationItemDeleted?.replace('{itemName}', itemName) || notification.body
      break
    case 'order_update':
    case 'order_status_update':
      title = arabicCopy.notificationOrderStatusUpdate?.replace('{orderTitle}', orderTitle) || notification.title
      body = arabicCopy.notificationOrderStatusUpdateBody?.replace('{orderTitle}', orderTitle).replace('{status}', translatedStatus) || notification.body
      break
    case 'delivery_request_created':
      title = arabicCopy.notificationDeliveryRequestCreated || notification.title
      if (requesterEmail) {
        body = arabicCopy.notificationDeliveryRequestCreatedBody
          ?.replace(/\{requesterName\}/g, requesterName)
          ?.replace(/\{requesterEmail\}/g, requesterEmail) || notification.body
      } else {
        body = arabicCopy.notificationDeliveryRequestCreatedBodyFallback || notification.body
      }
      break
    case 'delivery_request_accepted':
      title = arabicCopy.notificationDeliveryRequestAccepted || notification.title
      if (requesterEmail) {
        body = arabicCopy.notificationDeliveryRequestAcceptedBody
          ?.replace(/\{requesterName\}/g, requesterName)
          ?.replace(/\{requesterEmail\}/g, requesterEmail) || notification.body
      } else {
        body = arabicCopy.notificationDeliveryRequestAcceptedBodyFallback || notification.body
      }
      break
    case 'delivery_request_rejected':
      title = arabicCopy.notificationDeliveryRequestRejected || notification.title
      if (requesterEmail) {
        body = arabicCopy.notificationDeliveryRequestRejectedBody
          ?.replace(/\{requesterName\}/g, requesterName)
          ?.replace(/\{requesterEmail\}/g, requesterEmail) || notification.body
      } else {
        body = arabicCopy.notificationDeliveryRequestRejectedBodyFallback || notification.body
      }
      break
    default:
      // Keep original title/body for unknown types
      break
  }

  return { title, body }
}

async function getAccessToken(): Promise<string> {
  try {
    const jwt = await generateJWT()
    console.log('Generated JWT (first 50 chars):', jwt.substring(0, 50) + '...')

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OAuth token request failed:', response.status, errorText)
      throw new Error(`OAuth token request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Access token received successfully')
    return data.access_token
  } catch (error) {
    console.error('Error getting access token:', error)
    throw error
  }
}

async function generateJWT(): Promise<string> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: firebaseClientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    }

    console.log('JWT Payload:', { iss: payload.iss, scope: payload.scope })
    console.log('Firebase Client Email:', firebaseClientEmail)

    // Use jose library for proper JWT signing
    const key = await crypto.subtle.importKey(
      'pkcs8',
      base64ToUint8Array(firebasePrivateKey),
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    )

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key)

    console.log('Generated JWT (first 50 chars):', jwt.substring(0, 50))
    console.log('Full JWT length:', jwt.length)

    return jwt
  } catch (error) {
    console.error('Error generating JWT:', error)
    throw error
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Remove PEM headers if present
  let cleanBase64 = base64
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const rsaHeader = '-----BEGIN RSA PRIVATE KEY-----'
  const rsaFooter = '-----END RSA PRIVATE KEY-----'

  if (cleanBase64.includes(pemHeader)) {
    cleanBase64 = cleanBase64.replace(pemHeader, '').replace(pemFooter, '')
  } else if (cleanBase64.includes(rsaHeader)) {
    cleanBase64 = cleanBase64.replace(rsaHeader, '').replace(rsaFooter, '')
  }

  // Remove all whitespace
  cleanBase64 = cleanBase64.replace(/\s/g, '')

  const binaryString = atob(cleanBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}
