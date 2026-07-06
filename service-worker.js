const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `wip-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `wip-dynamic-${CACHE_VERSION}`;
const FONT_CACHE = `wip-fonts-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/firebase-config.js',
  '/auth.js',
  '/settings.js',
  '/components/navbar.js',
  '/components/tabs.js',
  '/components/cards.js',
  '/components/loader.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

const FIREBASE_SCRIPTS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions-compat.js',
];

const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap',
];

const NEVER_CACHE = [
  'firebase.googleapis.com',
  'firebaseio.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'allorigins.win',
  'corsproxy.io',
];

const MAX_DYNAMIC_ENTRIES = 50;
const MAX_DYNAMIC_AGE = 24 * 60 * 60 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      }).catch(() => {}),
      caches.open(FONT_CACHE).then(cache => {
        return cache.addAll([...FIREBASE_SCRIPTS, ...FONT_URLS]).catch(() => {});
      }),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => {
          return (key.startsWith('wip-static-') || key.startsWith('wip-dynamic-') || key.startsWith('wip-fonts-')) &&
            key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== FONT_CACHE;
        }).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

function shouldNeverCache(url) {
  return NEVER_CACHE.some(domain => url.includes(domain));
}

function isStaticAsset(url) {
  const parsed = new URL(url);
  const path = parsed.pathname;
  return STATIC_ASSETS.some(asset => path === asset || path.endsWith(asset));
}

function isFont(url) {
  return url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('gstatic.com/firebasejs');
}

function isFirebaseScript(url) {
  return FIREBASE_SCRIPTS.some(script => url === script);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

async function trimDynamicCache() {
  const cache = await caches.open(DYNAMIC_CACHE);
  const keys = await cache.keys();
  if (keys.length > MAX_DYNAMIC_ENTRIES) {
    const toDelete = keys.slice(0, keys.length - MAX_DYNAMIC_ENTRIES);
    await Promise.all(toDelete.map(key => cache.delete(key)));
  }
}

async function networkFirst(request, cacheName = DYNAMIC_CACHE) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone()).catch(() => {});
      trimDynamicCache().catch(() => {});
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('Network unavailable and no cache found');
  }
}

async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    return new Response('Resource not available offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName = DYNAMIC_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);

  return cached || await networkFetch || new Response('Offline', { status: 503 });
}

async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(new Request('/index.html'), networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    const cached = await caches.match('/index.html') || await caches.match('/');
    if (cached) return cached;
    return new Response(getOfflinePage(), {
      headers: { 'Content-Type': 'text/html' },
      status: 503,
    });
  }
}

function getOfflinePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Web Inspector Pro - Offline</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #fff; font-family: monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 20px; }
  .icon { font-size: 48px; margin-bottom: 16px; }
  h1 { font-size: 20px; color: #00ff88; margin-bottom: 8px; }
  p { color: #888; font-size: 13px; line-height: 1.6; }
  button { margin-top: 20px; padding: 12px 24px; background: #00ff88; color: #000; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: monospace; }
</style>
</head>
<body>
<div>
  <div class="icon">◈</div>
  <h1>You are offline</h1>
  <p>Web Inspector Pro requires an internet connection to scan websites.</p>
  <button onclick="window.location.reload()">Try Again</button>
</div>
</body>
</html>`;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  if (request.method !== 'GET') return;
  if (url.startsWith('chrome-extension://')) return;
  if (shouldNeverCache(url)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isFont(url) || isFirebaseScript(url)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.includes('/api/') || url.includes('cloudfunctions.net')) {
    return;
  }

  if (url.includes('favicon') || url.includes('s2/favicons')) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(DYNAMIC_CACHE).then(cache => {
      cache.addAll(urls).catch(() => {});
    });
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => {
      Promise.all(keys.map(key => caches.delete(key))).then(() => {
        event.source?.postMessage({ type: 'CACHE_CLEARED' });
      });
    });
  }

  if (event.data.type === 'GET_CACHE_SIZE') {
    caches.keys().then(async keys => {
      let total = 0;
      for (const key of keys) {
        const cache = await caches.open(key);
        const entries = await cache.keys();
        total += entries.length;
      }
      event.source?.postMessage({ type: 'CACHE_SIZE', size: total });
    });
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scans') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Web Inspector Pro', {
        body: data.body || 'Scan complete',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-96.png',
        data: data.url ? { url: data.url } : {},
        actions: [
          { action: 'view', title: 'View Results' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      })
    );
  } catch {}
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url === url && 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});