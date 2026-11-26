import { failureRef } from '../../api/client';
import { z, type ZodType } from 'zod';
import {
  AvatarCodeSchema,
  DeviceListSchema,
  LinkStatusSchema,
  EnrolmentSchema,
  LinkTokenSchema,
  OnboardedChildSchema,
  OnboardingFamilySchema,
  StudentAvatarSchema,
  StudentSchema,
  type DeviceType,
  type LinkedDevice,
  type LinkKind,
  type LinkStatus,
  StudentSubjectsSchema,
  ParentSubjectsSchema,
  type AddSubjectRequest,
  type ParentSubject,
  type Enrolment,
  type LinkToken,
  type OnboardChildRequest,
  type OnboardedChild,
  type OnboardingFamily,
  type Student,
  type StudentAvatar,
  type StudentSubjects,
  type UpdateSubjectChoiceRequest,
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

const linkDoneSchema = z.object({
  deviceId: z.string(),
  deviceMarker: z.string().optional(),
  student: StudentSchema,
});

const unlockStartSchema = z.object({ challengeId: z.string(), options: z.record(z.unknown()) });
export type UnlockStart = z.infer<typeof unlockStartSchema>;
const unlockDoneSchema = z.object({ student: StudentSchema, deviceMarker: z.string().optional() });

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
  }): Promise<{ deviceId: string; deviceMarker?: string; student: Student }>;
  /** Starts a passkey unlock; no credential ids, so any RevisionDen passkey here can answer. */
  unlockOptions(): Promise<UnlockStart>;
  /** Checks the passkey's answer and starts a new 12-hour student session. */
  unlockVerify(input: {
    challengeId: string;
    response: unknown;
    /** The marker this browser keeps for its device (I5b), if it has one. */
    deviceMarker?: string;
  }): Promise<{ student: Student; deviceMarker?: string }>;
  /** Parent: set a child's board or tier, for example after Not sure. */
  updateChildSubject(
    studentId: string,
    subjectId: string,
    change: UpdateSubjectChoiceRequest,
  ): Promise<Enrolment>;
  /** Student device: their own subjects and how many are left to check. */
  /** Parent: a child's subjects, each saying whether questions are ready yet (E5). */
  getChildSubjects(studentId: string): Promise<ParentSubject[]>;
  /** Parent: add a subject from the catalogue (same choices as onboarding). */
  addChildSubject(studentId: string, choice: AddSubjectRequest): Promise<Enrolment>;
  /** Parent: remove a subject. The child's progress is kept and comes back if re-added. */
  removeChildSubject(studentId: string, subjectId: string): Promise<void>;
  getMySubjects(): Promise<StudentSubjects>;
  /** Student device: turn a Not sure board or tier into a real one. */
  updateMySubject(subjectId: string, change: UpdateSubjectChoiceRequest): Promise<Enrolment>;
  getMyAvatar(): Promise<StudentAvatar>;
  saveMyAvatar(avatarCode: string): Promise<Student>;
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
    method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
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
    unlockOptions: () => request('v1/device/unlock/options', unlockStartSchema, {}),
    unlockVerify: (body) => request('v1/device/unlock/verify', unlockDoneSchema, body),
    updateChildSubject: (studentId, subjectId, change) =>
      request(
        `v1/students/${encodeURIComponent(studentId)}/enrolments/${encodeURIComponent(subjectId)}`,
        EnrolmentSchema,
        change,
        'PATCH',
      ),
    getChildSubjects: async (studentId) =>
      (await request(`v1/students/${encodeURIComponent(studentId)}/subjects`, ParentSubjectsSchema))
        .subjects,
    addChildSubject: (studentId, choice) =>
      request(`v1/students/${encodeURIComponent(studentId)}/subjects`, EnrolmentSchema, choice),
    removeChildSubject: async (studentId, subjectId) => {
      await request(
        `v1/students/${encodeURIComponent(studentId)}/subjects/${encodeURIComponent(subjectId)}`,
        z.unknown(),
        undefined,
        'DELETE',
      );
    },
    getMySubjects: () => request('v1/student/subjects', StudentSubjectsSchema),
    updateMySubject: (subjectId, change) =>
      request(
        `v1/student/subjects/${encodeURIComponent(subjectId)}`,
        EnrolmentSchema,
        change,
        'PATCH',
      ),
    getMyAvatar: () => request('v1/student/avatar', StudentAvatarSchema),
    saveMyAvatar: (avatarCode) =>
      request('v1/student/avatar', StudentSchema, { avatarCode }, 'PUT'),
  };
}
