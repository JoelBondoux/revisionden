import type { Context } from 'hono';
import type { z } from 'zod';
import { ApiError } from './errors';

/** Reads and validates a JSON body; bad JSON is a 400, not a 500. */
export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body must be JSON');
  }
  return schema.parse(body);
}

/** True when a database error is a unique-constraint violation on the named constraint. */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  for (let e = err as { code?: string; constraint?: string; cause?: unknown } | undefined; e;) {
    if (e.code === '23505' && e.constraint === constraint) return true;
    e = e.cause as typeof e;
  }
  return false;
}
