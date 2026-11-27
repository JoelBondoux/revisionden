import { createContext, useContext } from 'react';
import { ErrorReportSummarySchema, type ErrorReportSummary } from '@revisionden/core';
import { failureRef } from '../../api/client';
import { z, type ZodType, type ZodTypeDef } from 'zod';
import { defaultBaseUrl } from '../../api/ApiContext';
import type { DeviceDetails } from './details';

/** The kinds a person chooses in the feedback form. */
export const FEEDBACK_KINDS = ['bug', 'idea', 'confusing', 'other'] as const;
/** Every kind a list can show: also the one-tap "Did this help?" after an interactive lesson (W8). */
export const ALL_FEEDBACK_KINDS = [
  ...FEEDBACK_KINDS,
  'lesson_helped',
  'lesson_not_helped',
] as const;
export const FEEDBACK_STATUSES = ['new', 'looking_into_it', 'fixed', 'will_not_fix'] as const;
export const FEEDBACK_OUTCOMES = ['confirmed', 'duplicate', 'not_a_bug'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type AnyFeedbackKind = (typeof ALL_FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackOutcome = (typeof FEEDBACK_OUTCOMES)[number];
export type Sender = 'student' | 'parent';

// TODO(workstream C): use the shared schemas from packages/core once they exist.
const feedbackSchema = z.object({
  id: z.string(),
  kind: z.enum(ALL_FEEDBACK_KINDS),
  text: z.string().nullable(),
  status: z.enum(FEEDBACK_STATUSES),
  senderRole: z.enum(['student', 'parent']),
  studentNickname: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Bug Hunter (L7): set when the operator confirms a bug. Missing means not confirmed yet.
  outcome: z.enum(FEEDBACK_OUTCOMES).nullable().default(null),
  rewardXp: z.number().int().nonnegative().default(0),
  // Workstream O: replies from RevisionDen support (text and time only), oldest first.
  replies: z.array(z.object({ body: z.string(), createdAt: z.string() })).default([]),
});
const triageSchema = feedbackSchema.extend({
  device: z.record(z.string(), z.unknown()).nullable(),
  duplicateOf: z.string().nullable().default(null),
  // L13: sent from a tester account (no rewards, the bug button never rests).
  tester: z.boolean().default(false),
});
const rewardSchema = z.object({
  id: z.string(),
  outcome: z.enum(FEEDBACK_OUTCOMES),
  rewardXp: z.number().int().nonnegative(),
  message: z.string(),
  confirmedAt: z.string(),
});
const confirmSchema = z.object({ item: triageSchema, message: z.string() });
/** L13: the student's bug button, from the server (it rests after reports that were not bugs). */
const bugButtonSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('on') }),
  z.object({ state: z.literal('paused'), until: z.string() }),
  z.object({ state: z.literal('removed') }),
]);
export type BugButtonInfo = z.infer<typeof bugButtonSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type TriageFeedback = z.infer<typeof triageSchema>;
export type FeedbackReward = z.infer<typeof rewardSchema>;
export type ConfirmResult = z.infer<typeof confirmSchema>;

export interface FeedbackRequest {
  kind: FeedbackKind;
  text?: string;
  device?: DeviceDetails;
}

export class FeedbackApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Reference code shown to the user and logged on the server. */
    readonly ref?: string,
  ) {
    super(message);
    this.name = 'FeedbackApiError';
  }
}

export interface FeedbackApi {
  send(sender: Sender, request: FeedbackRequest): Promise<void>;
  listOwn(): Promise<Feedback[]>;
  listFamily(): Promise<Feedback[]>;
  listAll(): Promise<TriageFeedback[]>;
  setStatus(id: string, status: FeedbackStatus): Promise<TriageFeedback>;
  /** Operator: confirms a bug, or confirms it as a duplicate of an earlier confirmed one. */
  confirm(id: string, duplicateOf?: string): Promise<ConfirmResult>;
  /** Student: confirmed bug reports the student has not been told about yet. */
  listRewards(): Promise<FeedbackReward[]>;
  markRewardsSeen(ids: readonly string[]): Promise<void>;
  /** Operator only: error reports since a time, grouped (`GET /v1/admin/error-reports`). */
  errorReports(since?: string): Promise<ErrorReportSummary>;
  /** Student: whether the bug button is on, resting or removed (L13). */
  bugButton(): Promise<BugButtonInfo>;
  /** Operator: a bug report that is not a bug (closes it; three in 14 days rest the button). */
  markNotABug(id: string): Promise<TriageFeedback>;
  /** Parent: a child's bug button, and switching it back on. */
  childBugButton(studentId: string): Promise<BugButtonInfo>;
  switchChildBugButtonOn(studentId: string): Promise<BugButtonInfo>;
}

