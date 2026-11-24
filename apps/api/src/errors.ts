import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

// TODO(workstream C): move to packages/core as the shared API error schema.
export const errorBodySchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ErrorBody = z.infer<typeof errorBodySchema>;

/** An error that becomes a JSON response in the shared error shape. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Not found') => new ApiError(404, 'not_found', message);
export const unauthorized = () => new ApiError(401, 'unauthorized', 'Sign in to continue');

export function errorResponse(c: Context, err: ApiError) {
  const body: ErrorBody = { error: err.code, message: err.message };
  if (err.details !== undefined) body.details = err.details;
  return c.json(body, err.status);
}

export function handleError(err: Error, c: Context) {
  if (err instanceof ApiError) return errorResponse(c, err);
  if (err instanceof z.ZodError) {
    return errorResponse(
      c,
      new ApiError(400, 'invalid_request', 'The request is not valid', z.treeifyError(err)),
    );
  }
  console.error('Unhandled error', err);
  return errorResponse(c, new ApiError(500, 'internal_error', 'Something went wrong'));
}
