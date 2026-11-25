import { z } from 'zod';
import { defaultBaseUrl } from '../../api/ApiContext';

/** A parent's complaint as the API sends it (`GET /v1/complaints`, workstream O4). */
const complaintSchema = z.object({
  id: z.string(),
  status: z.enum(['new', 'acknowledged', 'resolved', 'escalated']),
  summary: z.string(),
  aboutPersonalData: z.boolean(),
  receivedAt: z.string(),
  acknowledgeDueAt: z.string(),
  resolveDueAt: z.string(),
  acknowledgedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  /** From when a parent can ask for a manager to review it (5 working days after acknowledgement). */
  escalationFrom: z.string().nullable().default(null),
  outcome: z.string().nullable(),
  messages: z.array(
    z.object({ from: z.enum(['family', 'operator']), body: z.string(), createdAt: z.string() }),
  ),
});
export type Complaint = z.infer<typeof complaintSchema>;

/** A child asked their parents to raise something (`GET /v1/complaint-requests`). */
const requestSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  topic: z.string(),
  topicLabel: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type ComplaintRequest = z.infer<typeof requestSchema>;

const created = z.object({
  id: z.string(),
  acknowledgeDueAt: z.string(),
  resolveDueAt: z.string(),
});
const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export class ComplaintsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ComplaintsApiError';
  }
}

export interface ComplaintsApi {
  list(): Promise<Complaint[]>;
  create(body: {
    summary: string;
    aboutPersonalData: boolean;
    fromRequestId?: string;
  }): Promise<z.infer<typeof created>>;
  addMessage(id: string, text: string): Promise<void>;
  escalate(id: string): Promise<void>;
  listRequests(): Promise<ComplaintRequest[]>;
  dismissRequest(id: string): Promise<void>;
}

export interface ComplaintRequestBody {
  topic: string;
  note?: string;
}

/** Client for `/v1/complaints` (apps/api/src/complaints). Sends the parent's session cookie. */
export function createComplaintsApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): ComplaintsApi {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(new URL(`v1/${path}`, root), {
        credentials: 'include',
        ...init,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      });
    } catch {
      throw new ComplaintsApiError(
        0,
        'network',
        'Could not reach RevisionDen. Check your connection.',
      );
    }
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const parsed = errorBody.safeParse(body);
      throw parsed.success
        ? new ComplaintsApiError(res.status, parsed.data.error.code, parsed.data.error.message)
        : new ComplaintsApiError(
            res.status,
            'http_error',
            'Something went wrong. Please try again.',
          );
    }
    return body;
  }

  return {
    list: async () =>
      z.object({ complaints: complaintSchema.array() }).parse(await request('complaints'))
        .complaints,
    create: async (body) =>
      created.parse(await request('complaints', { method: 'POST', body: JSON.stringify(body) })),
    addMessage: async (id, text) =>
      void (await request(`complaints/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      })),
    escalate: async (id) =>
      void (await request(`complaints/${encodeURIComponent(id)}/escalate`, {
        method: 'POST',
        body: '{}',
      })),
    listRequests: async () =>
      z.object({ requests: requestSchema.array() }).parse(await request('complaint-requests'))
        .requests,
    dismissRequest: async (id) =>
      void (await request(`complaint-requests/${encodeURIComponent(id)}`, { method: 'DELETE' })),
  };
}

/** Student: asks their parents to raise something (`POST /v1/student/complaint-requests`). */
export function createComplaintRequestSender(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): (body: ComplaintRequestBody) => Promise<void> {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  return async (body) => {
    let res: Response;
    try {
      res = await fetch(new URL('v1/student/complaint-requests', root), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ComplaintsApiError(
        0,
        'network',
        'Could not reach RevisionDen. Check your connection.',
      );
    }
    if (!res.ok) {
      const parsed = errorBody.safeParse(await res.json().catch(() => undefined));
      throw parsed.success
        ? new ComplaintsApiError(res.status, parsed.data.error.code, parsed.data.error.message)
        : new ComplaintsApiError(
            res.status,
            'http_error',
            'Something went wrong. Please try again.',
          );
    }
  };
}

export const defaultComplaintRequestSender = () =>
  createComplaintRequestSender({
    baseUrl: defaultBaseUrl(import.meta.env, window.location.origin),
  });

export const defaultComplaintsApi = () =>
  createComplaintsApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) });
