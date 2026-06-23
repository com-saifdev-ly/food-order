importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyB637Rv3CiVztMlfkOi-V13x3suI6icNqE",
  authDomain: "foodorder-1582a.firebaseapp.com",
  projectId: "foodorder-1582a",
  storageBucket: "foodorder-1582a.firebasestorage.app",
  messagingSenderId: "1014434869899",
  appId: "1:1014434869899:web:86db336797a236bddfda8e",
  measurementId: "G-SPG7TJZ994"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Food Order';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
