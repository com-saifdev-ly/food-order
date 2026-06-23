import { useEffect } from 'react';
import { supabase } from './supabase';
import { messaging, getToken, onMessage, deleteToken } from './firebase';

export function usePushNotifications(userId) {
  useEffect(() => {
    if (!userId) return;

    let messageUnsubscribe;
    let tokenRefreshUnsubscribe;

    // Request notification permission and subscribe to FCM
    async function subscribeToFCM() {
      if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return;
      }

      try {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission denied');
          return;
        }

        // Get existing service worker registration or register new one
        const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') ||
                            await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered');

        // Wait for service worker to be active
        if (registration.installing) {
          console.log('Service worker installing, waiting for activation...');
          await new Promise(resolve => {
            registration.installing.addEventListener('statechange', (e) => {
              if (e.target.state === 'activated') {
                console.log('Service worker activated');
                resolve();
              }
            });
          });
        } else if (!registration.active) {
          console.log('Waiting for service worker to become active...');
          await new Promise(resolve => {
            if (registration.active) {
              resolve();
            } else {
              registration.addEventListener('controllerchange', resolve);
              setTimeout(resolve, 2000); // Fallback timeout
            }
          });
        }

        // Check if we have a cached token
        const cachedToken = localStorage.getItem('fcm_token');
        const cachedUserId = localStorage.getItem('fcm_user_id');

        // Always get a fresh token to ensure we have a valid one
        // This prevents using expired/unregistered tokens
        const token = await getToken(messaging, {
          serviceWorkerRegistration: registration,
          vapidKey: 'BJXMZIoeC9Y6ojFwigQSch3DCNjQS3PVuIdCeKBUqRp5CnMuW8nl1FAn324l7oZpI8pL5H4yoMZ3IyXym7YuuuU'
        });

        if (token) {
          console.log('FCM Token obtained:', token.substring(0, 20) + '...');
          // Cache the token
          localStorage.setItem('fcm_token', token);
          localStorage.setItem('fcm_user_id', userId);
          // Save token and wait for it to complete before proceeding
          await saveFCMTokenToDatabase(userId, token);
          console.log('FCM token saved and ready for notifications');
        }

        // Handle incoming messages when app is in foreground
        messageUnsubscribe = onMessage(messaging, (payload) => {
          console.log('Foreground message received:', payload);
          const notificationTitle = payload.notification?.title || 'New Notification';
          const notificationOptions = {
            body: payload.notification?.body,
            icon: '/assets/logo.png',
          };

          if (Notification.permission === 'granted') {
            new Notification(notificationTitle, notificationOptions);
          }
        });

        // Handle token refresh (Firebase v9 uses a different approach)
        // We'll check periodically if the token needs refresh
        const tokenRefreshInterval = setInterval(async () => {
          try {
            const currentToken = await getToken(messaging, {
              serviceWorkerRegistration: registration,
              vapidKey: 'BJXMZIoeC9Y6ojFwigQSch3DCNjQS3PVuIdCeKBUqRp5CnMuW8nl1FAn324l7oZpI8pL5H4yoMZ3IyXym7YuuuU'
            });

            const cachedToken = localStorage.getItem('fcm_token');

            // If token changed, update cache and database
            if (currentToken && currentToken !== cachedToken) {
              console.log('FCM token changed - updating:', currentToken.substring(0, 20) + '...');
              localStorage.setItem('fcm_token', currentToken);
              localStorage.setItem('fcm_user_id', userId);
              await saveFCMTokenToDatabase(userId, currentToken);
            } else {
              console.log('FCM token check: no change needed');
            }
          } catch (error) {
            console.error('Error checking token refresh:', error);
          }
        }, 600000); // Check every 10 minutes to reduce frequent refreshes

        // Cleanup function
        return () => {
          clearInterval(tokenRefreshInterval);
          if (messageUnsubscribe) {
            messageUnsubscribe();
          }
        };
      } catch (error) {
        console.error('FCM subscription failed:', error);
      }
    }

    subscribeToFCM();

    // Cleanup on unmount
    return () => {
      if (messageUnsubscribe) {
        messageUnsubscribe();
      }
    };
  }, [userId]);
}

// Save FCM token to Supabase
async function saveFCMTokenToDatabase(userId, token) {
  try {
    console.log('saveFCMTokenToDatabase called for user:', userId, 'token:', token.substring(0, 20) + '...');

    // Check if this token already exists for this user
    const { data: existing, error: checkError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint')
      .eq('user_id', userId)
      .eq('endpoint', token)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing token:', checkError);
    }

    // If token already exists, no need to do anything
    if (existing) {
      console.log('FCM token already exists in database, no changes needed');
      return;
    }

    console.log('Token does not exist in database, removing old tokens and inserting new one');

    // Remove all old tokens for this user to prevent accumulation of invalid tokens
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error removing old FCM tokens:', deleteError);
    } else {
      console.log('Old tokens removed successfully');
    }

    // Insert the new token
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint: token,
        subscription_data: { fcm_token: token }
      });

    if (error) {
      console.error('Error saving FCM token:', error);
    } else {
      console.log('FCM token saved to database successfully');
    }
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
}
