import { failureRef } from '../../api/client';
import { z, type ZodType } from 'zod';
import {
  AvatarCodeSchema,
  DeviceListSchema,
  LinkStatusSchema,
  LinkTokenSchema,
  OnboardedChildSchema,
  OnboardingFamilySchema,
  StudentSchema,
  type DeviceType,
  type LinkedDevice,
  type LinkKind,
  type LinkStatus,
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

export interface OnboardingApi {
  getFamily(): Promise<OnboardingFamily>;
  addChild(request: OnboardChildRequest): Promise<OnboardedChild>;
  /** A QR code (10 minutes) or a link to send (24 hours); both come with a short code. */
  createLinkToken(studentId: string, kind?: LinkKind): Promise<LinkToken>;
  getLinkStatus(studentId: string, tokenId: string): Promise<LinkStatus>;
  cancelLink(studentId: string, tokenId: string): Promise<void>;
  listDevices(studentId: string): Promise<LinkedDevice[]>;
  removeDevice(studentId: string, deviceId: string): Promise<void>;
  redeemLink(input: { token: string; familyId: string } | { code: string }): Promise<LinkStart>;
  verifyLink(input: {
    challengeId: string;
    response: unknown;
    deviceType?: DeviceType;
  }): Promise<{ deviceId: string; student: Student }>;
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

  async function request<T>(
    path: string,
    schema: ZodType<T>,
    body?: unknown,
    method?: 'POST' | 'DELETE',
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, root), {
        method: method ?? (body === undefined ? 'GET' : 'POST'),
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
    createLinkToken: (studentId, kind = 'qr') =>
      request(`v1/students/${encodeURIComponent(studentId)}/link-tokens`, LinkTokenSchema, {
        kind,
      }),
    getLinkStatus: async (studentId, tokenId) =>
      (
        await request(
          `v1/students/${encodeURIComponent(studentId)}/link-tokens/${encodeURIComponent(tokenId)}`,
          LinkStatusSchema,
        )
      ).status,
    cancelLink: async (studentId, tokenId) => {
      await request(
        `v1/students/${encodeURIComponent(studentId)}/link-tokens/${encodeURIComponent(tokenId)}`,
        z.unknown(),
        undefined,
        'DELETE',
      );
    },
    listDevices: async (studentId) =>
      (await request(`v1/students/${encodeURIComponent(studentId)}/devices`, DeviceListSchema))
        .devices,
    removeDevice: async (studentId, deviceId) => {
      await request(
        `v1/students/${encodeURIComponent(studentId)}/devices/${encodeURIComponent(deviceId)}`,
        z.unknown(),
        undefined,
        'DELETE',
      );
    },
    redeemLink: (body) => request('v1/device/link', linkStartSchema, body),
    verifyLink: (body) => request('v1/device/link/verify', linkDoneSchema, body),
  };
}
