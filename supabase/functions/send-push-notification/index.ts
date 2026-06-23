import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const firebaseProjectId = "foodorder-61363"
const firebaseClientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const firebasePrivateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n')

serve(async (req) => {
  try {
    const { userId, title, body, data } = await req.json()

    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch user's FCM tokens
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('endpoint')
      .eq('user_id', userId)

    if (fetchError) {
      console.error('Error fetching push subscriptions:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', userId)
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Send push notification using FCM V1 API
    const fcmTokens = subscriptions.map(sub => sub.endpoint)
    const accessToken = await getAccessToken()
    const results = await sendFCMV1Notification(fcmTokens, accessToken, title, body, data)

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        tokensSent: fcmTokens.length 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-push-notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function sendFCMV1Notification(tokens: string[], accessToken: string, title: string, body?: string, data?: any) {
  const results = []

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
              data: data || {},
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
      results.push({ token, success: response.ok, result })
    } catch (error) {
      console.error('Error sending to token:', token, error)
      results.push({ token, success: false, error: error.message })
    }
  }

  return results
}

async function getAccessToken(): Promise<string> {
  const jwt = await generateJWT()
  
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

  const data = await response.json()
  return data.access_token
}

async function generateJWT(): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: firebaseClientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))

  // Sign the JWT using Web Crypto API
  const keyData = await importKey(firebasePrivateKey)
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, keyData)
  const encodedSignature = base64UrlEncode(signature)

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function importKey(privateKey: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = privateKey.substring(pemHeader.length, privateKey.length - pemFooter.length)
  const binaryDerString = atob(pemContents.replace(/\s/g, ''))
  const binaryDer = new Uint8Array(binaryDerString.length)
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i)
  }

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  )
}

async function sign(data: string, key: CryptoKey): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(data)
  )
  return signature
}
