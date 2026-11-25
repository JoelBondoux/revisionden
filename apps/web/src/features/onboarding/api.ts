import { failureRef } from '../../api/client';
import { z, type ZodType } from 'zod';
import {
  AvatarCodeSchema,
  LinkTokenSchema,
  OnboardedChildSchema,
  OnboardingFamilySchema,
  StudentSchema,
  type LinkToken,
  type OnboardChildRequest,
  type OnboardedChild,
  type OnboardingFamily,
  type Student,
} from '@revisionden/core';

/** A failed onboarding request, with the server's own message when it sent one. */
export class OnboardingApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly details: string[] = [],
    /** Reference code shown to the user and logged on the server. */
    readonly ref?: string,
  ) {
    super(message);
    this.name = 'OnboardingApiError';
  }
}

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.string()).optional(),
  }),
});

const linkStartSchema = z.object({
  challengeId: z.string(),
  options: z.record(z.unknown()),
  student: z.object({ nickname: z.string(), avatarCode: AvatarCodeSchema }),
});
export type LinkStart = z.infer<typeof linkStartSchema>;

const linkDoneSchema = z.object({ deviceId: z.string(), student: StudentSchema });

const unlockStartSchema = z.object({ challengeId: z.string(), options: z.record(z.unknown()) });
export type UnlockStart = z.infer<typeof unlockStartSchema>;
const unlockDoneSchema = z.object({ student: StudentSchema });

export interface OnboardingApi {
  getFamily(): Promise<OnboardingFamily>;
  addChild(request: OnboardChildRequest): Promise<OnboardedChild>;
  createLinkToken(studentId: string): Promise<LinkToken>;
  redeemLink(input: { token: string; familyId: string }): Promise<LinkStart>;
  verifyLink(input: {
    challengeId: string;
    response: unknown;
  }): Promise<{ deviceId: string; student: Student }>;
  /** Starts a passkey unlock; no credential ids, so any RevisionDen passkey here can answer. */
  unlockOptions(): Promise<UnlockStart>;
  /** Checks the passkey's answer and starts a new 12-hour student session. */
  unlockVerify(input: { challengeId: string; response: unknown }): Promise<{ student: Student }>;
}

interface Options {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

/** Client for the onboarding, link-token and device-link API (workstream B routes). */
export function createOnboardingApi({
  baseUrl,
  fetch = (...args) => globalThis.fetch(...args),
}: Options): OnboardingApi {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  async function request<T>(path: string, schema: ZodType<T>, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, root), {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new OnboardingApiError(
        'network',
        'Could not reach RevisionDen. Check your connection and try again.',
      );
    }
    const json: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(json);
      const ref = failureRef({ baseUrl, fetch }, response, json);
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new OnboardingApiError(code, message, response.status, details, ref);
      }
      throw new OnboardingApiError(
        'http',
        'Something went wrong. Please try again.',
        response.status,
        [],
        ref,
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new OnboardingApiError(
        'schema',
        'Something went wrong. Please try again.',
        response.status,
        [],
        failureRef({ baseUrl, fetch }, response, json, 'schema'),
      );
    }
    return parsed.data;
  }

  return {
    getFamily: () => request('v1/onboarding/family', OnboardingFamilySchema),
    addChild: (body) => request('v1/onboarding/children', OnboardedChildSchema, body),
    createLinkToken: (studentId) =>
      request(`v1/students/${encodeURIComponent(studentId)}/link-tokens`, LinkTokenSchema, {}),
    redeemLink: (body) => request('v1/device/link', linkStartSchema, body),
    verifyLink: (body) => request('v1/device/link/verify', linkDoneSchema, body),
    unlockOptions: () => request('v1/device/unlock/options', unlockStartSchema, {}),
    unlockVerify: (body) => request('v1/device/unlock/verify', unlockDoneSchema, body),
  };
}
