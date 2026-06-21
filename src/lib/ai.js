import { supabase } from './supabase';

const AI_SERVER_URL = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:3002';

export async function parseOrderWithAI(text, user, language) {
  try {
    // Get the current session to get the access token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('AI_SERVICE_UNAUTHORIZED');
    }

    const accessToken = session.access_token;

    const res = await fetch(`${AI_SERVER_URL}/parse-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        text,
        customer_id: user.id,
        language
      }),
    });

    if (!res.ok) {
      if (res.status === 500) {
        throw new Error('AI_SERVICE_ERROR_500');
      } else if (res.status === 404) {
        throw new Error('AI_SERVICE_NOT_FOUND');
      } else if (res.status === 400) {
        throw new Error('AI_SERVICE_BAD_REQUEST');
      } else if (res.status === 401) {
        throw new Error('AI_SERVICE_UNAUTHORIZED');
      } else if (res.status === 429) {
        const data = await res.json();
        const retryAfter = data.retryAfter || 60;
        throw new Error(`AI_SERVICE_RATE_LIMIT|${retryAfter}`);
      } else {
        throw new Error(`AI_SERVICE_ERROR_${res.status}`);
      }
    }

    const data = await res.json();
    
    // Validate response structure
    if (!data || !data.items) {
      throw new Error('AI_INVALID_RESPONSE');
    }

    return data;
  } catch (error) {
    // If it's already a custom error, rethrow it
    if (error.message.startsWith('AI_')) {
      throw error;
    }
    // Network errors
    throw new Error('AI_NETWORK_ERROR');
  }
}
