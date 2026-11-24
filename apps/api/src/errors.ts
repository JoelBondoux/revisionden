import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { readableErrors, type ApiError as ApiErrorBody } from '@revisionden/core';

/** An error that becomes a JSON response in the shared shape (`ApiErrorSchema` in core). */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}

export const notFound = (message = 'Not found') => new ApiError(404, 'not_found', message);
export const unauthorized = () => new ApiError(401, 'unauthorized', 'Sign in to continue');

export function errorBody(code: string, message: string, details?: string[]): ApiErrorBody {
  return { error: details ? { code, message, details } : { code, message } };
}

export function errorResponse(c: Context, err: ApiError) {
  return c.json(errorBody(err.code, err.message, err.details), err.status);
}

export function handleError(err: Error, c: Context) {
  if (err instanceof ApiError) return errorResponse(c, err);
  if (err instanceof z.ZodError) {
    return errorResponse(
      c,
      new ApiError(400, 'invalid_request', 'The request is not valid', readableErrors(err)),
    );
  }
  console.error('Unhandled error', err);
  return errorResponse(c, new ApiError(500, 'internal_error', 'Something went wrong'));
}

/** Rewrites Better Auth's JSON errors ({ code, message }) into the shared error shape. */
export async function toSharedErrorShape(res: Response): Promise<Response> {
  if (res.status < 400 || !res.headers.get('content-type')?.includes('application/json')) {
    return res;
  }
  const original = (await res.clone().json()) as { code?: unknown; message?: unknown };
  const body = errorBody(
    typeof original.code === 'string' ? original.code.toLowerCase() : 'auth_error',
    typeof original.message === 'string' ? original.message : 'Sign-in failed',
  );
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify(body), { status: res.status, headers });
}
