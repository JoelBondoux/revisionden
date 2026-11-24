import { createContext, useContext } from 'react';
import { z, type ZodType } from 'zod';
import { defaultBaseUrl } from '../../api/ApiContext';
import { ApiError } from '../../api/client';

const role = z.enum(['subject-specialist', 'content-lead', 'parent-reviewer']);
export type ReviewerRole = z.infer<typeof role>;

export const REASON_LABELS: Record<string, string> = {
  wrong_answer: 'Wrong answer',
  wrong_explanation: 'Wrong explanation',
  unclear: 'Unclear',
  typo: 'Typo',
  not_on_my_course: 'Not on my course',
  other: 'Other',
};

const reportSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  itemVersion: z.number(),
  reason: z.string(),
  reportedBy: z.enum(['student', 'parent']),
  status: z.enum(['open', 'no_error', 'confirmed_error']),
  reportedAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedByRole: role.nullable(),
  decisionNotes: z.string().nullable(),
});
export type ItemReport = z.infer<typeof reportSchema>;

const batchStatus = z.enum(['in_review', 'passed', 'failed']);
export type BatchStatus = z.infer<typeof batchStatus>;

const batchSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: batchStatus,
  createdAt: z.string(),
  size: z.number(),
  sampleSize: z.number(),
  decided: z.number(),
});
export type BatchSummary = z.infer<typeof batchSummarySchema>;

const sampledItemSchema = z.object({
  itemId: z.string(),
  itemVersion: z.number(),
  needsHumanApproval: z.boolean(),
  snapshot: z.record(z.unknown()),
  decision: z.enum(['approved', 'confirmed_error']).nullable(),
  decidedByRole: role.nullable(),
  decisionNotes: z.string().nullable(),
  decidedAt: z.string().nullable(),
});
export type SampledItem = z.infer<typeof sampledItemSchema>;

const batchSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: batchStatus,
  sampleSeed: z.number(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  items: z.array(sampledItemSchema),
});
export type Batch = z.infer<typeof batchSchema>;

export type ReportDecision = 'no_error' | 'confirmed_error';
export type ItemDecision = 'approved' | 'confirmed_error';

export interface ReviewClient {
  me(): Promise<{ role: ReviewerRole }>;
  openReports(): Promise<ItemReport[]>;
  decideReport(id: string, decision: ReportDecision, notes?: string): Promise<void>;
  batches(): Promise<BatchSummary[]>;
  batch(id: string): Promise<Batch>;
  decideItem(
    batchId: string,
    itemId: string,
    decision: ItemDecision,
    notes?: string,
  ): Promise<{ status: BatchStatus }>;
}

/** Client for the reviewer routes (/v1/review). Responses are checked before use. */
export function createReviewClient({
  baseUrl,
  fetch = (...args) => globalThis.fetch(...args),
}: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): ReviewClient {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  async function request<T>(path: string, schema: ZodType<T>, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(new URL(`v1/review/${path}`, root), {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('network', 'The request could not be sent.');
    }
    if (!res.ok) throw new ApiError('http', `The server replied with ${res.status}.`, res.status);
    const parsed = schema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw new ApiError('schema', `Unexpected response from ${path}.`);
    return parsed.data;
  }
  const withNotes = (decision: string, notes?: string) =>
    notes ? { decision, notes } : { decision };
  const id = encodeURIComponent;
  return {
    me: () => request('me', z.object({ role })),
    openReports: async () =>
      (await request('reports?status=open', z.object({ reports: z.array(reportSchema) }))).reports,
    decideReport: async (reportId, decision, notes) => {
      await request(
        `reports/${id(reportId)}/decision`,
        z.object({}).passthrough(),
        withNotes(decision, notes),
      );
    },
    batches: async () =>
      (await request('batches', z.object({ batches: z.array(batchSummarySchema) }))).batches,
    batch: (batchId) => request(`batches/${id(batchId)}`, batchSchema),
    decideItem: (batchId, itemId, decision, notes) =>
      request(
        `batches/${id(batchId)}/items/${id(itemId)}/decision`,
        z.object({ status: batchStatus }),
        withNotes(decision, notes),
      ),
  };
}

const ReviewClientContext = createContext<ReviewClient | null>(null);
export const ReviewClientProvider = ReviewClientContext.Provider;

let fallback: ReviewClient | null = null;
/** The review client from context, or one for the default API address. */
export function useReviewClient(): ReviewClient {
  const fromContext = useContext(ReviewClientContext);
  fallback ??= createReviewClient({
    baseUrl: defaultBaseUrl(import.meta.env, window.location.origin),
  });
  return fromContext ?? fallback;
}
