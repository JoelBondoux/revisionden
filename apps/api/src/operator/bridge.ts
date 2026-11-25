/**
 * Operator bridge for the owner's AppDeck Admin console (`docs/OPERATOR_CONSOLE.md`). AppDeck has
 * no database access: it calls these routes with requests signed by a shared secret per
 * environment. Every request is rate limited, checked for its signature and 5-minute window, and
 * its request id is used once. Roles (Agent, Manager) come from the signed headers and are
 * enforced here. Family reads and actions are written to the audit log, kept 2 years.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import {
  checkOperatorTimestamp,
  parseOperatorRole,
  verifyOperatorSignature,
  type OperatorRole,
} from '@revisionden/core';
import { operatorAuditLog, operatorRequests, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import { ApiError } from '../errors';
import { clientKey, RETRY_AFTER_SECONDS, type Clock, type RateLimiter } from '../rate-limit';

/** Headers AppDeck sends with every operator request. */
export const OPERATOR_HEADERS = {
  timestamp: 'x-appdeck-timestamp',
  signature: 'x-appdeck-signature',
  requestId: 'x-appdeck-request-id',
  email: 'x-appdeck-operator-email',
  role: 'x-appdeck-operator-role',
  /** Set on a change's answer when it was sent again with the same request id. */
  replayed: 'x-appdeck-replayed',
} as const;

/** Audit entries are kept this many years. */
export const OPERATOR_AUDIT_RETENTION_YEARS = 2;
/** Request ids are remembered this long: well past the 5-minute signing window. */
export const OPERATOR_REQUEST_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface OperatorContext {
  /** Lower case. */
  email: string;
  role: OperatorRole;
  requestId: string;
}

export interface OperatorBridgeDeps {
  db: Database;
  clock: Clock;
  config: AppConfig;
  rateLimiter: RateLimiter;
}

const RequestIdSchema = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
const EmailSchema = z.string().email().max(254);

const unauthorizedOperator = () =>
  new ApiError(401, 'operator_unauthorized', 'The request is not signed by AppDeck');

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const isChange = (method: string) => method !== 'GET' && method !== 'HEAD';

/** The signed path: path and query string exactly as requested. */
function signedPath(c: Context): string {
  const url = new URL(c.req.url);
  return `${url.pathname}${url.search}`;
}

/**
 * Checks an AppDeck request and sets `c.var.operator`. Off (503) when the environment has no
 * shared secret. Change answers are stored so a retry with the same request id and body gets
 * the same answer without running twice; a crash (5xx) frees the id for a retry.
 */
export function operatorAuth(deps: OperatorBridgeDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const bridge = deps.config.operatorBridge;
    if (!bridge) {
      throw new ApiError(503, 'operator_bridge_off', 'The operator bridge is not set up here');
    }

    const { success } = await deps.rateLimiter.limit({
      key: `operator:${clientKey(c.req.raw.headers)}`,
    });
    if (!success) {
      c.header('Retry-After', String(RETRY_AFTER_SECONDS));
      throw new ApiError(429, 'rate_limited', 'Too many requests. Please wait a minute.');
    }

    const header = (name: string) => c.req.header(name) ?? '';
    const timestamp = header(OPERATOR_HEADERS.timestamp);
    const signature = header(OPERATOR_HEADERS.signature);
    const requestId = header(OPERATOR_HEADERS.requestId);
    const email = header(OPERATOR_HEADERS.email);
    const roleHeader = header(OPERATOR_HEADERS.role);
    if (!timestamp || !signature || !requestId || !email || !roleHeader) {
      throw unauthorizedOperator();
    }
    const when = checkOperatorTimestamp(timestamp, deps.clock.now());
    if (when === 'expired') {
      throw new ApiError(
        401,
        'operator_request_expired',
        'The request was signed more than 5 minutes ago',
      );
    }
    if (when === 'invalid') throw unauthorizedOperator();

    const method = c.req.method.toUpperCase();
    const path = signedPath(c);
    const rawBody = await c.req.text();
    const fields = {
      timestamp,
      method,
      path,
      operatorEmail: email,
      operatorRole: roleHeader,
      requestId,
      rawBody,
    };
    if (!(await verifyOperatorSignature(bridge.secret, fields, signature))) {
      throw unauthorizedOperator();
    }
    const role = parseOperatorRole(roleHeader);
    if (
      !role ||
      !EmailSchema.safeParse(email).success ||
      !RequestIdSchema.safeParse(requestId).success
    ) {
      throw unauthorizedOperator();
    }

    const bodyHash = await sha256Hex(rawBody);
    const [claimed] = await deps.db
      .insert(operatorRequests)
      .values({ requestId, method, path, bodyHash, createdAt: deps.clock.now() })
      .onConflictDoNothing({ target: operatorRequests.requestId })
      .returning({ requestId: operatorRequests.requestId });
    if (!claimed) return replay(c, deps.db, { requestId, method, path, bodyHash });

    c.set('operator', { email: email.toLowerCase(), role, requestId });
    await next();

    if (!isChange(method)) return;
    if (c.res.status >= 500) {
      await deps.db.delete(operatorRequests).where(eq(operatorRequests.requestId, requestId));
      return;
    }
    await deps.db
      .update(operatorRequests)
      .set({ responseStatus: c.res.status, responseBody: await c.res.clone().text() })
      .where(eq(operatorRequests.requestId, requestId));
  };
}

