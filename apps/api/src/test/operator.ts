import { signOperatorRequest } from '@revisionden/core';
import type { Clock } from '../rate-limit';

/** Test-only shared secret for the AppDeck operator bridge. */
export const TEST_OPERATOR_SECRET = 'test-operator-secret-that-is-at-least-32-chars';

export interface OperatorCall {
  clock: Clock;
  path: string;
  method?: string;
  body?: unknown;
  email?: string;
  role?: string;
  requestId?: string;
  /** Unix milliseconds; defaults to the clock's time. */
  timestamp?: string;
  secret?: string;
}

/** A request signed the way AppDeck signs it: returns the path and init for `app.request`. */
export async function signedOperatorRequest(call: OperatorCall): Promise<[string, RequestInit]> {
  const method = call.method ?? 'GET';
  const rawBody = call.body === undefined ? '' : JSON.stringify(call.body);
  const fields = {
    timestamp: call.timestamp ?? String(call.clock.now().getTime()),
    method,
    path: call.path,
    operatorEmail: call.email ?? 'agent@example.com',
    operatorRole: call.role ?? 'agent',
    requestId: call.requestId ?? crypto.randomUUID(),
    rawBody,
  };
  const signature = await signOperatorRequest(call.secret ?? TEST_OPERATOR_SECRET, fields);
  return [
    call.path,
    {
      method,
      headers: {
        ...(rawBody ? { 'content-type': 'application/json' } : {}),
        'x-appdeck-timestamp': fields.timestamp,
        'x-appdeck-signature': signature,
        'x-appdeck-request-id': fields.requestId,
        'x-appdeck-operator-email': fields.operatorEmail,
        'x-appdeck-operator-role': fields.operatorRole,
      },
      ...(rawBody ? { body: rawBody } : {}),
    },
  ];
}
