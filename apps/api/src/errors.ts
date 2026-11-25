import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import {
  makeErrorRef,
  maskIdsInPath,
  readableErrors,
  type ApiError as ApiErrorBody,
} from '@revisionden/core';

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

export function errorBody(
  code: string,
  message: string,
  details?: string[],
  ref?: string,
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(ref ? { ref } : {}),
    },
  };
}

export function errorResponse(c: Context, err: ApiError, ref?: string) {
  return c.json(errorBody(err.code, err.message, err.details, ref), err.status);
}

/** One log line per error response. Never holds a message, body, id or email. */
export type ErrorLogLine = Record<string, string | number | undefined>;
export type ErrorLog = (line: ErrorLogLine) => void;

/** Workers logs: crashes as errors, everything else as warnings, one JSON line each. */
export const consoleErrorLog: ErrorLog = (line) => {
  const text = JSON.stringify(line);
  if (typeof line.status === 'number' && line.status >= 500) console.error(text);
  else console.warn(text);
};

export interface ErrorReportingOptions {
  random?: () => number;
  log?: ErrorLog;
}

/**
 * Every error response gets a short reference code (`RD-XXXXXX`) in its body, and the same code
 * is logged with the status, error code, method and the path with ids masked, so the owner can
 * find what a family saw. Messages are never logged: they can hold what the user typed.
 */
export function createErrorReporting({
  random = Math.random,
  log = consoleErrorLog,
}: ErrorReportingOptions = {}) {
  const record = (c: Context, status: number, code: string, error?: string) => {
    const ref = makeErrorRef(random);
    log({
      ref,
      status,
      code,
      method: c.req.method,
      path: maskIdsInPath(c.req.path),
      ...(error ? { error } : {}),
    });
    return ref;
  };

  function onError(err: Error, c: Context) {
    if (err instanceof ApiError) return errorResponse(c, err, record(c, err.status, err.code));
    if (err instanceof z.ZodError) {
      const invalid = new ApiError(
        400,
        'invalid_request',
        'The request is not valid',
        readableErrors(err),
      );
      return errorResponse(c, invalid, record(c, 400, invalid.code));
    }
    const internal = new ApiError(500, 'internal_error', 'Something went wrong');
    return errorResponse(c, internal, record(c, 500, internal.code, err.name || 'Error'));
  }

  /** Rewrites Better Auth's JSON errors ({ code, message }) into the shared error shape. */
  async function toSharedErrorShape(res: Response, c?: Context): Promise<Response> {
    if (res.status < 400 || !res.headers.get('content-type')?.includes('application/json')) {
      return res;
    }
    const original = (await res.clone().json()) as { code?: unknown; message?: unknown };
    const code = typeof original.code === 'string' ? original.code.toLowerCase() : 'auth_error';
    const body = errorBody(
      code,
      typeof original.message === 'string' ? original.message : 'Sign-in failed',
      undefined,
      c ? record(c, res.status, code) : undefined,
    );
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    return new Response(JSON.stringify(body), { status: res.status, headers });
  }

  return { onError, toSharedErrorShape, record };
}

const defaultReporting = createErrorReporting();

export const createErrorHandler = (options?: ErrorReportingOptions) =>
  createErrorReporting(options).onError;

export const handleError = defaultReporting.onError;

export const toSharedErrorShape = (res: Response) => defaultReporting.toSharedErrorShape(res);
