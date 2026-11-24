/**
 * Web push with VAPID (RFC 8292). We send pushes with no payload: the push service (Google,
 * Apple, Mozilla) never sees any reminder text. The service worker wakes up and fetches the
 * latest reminder from our API, or shows a generic one if the device is locked.
 */
import type { Clock } from '../rate-limit';

export interface VapidKeys {
  /** Uncompressed P-256 public key (65 bytes), base64url: the key the browser subscribes with. */
  publicKey: string;
  /** Private scalar `d` (32 bytes), base64url. */
  privateKey: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushResult = 'sent' | 'gone' | 'failed';

export interface PushSender {
  send(target: PushTarget): Promise<PushResult>;
}

const TTL_SECONDS = 3600;
const JWT_LIFETIME_SECONDS = 12 * 60 * 60;

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function importSigningKey(keys: VapidKeys): Promise<CryptoKey> {
  const pub = base64UrlDecode(keys.publicKey);
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: keys.privateKey,
      x: base64UrlEncode(pub.slice(1, 33)),
      y: base64UrlEncode(pub.slice(33, 65)),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

const encodeJson = (value: unknown) =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));

export function createWebPushSender(options: {
  keys: VapidKeys;
  /** Contact for push services: an https URL (ours), never a personal email. */
  subject: string;
  fetch?: typeof globalThis.fetch;
  clock: Clock;
}): PushSender {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  let signingKey: Promise<CryptoKey> | undefined;

  async function vapidJwt(audience: string): Promise<string> {
    signingKey ??= importSigningKey(options.keys);
    const unsigned = `${encodeJson({ typ: 'JWT', alg: 'ES256' })}.${encodeJson({
      aud: audience,
      exp: Math.floor(options.clock.now().getTime() / 1000) + JWT_LIFETIME_SECONDS,
      sub: options.subject,
    })}`;
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      await signingKey,
      new TextEncoder().encode(unsigned),
    );
    return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
  }

  return {
    async send(target) {
      try {
        const jwt = await vapidJwt(new URL(target.endpoint).origin);
        const res = await fetch(target.endpoint, {
          method: 'POST',
          headers: {
            authorization: `vapid t=${jwt}, k=${options.keys.publicKey}`,
            ttl: String(TTL_SECONDS),
            urgency: 'normal',
            'content-length': '0',
          },
        });
        if (res.status === 404 || res.status === 410) return 'gone';
        return res.ok ? 'sent' : 'failed';
      } catch {
        return 'failed';
      }
    },
  };
}