const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

/** Client for the feedback routes (apps/api/src/feedback). Sends the session cookies. */
export function createFeedbackApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): FeedbackApi {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;

  async function request<T>(
    path: string,
    schema: ZodType<T, ZodTypeDef, unknown>,
    init: RequestInit = {},
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(new URL(`v1/${path}`, root), {
        credentials: 'include',
        ...init,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      });
    } catch {
      throw new FeedbackApiError(
        0,
        'network',
        'Could not reach RevisionDen. Check your connection.',
      );
    }
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const parsed = errorBody.safeParse(body);
      const ref = failureRef(options, res, body);
      throw parsed.success
        ? new FeedbackApiError(res.status, parsed.data.error.code, parsed.data.error.message, ref)
        : new FeedbackApiError(
            res.status,
            'http_error',
            'Something went wrong. Please try again.',
            ref,
          );
    }
    return schema.parse(body);
  }

  const list = z.object({ feedback: feedbackSchema.array() });
  return {
    send: async (sender, body) =>
      void (await request(sender === 'student' ? 'student/feedback' : 'feedback', z.unknown(), {
        method: 'POST',
        body: JSON.stringify(body),
      })),
    listOwn: async () => (await request('student/feedback', list)).feedback,
    listFamily: async () => (await request('feedback', list)).feedback,
    errorReports: (since) =>
      request(
        `admin/error-reports${since ? `?since=${encodeURIComponent(since)}` : ''}`,
        ErrorReportSummarySchema,
      ),
    listAll: async () =>
      (await request('admin/feedback', z.object({ feedback: triageSchema.array() }))).feedback,
    setStatus: (id, status) =>
      request(`admin/feedback/${encodeURIComponent(id)}`, triageSchema, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    confirm: (id, duplicateOf) =>
      request(`admin/feedback/${encodeURIComponent(id)}/confirm`, confirmSchema, {
        method: 'POST',
        body: JSON.stringify(duplicateOf ? { duplicateOf } : {}),
      }),
    listRewards: async () =>
      (await request('student/feedback/rewards', z.object({ rewards: rewardSchema.array() })))
        .rewards,
    markRewardsSeen: async (ids) =>
      void (await request('student/feedback/rewards/seen', z.unknown(), {
        method: 'POST',
        body: JSON.stringify({ ids }),
      })),
    bugButton: () => request('student/bug-button', bugButtonSchema),
    markNotABug: async (id) =>
      (
        await request(
          `admin/feedback/${encodeURIComponent(id)}/not-a-bug`,
          z.object({ item: triageSchema }),
          { method: 'POST', body: '{}' },
        )
      ).item,
    childBugButton: (studentId) =>
      request(`students/${encodeURIComponent(studentId)}/bug-button`, bugButtonSchema),
    switchChildBugButtonOn: (studentId) =>
      request(`students/${encodeURIComponent(studentId)}/bug-button/on`, bugButtonSchema, {
        method: 'POST',
        body: '{}',
      }),
  };
}

const Context = createContext<FeedbackApi>(
  createFeedbackApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);

export const FeedbackApiProvider = Context.Provider;

export function useFeedbackApi(): FeedbackApi {
  return useContext(Context);
}

/** Plain words for each kind and status. */
export const KIND_LABELS: Record<AnyFeedbackKind, string> = {
  bug: 'Bug',
  idea: 'Idea',
  confusing: 'Something confusing',
  other: 'Other',
  lesson_helped: 'Interactive lesson: it helped',
  lesson_not_helped: "Interactive lesson: it didn't help",
};
export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  looking_into_it: 'Looking into it',
  fixed: 'Fixed',
  will_not_fix: "Won't fix",
};
export const OUTCOME_LABELS: Record<FeedbackOutcome, string> = {
  confirmed: 'Confirmed',
  duplicate: 'Duplicate',
  not_a_bug: 'Not a bug',
};
