import { useEffect } from 'react';
import { supabase } from './supabase';

// This hook listens to the notifications table and sends push notifications
// when new notifications are created by PostgreSQL triggers
export function usePushNotificationTrigger() {
  useEffect(() => {
    // Track processed notifications to prevent duplicates
    const processedNotifications = new Set();

    const channel = supabase
      .channel('notification-push-trigger')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        async (payload) => {
          const notificationId = payload.new.id;

          // Skip if already processing this notification
          if (processedNotifications.has(notificationId)) {
            console.log('Notification already being processed:', notificationId);
            return;
          }

          processedNotifications.add(notificationId);
          console.log('New notification created:', payload);

          try {
            // Get the current session using Supabase v2 API
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
              console.error('Error getting session or no active session:', sessionError);
              processedNotifications.delete(notificationId);
              return;
            }

            // Get the current valid FCM token from localStorage to ensure we're using the latest
            const currentToken = localStorage.getItem('fcm_token');
            const currentUserId = localStorage.getItem('fcm_user_id');

            if (!currentToken || currentUserId !== session.user.id) {
              console.log('No valid FCM token found for current user, skipping notification');
              processedNotifications.delete(notificationId);
              return;
            }

            // Add a small delay to allow token to be saved if this is a fresh login
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get user's language preference
            const userLanguage = localStorage.getItem('preferredLanguage') || 'en';

            // Call the Edge Function to send push notification
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL?.replace('/rest/v1', '')}/functions/v1/notification-push-handler`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  notificationId: payload.new.id,
                  currentToken: currentToken, // Pass current token for validation
                  language: userLanguage // Pass user's language preference
                })
              }
            );

            const result = await response.json();
            console.log('Push notification sent:', result);

            // If no subscriptions found, retry once after another delay
            if (result.message === 'No subscriptions found') {
              console.log('No subscriptions found on first attempt, retrying in 2 seconds...');
              await new Promise(resolve => setTimeout(resolve, 2000));

              // Get fresh token before retry
              const retryToken = localStorage.getItem('fcm_token');

              const retryResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL?.replace('/rest/v1', '')}/functions/v1/notification-push-handler`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                  },
                  body: JSON.stringify({
                    notificationId: payload.new.id,
                    currentToken: retryToken,
                    language: userLanguage // Pass user's language preference
                  })
                }
              );

              const retryResult = await retryResponse.json();
              console.log('Push notification retry result:', retryResult);
            }
          } catch (error) {
            console.error('Error sending push notification:', error);
          } finally {
            // Remove from processed set after completion
            setTimeout(() => {
              processedNotifications.delete(notificationId);
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
