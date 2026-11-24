import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Listener = (event: FakeEvent) => void;

interface FakeEvent {
  request?: Request;
  waitUntil: (p: Promise<unknown>) => void;
  respondWith: (p: Promise<Response> | Response) => void;
}

const source = readFileSync(join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');

function loadWorker(fetchImpl: (req: Request) => Promise<Response>) {
  const listeners: Record<string, Listener> = {};
  const stores = new Map<string, Map<string, Response>>();
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        addAll: async (urls: string[]) => {
          for (const url of urls)
            store.set(new URL(url, 'https://app.test').href, new Response(url));
        },
        put: async (req: Request, res: Response) => {
          store.set(req.url, res);
        },
        match: async (req: Request | string) =>
          store.get(typeof req === 'string' ? new URL(req, 'https://app.test').href : req.url),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (req: Request | string) => {
      const url = typeof req === 'string' ? new URL(req, 'https://app.test').href : req.url;
      for (const store of stores.values()) if (store.has(url)) return store.get(url);
      return undefined;
    },
  };
  const self = {
    location: { origin: 'https://app.test' },
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  new Function('self', 'caches', 'fetch', source)(self, caches, fetchImpl);

  async function dispatch(type: string, request?: Request) {
    let waited: Promise<unknown> = Promise.resolve();
    let response: Promise<Response> | Response | undefined;
    listeners[type]!({
      request,
      waitUntil: (p) => (waited = p),
      respondWith: (r) => (response = r),
    });
    await waited;
    return response === undefined ? undefined : await response;
  }
  return { dispatch, stores };
}

/** Browsers forbid building a navigate-mode Request, so fake one for page visits. */
const pageVisit = (url: string) => ({ url, method: 'GET', mode: 'navigate' }) as Request;

const offline = () => Promise.reject(new TypeError('offline'));

describe('service worker', () => {
  it('caches the app shell when installed', async () => {
    const worker = loadWorker(offline);
    await worker.dispatch('install');
    const cached = [...worker.stores.values()].flatMap((s) => [...s.keys()]);
    expect(cached).toEqual(
      expect.arrayContaining(['https://app.test/', 'https://app.test/manifest.webmanifest']),
    );
  });

  it('serves the cached app shell for page visits when offline', async () => {
    const worker = loadWorker(offline);
    await worker.dispatch('install');
    const request = pageVisit('https://app.test/learn');
    const response = await worker.dispatch('fetch', request);
    expect(await response!.text()).toBe('/');
  });

  it('uses the network for page visits when online', async () => {
    const worker = loadWorker(async () => new Response('fresh page'));
    await worker.dispatch('install');
    const request = pageVisit('https://app.test/learn');
    const response = await worker.dispatch('fetch', request);
    expect(await response!.text()).toBe('fresh page');
  });

  it('caches built assets after the first load and serves them offline', async () => {
    let online = true;
    const worker = loadWorker(async () => {
      if (!online) throw new TypeError('offline');
      return new Response('asset body');
    });
    const request = new Request('https://app.test/assets/index-abc123.js');
    await worker.dispatch('fetch', request);
    online = false;
    const response = await worker.dispatch('fetch', request);
    expect(await response!.text()).toBe('asset body');
  });

  it('never caches API calls', async () => {
    const worker = loadWorker(offline);
    const response = await worker.dispatch('fetch', new Request('https://app.test/api/family'));
    expect(response).toBeUndefined();
  });

  it('removes caches from older versions when activated', async () => {
    const worker = loadWorker(offline);
    worker.stores.set('revisionden-shell-old', new Map());
    await worker.dispatch('install');
    await worker.dispatch('activate');
    expect([...worker.stores.keys()].some((k) => k.endsWith('-old'))).toBe(false);
    expect(worker.stores.size).toBe(1);
  });
});
