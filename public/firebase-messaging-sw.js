// EduLedger PWA Service Worker (v5)
// Handles offline fallback, static asset caching, and Firebase Cloud Messaging push notifications.

const CACHE_NAME = "eduledger-pwa-v5";
const OFFLINE_URL = "/offline.html";
const isDev = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

const PRECACHE_ASSETS = [
  "/offline.html",
  "/offline",
  "/eduledger-logo.jpeg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg",
];

// Sensitive route prefixes that MUST NEVER be cached
const SENSITIVE_PREFIXES = [
  "/api/",
  "/admin",
  "/parent",
  "/teacher",
  "/student",
  "/dashboard",
  "/students",
  "/fees",
  "/attendance",
  "/marks",
  "/salaries",
  "/reports",
  "/settings",
  "/auth",
  "/accounts",
  "/cash-book",
  "/classes",
  "/documents",
  "/exams",
  "/results",
  "/subscription",
  "/timetable",
];

function isSensitiveUrl(pathname) {
  return SENSITIVE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// 1. Install Event: Pre-cache core shell & offline fallback
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch((err) => {
        console.warn("[SW] Pre-cache failed:", err);
      })
  );
});

// 2. Activate Event: Clean up outdated caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name.startsWith("eduledger-pwa-") && name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Updates wait for an explicit portal user action so the current task is not interrupted.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});

// 3. Fetch Event: Strict caching policy protecting sensitive records
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Non-GET requests always bypass cache
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Same-origin checks
  if (url.origin === self.location.origin) {
    // Development mode: NEVER cache Next.js chunks, Turbopack, or HMR in local dev
    if (isDev && (url.pathname.startsWith("/_next/") || url.pathname.includes("turbopack") || url.pathname.includes("webpack"))) {
      return;
    }

    // SECURITY INVARIANT: Sensitive data, portals, and API routes are NETWORK ONLY!
    // Never cache student records, marks, fees, or session data.
    if (isSensitiveUrl(url.pathname)) {
      if (request.mode === "navigate") {
        event.respondWith(
          fetch(request).catch(() => caches.match(OFFLINE_URL))
        );
      } else {
        event.respondWith(fetch(request));
      }
      return;
    }

    // Static assets (Next.js chunks, styles, icons, fonts)
    const isPublicStaticAsset =
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/eduledger-logo.jpeg";
    if (isPublicStaticAsset) {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          });
        })
      );
      return;
    }

    // Generic HTML navigation: Network first with offline fallback
    if (request.mode === "navigate") {
      event.respondWith(
        fetch(request).catch(() => caches.match(OFFLINE_URL))
      );
      return;
    }
  }

  // Fallback default network fetch
  event.respondWith(fetch(request));
});

// 4. Handle Background Push Messages (Firebase Cloud Messaging)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      notification: {
        title: "EduLedger Update",
        body: event.data.text(),
      },
    };
  }

  const title = payload.notification?.title || payload.title || "EduLedger";
  const body = payload.notification?.body || payload.body || "";
  const data = payload.data || {};
  const deliveryId = data.deliveryId;
  const url = data.url || data.link || "/";

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || data.eventKey || "eduledger-notification",
    renotify: true,
    data: {
      url,
      deliveryId,
      notificationId: data.notificationId,
      timestamp: Date.now(),
    },
    actions: [
      { action: "open", title: "View Details" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  // Immediate delivery confirmation acknowledgment back to server
  const ackPromise = deliveryId
    ? fetch("/api/notifications/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId }),
      }).catch(() => {
        // Safe offline / network retry handled by browser
      })
    : Promise.resolve();

  // Notify any active foreground client windows
  const broadcastPromise = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      for (const client of clients) {
        client.postMessage({
          type: "PUSH_RECEIVED",
          payload: { title, body, data },
        });
      }
    });

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      ackPromise,
      broadcastPromise,
    ])
  );
});

// 5. Handle Notification Clicks (Deep Linking)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
