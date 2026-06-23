import { supabase } from './supabase';

// Get Edge Function URL from environment or use default
const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL 
  ? `${import.meta.env.VITE_SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/send-push-notification`
  : '/functions/v1/send-push-notification';

export async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
      },
      body: JSON.stringify({
        userId,
        title,
        body,
        data
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Push notification failed:', result);
      return { success: false, error: result };
    }

    console.log('Push notification sent:', result);
    return { success: true, result };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}
