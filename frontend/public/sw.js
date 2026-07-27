/* ChristNerve SW — FCM push + home-screen badge. No fetch hijacking (safe with Vite). */

importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js'
);

firebase.initializeApp({
  apiKey: 'AIzaSyDDtHNaNdzhYyOFk4YAvrffFGfpFxos1mo',
  authDomain: 'christnerve.firebaseapp.com',
  projectId: 'christnerve',
  storageBucket: 'christnerve.firebasestorage.app',
  messagingSenderId: '938119540958',
  appId: '1:938119540958:web:50008e821727463fe9524f',
  measurementId: 'G-JB18M3CW3V',
});

async function applyBadge(raw) {
  const n = Math.max(0, parseInt(String(raw || ''), 10) || 0);
  try {
    if (n <= 0 && self.navigator && self.navigator.clearAppBadge) {
      await self.navigator.clearAppBadge();
      return;
    }
    if (self.navigator && self.navigator.setAppBadge) {
      await self.navigator.setAppBadge(n > 0 ? n : undefined);
    }
  } catch (_) {
    // Badging API not available in this SW context
  }
}

firebase.messaging().onBackgroundMessage(async (payload) => {
  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    'ChristNerve';
  const body =
    (payload.notification && payload.notification.body) ||
    (payload.data && payload.data.body) ||
    '';
  const link =
    (payload.data && (payload.data.link || payload.data.url)) || '/';
  const badgeCount =
    payload.data && payload.data.badge != null ? payload.data.badge : null;

  try {
    if (badgeCount != null) await applyBadge(badgeCount);
  } catch (_) {
    // ignore
  }

  await self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'christnerve',
    renotify: true,
    data: { link, url: link, badge: badgeCount, ...(payload.data || {}) },
  });
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Intentionally no fetch listener — leave all network traffic to the browser/Vite.

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link =
    (event.notification.data &&
      (event.notification.data.link || event.notification.data.url)) ||
    '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            try {
              client.navigate(link);
            } catch {
              // ignore
            }
            client.postMessage({ type: 'notification-click', link });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(link);
        }
        return undefined;
      })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'set-badge') {
    event.waitUntil(applyBadge(data.count));
  }
  if (data.type === 'clear-badge') {
    event.waitUntil(applyBadge(0));
  }
});
