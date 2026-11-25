/*
 * RevisionDen service worker: caches the app shell so the app opens offline.
 * Pages: network first (skipping the browser cache, so a new deploy shows on the next visit),
 * and the newest page is kept for offline use. Built assets: cache first (their names change
 * with every build). API calls and the build check (/version.json) are never cached.
 * Bump VERSION to drop old caches.
 */
const VERSION = 'v2';
const CACHE = `revisionden-shell-${VERSION}`;
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('revisionden-') && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirstPage(request) {
  try {
    const response = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put('/', response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE);
    return (await cache.match('/')) || Response.error();
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/version.json') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(cacheFirstAsset(request));
  }
});

/*
 * Reminders (web push, workstream H). Pushes arrive with no payload, so push services never
 * see reminder text: we fetch the latest reminder from the API, or show a generic one if the
 * device is locked or offline. The API address is saved by the app when reminders are turned on.
 */
const CONFIG_CACHE = 'rd-config';
const GENERIC_REMINDER = 'Time for a little revision? Pip is ready when you are.';

async function reminderText() {
  try {
    const saved = await (await caches.open(CONFIG_CACHE)).match('/reminder-api');
    const base = saved ? await saved.text() : `${self.location.origin}/api/`;
    const root = base.endsWith('/') ? base : `${base}/`;
    const response = await fetch(`${root}v1/student/reminders/latest`, { credentials: 'include' });
    if (response.ok) {
      const body = await response.json();
      if (typeof body.message === 'string' && body.message) return body.message;
    }
  } catch {
    // Offline or locked: fall through to the generic reminder.
  }
  return GENERIC_REMINDER;
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    reminderText().then((body) =>
      self.registration.showNotification('RevisionDen', {
        body,
        tag: 'reminder',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/learn'));
});
