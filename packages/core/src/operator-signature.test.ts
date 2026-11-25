import { describe, expect, it } from 'vitest';
import {
  OPERATOR_MAX_SKEW_MS,
  OPERATOR_SIGNATURE_TAG,
  OPERATOR_TEST_VECTOR,
  checkOperatorTimestamp,
  operatorSigningPayload,
  parseOperatorRole,
  signOperatorRequest,
  verifyOperatorSignature,
} from './operator-signature';

const fields = OPERATOR_TEST_VECTOR.fields;

describe('operator request signature (AppDeck bridge)', () => {
  it('signs the JSON array of tag, timestamp, method, path, email, role, request id and body', () => {
    expect(operatorSigningPayload(fields)).toBe(
      JSON.stringify([
        'appdeck-revisionden-operator-v1',
        fields.timestamp,
        'POST',
        fields.path,
        fields.operatorEmail,
        fields.operatorRole,
        fields.requestId,
        fields.rawBody,
      ]),
    );
    expect(OPERATOR_SIGNATURE_TAG).toBe('appdeck-revisionden-operator-v1');
  });

  it('upper-cases the method before signing', () => {
    expect(operatorSigningPayload({ ...fields, method: 'post' })).toBe(
      operatorSigningPayload(fields),
    );
  });

  it('matches the published test vector, so AppDeck can pin the same one', async () => {
    expect(await signOperatorRequest(OPERATOR_TEST_VECTOR.secret, fields)).toBe(
      OPERATOR_TEST_VECTOR.signature,
    );
  });

  it('gives the header value as sha256= and a lower-case hex HMAC-SHA256', async () => {
    expect(OPERATOR_TEST_VECTOR.signature).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('accepts the right signature, in either letter case', async () => {
    const { secret, signature } = OPERATOR_TEST_VECTOR;
    expect(await verifyOperatorSignature(secret, fields, signature)).toBe(true);
    const hex = signature.slice('sha256='.length);
    expect(await verifyOperatorSignature(secret, fields, `sha256=${hex.toUpperCase()}`)).toBe(true);
  });

  it('refuses a signature without the sha256= prefix', async () => {
    const { secret, signature } = OPERATOR_TEST_VECTOR;
    expect(await verifyOperatorSignature(secret, fields, signature.slice('sha256='.length))).toBe(
      false,
    );
  });

  it('refuses a signature when any signed field changes', async () => {
    const { secret, signature } = OPERATOR_TEST_VECTOR;
    const changes = [
      { timestamp: String(Number(fields.timestamp) + 1) },
      { method: 'GET' },
      { path: `${fields.path}x` },
      { operatorEmail: 'someone-else@example.com' },
      { operatorRole: 'manager' },
      { requestId: 'another-request' },
      { rawBody: `${fields.rawBody} ` },
    ];
    for (const change of changes) {
      expect(await verifyOperatorSignature(secret, { ...fields, ...change }, signature)).toBe(
        false,
      );
    }
  });

  it('refuses a signature made with another secret, or one that is not hex', async () => {
    const { secret, signature } = OPERATOR_TEST_VECTOR;
    expect(await verifyOperatorSignature(`${secret}-other`, fields, signature)).toBe(false);
    expect(await verifyOperatorSignature(secret, fields, 'not-a-signature')).toBe(false);
    expect(await verifyOperatorSignature(secret, fields, '')).toBe(false);
  });
});

describe('operator timestamp window', () => {
  const now = new Date(Number(fields.timestamp));

  it('is 5 minutes either way', () => {
    expect(OPERATOR_MAX_SKEW_MS).toBe(5 * 60 * 1000);
  });

  it('accepts a timestamp (Unix milliseconds) within 5 minutes of now, before or after', () => {
    const at = (offsetMs: number) => String(Number(fields.timestamp) + offsetMs);
    expect(checkOperatorTimestamp(at(0), now)).toBe('ok');
    expect(checkOperatorTimestamp(at(-300_000), now)).toBe('ok');
    expect(checkOperatorTimestamp(at(300_000), now)).toBe('ok');
  });

  it('refuses a timestamp more than 5 minutes away, including one sent in seconds', () => {
    const at = (offsetMs: number) => String(Number(fields.timestamp) + offsetMs);
    expect(checkOperatorTimestamp(at(-300_001), now)).toBe('expired');
    expect(checkOperatorTimestamp(at(300_001), now)).toBe('expired');
    expect(checkOperatorTimestamp(String(Math.floor(now.getTime() / 1000)), now)).toBe('expired');
  });

  it('refuses a timestamp that is not whole Unix milliseconds', () => {
    for (const bad of ['', 'abc', '1.5', '-1', '1795600800000000', ' 1795600800000']) {
      expect(checkOperatorTimestamp(bad, now)).toBe('invalid');
    }
  });
});

describe('operator roles', () => {
  it('reads Agent and Manager in any letter case', () => {
    expect(parseOperatorRole('agent')).toBe('agent');
    expect(parseOperatorRole('Agent')).toBe('agent');
    expect(parseOperatorRole('MANAGER')).toBe('manager');
  });

  it('refuses any other role', () => {
    expect(parseOperatorRole('owner')).toBeNull();
    expect(parseOperatorRole('')).toBeNull();
  });
});
