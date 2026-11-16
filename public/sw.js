// Service Worker for AuraFin AI
// Handles Web Push, background scheduling, proactive payment reminders, and budget alerts

const CACHE_NAME = 'aurafin-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Push Event (Standard Web Push API)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'AuraFin AI', body: event.data.text() };
    }
  }

  const title = data.title || 'AuraFin AI - Asistente Financiero';
  const options = {
    body: data.body || 'Tienes una nueva alerta de tu asistente AuraFin.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'aurafin-notification',
    renotify: true,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
    actions: data.actions || [
      { action: 'open', title: 'Ver en AuraFin' },
      { action: 'dismiss', title: 'Descartar' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (event.notification.data && event.notification.data.tab) {
            client.postMessage({
              type: 'NAVIGATE_TAB',
              tab: event.notification.data.tab,
            });
          }
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 3. Message Event for client-side background scheduling
self.addEventListener('message', (event) => {
  const { type, title, options, delayMs } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    const delay = Math.max(0, delayMs || 0);
    setTimeout(() => {
      self.registration.showNotification(title || 'AuraFin AI', {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        ...options,
      });
    }, delay);
  } else if (type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(title || 'AuraFin AI', {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      ...options,
    });
  } else if (type === 'PING') {
    if (event.source) {
      event.source.postMessage({ type: 'PONG', timestamp: Date.now() });
    }
  }
});