/** A request id seen before: replay a finished change with the same body, else refuse. */
async function replay(
  c: Context<AppEnv>,
  db: Database,
  sent: { requestId: string; method: string; path: string; bodyHash: string },
) {
  if (!isChange(sent.method)) {
    throw new ApiError(409, 'operator_request_replayed', 'This request id was already used');
  }
  const [seen] = await db
    .select()
    .from(operatorRequests)
    .where(eq(operatorRequests.requestId, sent.requestId));
  const same =
    seen &&
    seen.method === sent.method &&
    seen.path === sent.path &&
    seen.bodyHash === sent.bodyHash;
  if (!same) {
    throw new ApiError(
      409,
      'operator_request_conflict',
      'This request id was already used for a different request',
    );
  }
  if (seen.responseStatus === null || seen.responseBody === null) {
    throw new ApiError(409, 'operator_request_in_progress', 'This request is still running');
  }
  return new Response(seen.responseBody, {
    status: seen.responseStatus,
    headers: { 'content-type': 'application/json', [OPERATOR_HEADERS.replayed]: 'true' },
  });
}

/** AppDeck's success envelope: `{ success: true, data }`. Errors keep the API's shared shape. */
export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true as const, data }, status);
}

/** Records an operator read of a family, or an action, in the audit log. */
export async function audit(
  db: Database,
  operator: OperatorContext,
  entry: {
    action: string;
    targetType?: string;
    targetId?: string;
    outcome?: 'ok' | 'denied';
  },
): Promise<void> {
  await db.insert(operatorAuditLog).values({
    operatorEmail: operator.email,
    operatorRole: operator.role,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    requestId: operator.requestId,
    outcome: entry.outcome ?? 'ok',
  });
}

/** Route guard for Manager actions: an Agent is refused with 403 and the refusal is audited. */
export function requireManager(db: Database): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.var.operator.role !== 'manager') {
      await audit(db, c.var.operator, {
        action: `${c.req.method} ${c.req.routePath}`,
        outcome: 'denied',
      });
      throw new ApiError(403, 'operator_forbidden', 'Only a Manager can do this');
    }
    await next();
  };
}

/** Deletes audit entries older than 2 years and request ids older than 1 day. */
export async function deleteExpiredOperatorRecords(db: Database, now: Date) {
  const auditCutoff = new Date(now);
  auditCutoff.setUTCFullYear(auditCutoff.getUTCFullYear() - OPERATOR_AUDIT_RETENTION_YEARS);
  const audits = await db
    .delete(operatorAuditLog)
    .where(lt(operatorAuditLog.createdAt, auditCutoff))
    .returning({ id: operatorAuditLog.id });
  const requests = await db
    .delete(operatorRequests)
    .where(lt(operatorRequests.createdAt, new Date(now.getTime() - OPERATOR_REQUEST_RETENTION_MS)))
    .returning({ id: operatorRequests.requestId });
  return { operatorAuditDeleted: audits.length, operatorRequestsDeleted: requests.length };
}
