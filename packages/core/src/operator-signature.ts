/**
 * Signed requests from the owner's AppDeck Admin console to the RevisionDen operator bridge
 * (`docs/OPERATOR_CONSOLE.md`). Same pattern AppDeck uses for HireLine: HMAC-SHA256 over a JSON
 * array of the request's parts, with a shared secret per environment. Web Crypto only, so it
 * runs in Workers, Node and the browser.
 */

export const OPERATOR_SIGNATURE_TAG = 'appdeck-revisionden-operator-v1';

/** Requests signed more than this far from the server's clock (either way) are refused. */
export const OPERATOR_MAX_SKEW_MS = 5 * 60 * 1000;

/** The shared secret must be at least this long (`APPDECK_OPERATOR_SHARED_SECRET`). */
export const OPERATOR_SECRET_MIN_LENGTH = 32;

export type OperatorRole = 'agent' | 'manager';

export interface OperatorSignedFields {
  /** Unix milliseconds (`String(Date.now())`), as sent in the header. */
  timestamp: string;
  method: string;
  /** Path and query string exactly as requested, e.g. `/operator/appdeck/tickets?status=open`. */
  path: string;
  operatorEmail: string;
  /** The role header exactly as sent (`agent` or `manager`, any letter case). */
  operatorRole: string;
  requestId: string;
  /** The request body exactly as sent; an empty string for none. */
  rawBody: string;
}

/** The exact text that is signed. */
export function operatorSigningPayload(f: OperatorSignedFields): string {
  return JSON.stringify([
    OPERATOR_SIGNATURE_TAG,
    f.timestamp,
    f.method.toUpperCase(),
    f.path,
    f.operatorEmail,
    f.operatorRole,
    f.requestId,
    f.rawBody,
  ]);
}

const encoder = new TextEncoder();

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const SIGNATURE_PREFIX = 'sha256=';

/** The `x-appdeck-signature` value: `sha256=` and the lower-case hex HMAC-SHA256 of the payload. */
export async function signOperatorRequest(
  secret: string,
  fields: OperatorSignedFields,
): Promise<string> {
  return `${SIGNATURE_PREFIX}${toHex(await hmacSha256(secret, operatorSigningPayload(fields)))}`;
}

/** True when the header value (`sha256=` and hex in any case) is right. Constant-time compare. */
export async function verifyOperatorSignature(
  secret: string,
  fields: OperatorSignedFields,
  signature: string,
): Promise<boolean> {
  const expected = await signOperatorRequest(secret, fields);
  const given = signature.toLowerCase();
  if (!/^sha256=[0-9a-f]{64}$/.test(given)) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

/** `ok` within 5 minutes of `now`; `expired` outside; `invalid` if not whole Unix milliseconds. */
export function checkOperatorTimestamp(timestamp: string, now: Date): 'ok' | 'expired' | 'invalid' {
  if (!/^\d{1,14}$/.test(timestamp)) return 'invalid';
  const skew = Math.abs(now.getTime() - Number(timestamp));
  return skew <= OPERATOR_MAX_SKEW_MS ? 'ok' : 'expired';
}

/** Agent or Manager from AppDeck, in any letter case; null for anything else. */
export function parseOperatorRole(value: string): OperatorRole | null {
  const role = value.toLowerCase();
  return role === 'agent' || role === 'manager' ? role : null;
}

/**
 * Fixed test vector, published in `docs/OPERATOR_CONSOLE.md`, so AppDeck's client can pin the
 * same one. The secret is a test value used nowhere else.
 */
export const OPERATOR_TEST_VECTOR = {
  secret: 'revisionden-operator-test-vector-secret-0001',
  fields: {
    timestamp: '1795600800000',
    method: 'POST',
    path: '/operator/appdeck/families/00000000-0000-4000-8000-000000000001/notes',
    operatorEmail: 'operator@example.com',
    operatorRole: 'agent',
    requestId: 'req-0001',
    rawBody: '{"note":"Test note"}',
  },
  signature: 'sha256=64618da6da442da5b05657dd5ebf56a50665dd4a15462dc3350d47db8db9bcbd',
} as const satisfies {
  secret: string;
  fields: OperatorSignedFields;
  signature: string;
};
