import { createContext, useContext } from 'react';
import { failureRef } from '../../api/client';
import { z, type ZodType } from 'zod';
import { defaultBaseUrl } from '../../api/ApiContext';
import type { DeviceDetails } from './details';

export const FEEDBACK_KINDS = ['bug', 'idea', 'confusing', 'other'] as const;
export const FEEDBACK_STATUSES = ['new', 'looking_into_it', 'fixed', 'will_not_fix'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type Sender = 'student' | 'parent';

// TODO(workstream C): use the shared schemas from packages/core once they exist.
const feedbackSchema = z.object({
  id: z.string(),
  kind: z.enum(FEEDBACK_KINDS),
  text: z.string().nullable(),
  status: z.enum(FEEDBACK_STATUSES),
  senderRole: z.enum(['student', 'parent']),
  studentNickname: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const triageSchema = feedbackSchema.extend({
  device: z.record(z.string(), z.unknown()).nullable(),
});
export type Feedback = z.infer<typeof feedbackSchema>;
export type TriageFeedback = z.infer<typeof triageSchema>;

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
}

const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

/** Client for the feedback routes (apps/api/src/feedback). Sends the session cookies. */
export function createFeedbackApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): FeedbackApi {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;

  async function request<T>(path: string, schema: ZodType<T>, init: RequestInit = {}): Promise<T> {
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
    listAll: async () =>
      (await request('admin/feedback', z.object({ feedback: triageSchema.array() }))).feedback,
    setStatus: (id, status) =>
      request(`admin/feedback/${encodeURIComponent(id)}`, triageSchema, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
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
export const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: 'Bug',
  idea: 'Idea',
  confusing: 'Something confusing',
  other: 'Other',
};
export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  looking_into_it: 'Looking into it',
  fixed: 'Fixed',
  will_not_fix: "Won't fix",
};
