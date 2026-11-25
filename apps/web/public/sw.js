/*
 * RevisionDen service worker: caches the app shell so the app opens offline.
 * Pages: network first (skipping the browser cache, so a new deploy shows on the next visit),
 * and the newest page is kept for offline use. Built assets: cache first (their names change
 * with every build). API calls and the build check (/version.json) are never cached.
 * The Get help page and the built files it needs are precached on install, so support numbers
 * can be found with no signal (workstream W). Bump VERSION to drop old caches.
 */
const VERSION = 'v3';
const CACHE = `revisionden-shell-${VERSION}`;
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/help',
  '/parent/help',
  '/appearance-boot.js',
];

/** Caches the current app page and every built file it links to (scripts, styles). */
async function precacheBuiltFiles(cache) {
  try {
    const page = await fetch('/', { cache: 'no-cache', credentials: 'same-origin' });
    if (!page.ok) return;
    const html = await page.clone().text();
    await cache.put('/', page);
    const files = [...new Set(html.match(/\/assets\/[^"'\s)>]+/g) ?? [])];
    await Promise.all(
      files.map(async (path) => {
        const response = await fetch(path);
        if (response.ok) await cache.put(path, response);
      }),
    );
  } catch {
    // Offline while installing: built files are cached the first time they are used.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).then(() => precacheBuiltFiles(cache)))
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
// Parent devices (workstream H2): news that a parent-set reward target was met. No nickname here.
const GENERIC_PARENT = 'A reward target you set has been reached.';

async function savedConfig(key) {
  const saved = await (await caches.open(CONFIG_CACHE)).match(key);
  return saved ? saved.text() : null;
}

async function audience() {
  try {
    return (await savedConfig('/push-audience')) === 'parent' ? 'parent' : 'student';
  } catch {
    return 'student';
  }
}

async function notificationText(who) {
  try {
    const base = (await savedConfig('/reminder-api')) ?? `${self.location.origin}/api/`;
    const root = base.endsWith('/') ? base : `${base}/`;
    const path =
      who === 'parent' ? 'v1/parent/notifications/latest' : 'v1/student/reminders/latest';
    const response = await fetch(`${root}${path}`, { credentials: 'include' });
    if (response.ok) {
      const body = await response.json();
      if (typeof body.message === 'string' && body.message) return body.message;
    }
  } catch {
    // Offline or locked: fall through to the generic text.
  }
  return who === 'parent' ? GENERIC_PARENT : GENERIC_REMINDER;
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    audience().then(async (who) =>
      self.registration.showNotification('RevisionDen', {
        body: await notificationText(who),
        tag: who === 'parent' ? 'parent-reward' : 'reminder',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    audience().then((who) => self.clients.openWindow(who === 'parent' ? '/parent' : '/learn')),
  );
});
