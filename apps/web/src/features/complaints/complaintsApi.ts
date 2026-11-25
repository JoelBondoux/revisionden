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
  outcome: z.string().nullable(),
  messages: z.array(
    z.object({ from: z.enum(['family', 'operator']), body: z.string(), createdAt: z.string() }),
  ),
});
export type Complaint = z.infer<typeof complaintSchema>;

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
  create(body: { summary: string; aboutPersonalData: boolean }): Promise<z.infer<typeof created>>;
  addMessage(id: string, text: string): Promise<void>;
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
    const body: unknown =
      res.status === 201 && path.endsWith('/messages')
        ? undefined
        : await res.json().catch(() => undefined);
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
  };
}

export const defaultComplaintsApi = () =>
  createComplaintsApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) });
