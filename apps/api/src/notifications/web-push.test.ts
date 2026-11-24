import { beforeAll, describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode, createWebPushSender, type VapidKeys } from './web-push';

let keys: VapidKeys;
let verifyKey: CryptoKey;

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  const jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  keys = { publicKey: base64UrlEncode(raw), privateKey: jwk.d! };
  verifyKey = pair.publicKey;
});

const NOW = new Date('2026-11-24T18:00:00Z');
const subscription = {
  endpoint: 'https://push.example.com/send/abc123',
  p256dh: 'BKey',
  auth: 'authsecret',
};

function recordingFetch(status = 201) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(null, { status });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

describe('web push sender', () => {
  it('posts an empty push with a VAPID header the push service can verify', async () => {
    const { calls, fetch } = recordingFetch();
    const sender = createWebPushSender({
      keys,
      subject: 'https://revisionden.example',
      fetch,
      clock: { now: () => NOW },
    });
    expect(await sender.send(subscription)).toBe('sent');

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe(subscription.endpoint);
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('ttl')).toBe('3600');
    expect(headers.get('content-length')).toBe('0');
    expect(init.body ?? null).toBeNull();

    const match = /^vapid t=([^,]+), k=(.+)$/.exec(headers.get('authorization')!);
    expect(match).not.toBeNull();
    const [, jwt, k] = match!;
    expect(k).toBe(keys.publicKey);

    const [h, p, s] = jwt!.split('.');
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(h!)))).toEqual({
      typ: 'JWT',
      alg: 'ES256',
    });
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(p!)));
    expect(claims).toEqual({
      aud: 'https://push.example.com',
      exp: NOW.getTime() / 1000 + 12 * 60 * 60,
      sub: 'https://revisionden.example',
    });
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      base64UrlDecode(s!),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });

  it.each([404, 410])(
    'reports a subscription the push service no longer knows (%i) as gone',
    async (status) => {
      const { fetch } = recordingFetch(status);
      const sender = createWebPushSender({
        keys,
        subject: 'https://x.example',
        fetch,
        clock: { now: () => NOW },
      });
      expect(await sender.send(subscription)).toBe('gone');
    },
  );

  it('reports other errors and network failures as failed', async () => {
    const { fetch } = recordingFetch(500);
    const clock = { now: () => NOW };
    expect(
      await createWebPushSender({ keys, subject: 'https://x.example', fetch, clock }).send(
        subscription,
      ),
    ).toBe('failed');
    const broken = (async () => {
      throw new TypeError('network down');
    }) as typeof globalThis.fetch;
    expect(
      await createWebPushSender({ keys, subject: 'https://x.example', fetch: broken, clock }).send(
        subscription,
      ),
    ).toBe('failed');
  });

  it('round-trips base64url without padding', () => {
    const bytes = new Uint8Array([251, 255, 0, 1, 2]);
    const text = base64UrlEncode(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect([...base64UrlDecode(text)]).toEqual([...bytes]);
  });
});
