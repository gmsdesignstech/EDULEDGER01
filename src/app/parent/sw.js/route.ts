import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PARENT_SW_CODE = `// EduLedger Parent Scoped Service Worker
// Scope: /parent/
const CACHE_NAME = 'eduledger-parent-v1';
const PRECACHE_URLS = [
  '/icons/parent/icon-192.png',
  '/icons/parent/icon-512.png',
  '/icons/parent/icon.svg',
  '/offline',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key.startsWith('eduledger-parent-') && key !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. STRICT PRIVACY GUARD: Never cache authenticated APIs, sensitive student/fee records, or tokens
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('token') ||
    url.pathname.includes('cookie')
  ) {
    return;
  }

  // 3. For navigation requests: Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline'))
    );
    return;
  }

  // 4. For static assets: Stale-While-Revalidate / Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/parent/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((res) => {
            if (res.ok && res.type === 'basic') {
              cache.put(request, res.clone());
            }
            return res;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'EduLedger Parent', body: 'New notification received.', url: '/parent' };
  try {
    if (event.data) {
      data = Object.assign(data, event.data.json());
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/icons/parent/icon-192.png',
    badge: '/icons/parent/icon-192.png',
    data: { url: data.url || '/parent' },
    tag: 'eduledger-parent-' + Date.now(),
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/parent';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/parent') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
`;

export async function GET() {
  return new NextResponse(PARENT_SW_CODE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/parent/",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

