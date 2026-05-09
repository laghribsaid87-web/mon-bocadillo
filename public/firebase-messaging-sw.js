importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAE5KH9KkeN22zCvv6Jx_BBBg3JJv-eaZA",
  authDomain: "mon-bocadillo-menu.firebaseapp.com",
  projectId: "mon-bocadillo-menu",
  storageBucket: "mon-bocadillo-menu.firebasestorage.app",
  messagingSenderId: "555581310485",
  appId: "1:555581310485:web:a754eb9fcfb9a02c45b01c"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // 1. Préparer les données de la notification
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Nouvelle Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Vous avez reçu un nouveau message.',
    icon: '/favicon.svg',
    data: payload.data || payload.notification // Pour récupérer les infos au clic
  };

  // 2. Si c'est un message de données pur (sans payload.notification), FCM ne l'affiche pas tout seul, donc on force l'affichage :
  if (!payload.notification) {
    self.registration.showNotification(notificationTitle, notificationOptions);
  }

  // Send message to all client windows to play sound even if minimized
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'FCM_MESSAGE', payload: payload });
    });
  });
});

// --- Action quand l'utilisateur clique sur la notification ---
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification cliquée.', event);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si l'application est déjà ouverte, on la met au premier plan
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon on ouvre une nouvelle fenêtre avec l'app
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// --- PWA Cache Logic (Merged from sw.js to avoid conflicts) ---
const CACHE_NAME = 'mon-bocadillo-cache-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore.googleapis.com')) return;
  // Bypass Vite dev server requests (HMR, .jsx files, etc.) to prevent 500 errors
  if (event.request.url.includes('/src/') || event.request.url.includes('/node_modules/') || event.request.url.includes('.jsx') || event.request.url.includes('/@vite/') || event.request.url.includes('/@fs/') || event.request.url.includes('?t=')) return;
  if (event.request.url.includes('mixkit.co')) return;

  // 1. Pages HTML w Navigation (Network First bach dima yjib jdid)
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then((cacheResponse) => {
          return cacheResponse || caches.match('/');
        });
      })
    );
    return;
  }

  // 2. Les autres fichiers JS, CSS, Images (Cache First)
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch((error) => {
        console.log("Hors ligne et ressource non trouvée dans le cache:", event.request.url);
        return Response.error();
      });
    })
  );
});
