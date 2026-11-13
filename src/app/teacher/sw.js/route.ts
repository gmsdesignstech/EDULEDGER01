import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TEACHER_SW_CODE = `// EduLedger Teacher Scoped Service Worker
// Scope: /teacher/
const CACHE_NAME = 'eduledger-teacher-v1';
const PRECACHE_URLS = [
  '/icons/teacher/icon-192.png',
  '/icons/teacher/icon-512.png',
  '/icons/teacher/icon.svg',
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
        keys.filter((key) => key.startsWith('eduledger-teacher-') && key !== CACHE_NAME).map((k) => caches.delete(k))
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

  // 2. STRICT PRIVACY GUARD: Never cache authenticated APIs, sensitive records, or tokens
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
    url.pathname.startsWith('/icons/teacher/') ||
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
  let data = { title: 'EduLedger Teacher', body: 'New notification received.', url: '/teacher' };
  try {
    if (event.data) {
      data = Object.assign(data, event.data.json());
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/icons/teacher/icon-192.png',
    badge: '/icons/teacher/icon-192.png',
    data: { url: data.url || '/teacher' },
    tag: 'eduledger-teacher-' + Date.now(),
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/teacher';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/teacher') && 'focus' in client) {
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
  return new NextResponse(TEACHER_SW_CODE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/teacher/",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

