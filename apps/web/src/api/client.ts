import type { ZodType } from 'zod';
import {
  ApiErrorSchema,
  ClientErrorReportSchema,
  OnboardingFamilySchema,
  makeErrorRef,
  maskIdsInPath,
  type OnboardingFamily,
} from '@revisionden/core';
import { reportPossiblyStale } from '../pwa/updates';
import {
  CardsDueSchema as cardsDueSchema,
  TopicMapSchema as topicMapSchema,
  type CardsDue,
  type TopicMap,
} from '@revisionden/core';

export type ApiErrorKind = 'network' | 'http' | 'schema';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    /** Short reference code (RD-XXXXXX) shown to the user and logged on the server. */
    readonly ref?: string,
    /** The API's error code, for example `unauthorized`. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  /** The signed-in parent's children (`GET /v1/onboarding/family`). */
  getFamily(): Promise<OnboardingFamily>;
  /** The student device's topic map (`GET /v1/student/map`, workstream F2). */
  getTopicMap(): Promise<TopicMap>;
  /** Flashcards due on the student device (`GET /v1/student/cards/due`, workstream F2). */
  getCardsDue(): Promise<CardsDue>;
}

export interface ClientOptions {
  /** The API's address, for example https://api-staging.revisionden.com. */
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  /** Randomness for reference codes; tests pass a fixed one. */
  random?: () => number;
}

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

/**
 * Sends `POST /v1/client-errors` for an error the API gave no reference code for, so the code
 * the user sees is in the server logs too. Best effort: a failure here is ignored.
 */
export function reportClientError(
  options: Pick<ClientOptions, 'baseUrl' | 'fetch'>,
  report: { ref: string; kind: 'http' | 'schema'; status?: number; url: URL },
): void {
  const body = ClientErrorReportSchema.safeParse({
    ref: report.ref,
    kind: report.kind,
    status: report.status,
    path: maskIdsInPath(report.url.pathname),
  });
  if (!body.success) return;
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  void fetch(new URL('v1/client-errors', withSlash(options.baseUrl)), {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body.data),
  }).catch(() => undefined);
}

/**
 * The reference code for a failed response: the API's own (`error.ref` in the body), or a new one
 * made here and reported to the API, for a response it did not shape (a gateway error page).
 */
export function failureRef(
  options: Pick<ClientOptions, 'baseUrl' | 'fetch' | 'random'>,
  response: Response,
  json: unknown,
  kind: 'http' | 'schema' = 'http',
): string {
  const body = ApiErrorSchema.safeParse(json);
  if (kind === 'http' && body.success && body.data.error.ref) return body.data.error.ref;
  const ref = makeErrorRef(options.random ?? Math.random);
  reportClientError(options, {
    ref,
    kind,
    status: response.status,
    url: new URL(response.url || 'http://unknown/'),
  });
  return ref;
}

/**
 * One JSON request to the API with the session cookie (parent or student device), the response
 * checked against its schema. Errors carry the API's reference code, or one made here and
 * reported to the API.
 */
export async function apiRequest<T>(
  options: ClientOptions,
  path: string,
  schema: ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const { baseUrl, random = Math.random } = options;
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const url = new URL(path, withSlash(baseUrl));
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('network', 'The request could not be sent.');
  }
  const json: unknown = await response.json().catch(() => undefined);
  const fail = (kind: 'http' | 'schema', message: string) => {
    const ref = makeErrorRef(random);
    reportClientError(options, { ref, kind, status: response.status, url });
    return new ApiError(kind, message, response.status, ref);
  };
  if (!response.ok) {
    const body = ApiErrorSchema.safeParse(json);
    // An unknown route may mean this copy of the app is older than the API: check for a new build.
    if (response.status === 404 && body.success && body.data.error.code === 'not_found') {
      reportPossiblyStale();
    }
    const message = `The server replied with ${response.status}.`;
    if (body.success && body.data.error.ref) {
      throw new ApiError(
        'http',
        message,
        response.status,
        body.data.error.ref,
        body.data.error.code,
      );
    }
    const error = fail('http', message);
    throw body.success
      ? new ApiError('http', message, response.status, error.ref, body.data.error.code)
      : error;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    reportPossiblyStale();
    throw fail('schema', `Unexpected response from ${url.pathname}.`);
  }
  return parsed.data;
}

/** Typed client for the core screens. Every response is checked against its schema. */
export function createApiClient(options: ClientOptions): ApiClient {
  return {
    getFamily: () => apiRequest(options, 'v1/onboarding/family', OnboardingFamilySchema),
    getTopicMap: () => apiRequest(options, 'v1/student/map', topicMapSchema),
    getCardsDue: () => apiRequest(options, 'v1/student/cards/due', cardsDueSchema),
  };
}
