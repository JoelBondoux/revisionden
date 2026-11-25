import { createContext, useContext } from 'react';
import { z } from 'zod';
import { defaultBaseUrl } from '../../api/ApiContext';

/** A failed request, with the server's own code and message. */
export class ParentsApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly ref?: string,
  ) {
    super(message);
    this.name = 'ParentsApiError';
  }
}

const parentsSchema = z.object({
  parents: z.array(
    z.object({ position: z.number(), label: z.string(), you: z.boolean(), joinedAt: z.string() }),
  ),
  canInvite: z.boolean(),
  deletionRequest: z
    .object({ by: z.string().nullable(), byYou: z.boolean(), at: z.string() })
    .nullable(),
});
export type FamilyParents = z.infer<typeof parentsSchema>;

const inviteSchema = z.object({ code: z.string(), link: z.string(), expiresAt: z.string() });
export type ParentInvite = z.infer<typeof inviteSchema>;

const eventsSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      by: z.string().nullable(),
      you: z.boolean(),
      what: z.string(),
      important: z.boolean(),
      createdAt: z.string(),
      isNew: z.boolean(),
    }),
  ),
  newFromOtherParent: z.number(),
});
export type FamilyEvents = z.infer<typeof eventsSchema>;

const deletionSchema = z.object({ deleted: z.boolean(), waitingFor: z.string().optional() });
const noticeSchema = z.object({ removed: z.boolean(), removedAt: z.string().optional() });
const joinSchema = z.object({ familyId: z.string(), position: z.number() });

const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), ref: z.string().optional() }),
});

/** Two parents (B3): the parent-area calls under /v1/family and /v1/removal-notice. */
export interface ParentsApi {
  parents(): Promise<FamilyParents>;
  invite(): Promise<ParentInvite>;
  join(code: string): Promise<{ familyId: string; position: number }>;
  removeParent(position: number): Promise<void>;
  requestDeletion(): Promise<{ deleted: boolean; waitingFor?: string }>;
  cancelDeletion(): Promise<void>;
  events(): Promise<FamilyEvents>;
  markSeen(): Promise<void>;
  removalNotice(): Promise<{ removed: boolean; removedAt?: string }>;
  seenRemovalNotice(): Promise<void>;
}

export function createParentsApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): ParentsApi {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;

  async function call(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const res = await fetch(new URL(path, root), {
      method,
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      const parsed = errorSchema.safeParse(await res.json().catch(() => null));
      if (parsed.success) {
        const { code, message, ref } = parsed.data.error;
        throw new ParentsApiError(code, message, res.status, ref);
      }
      throw new ParentsApiError('http_error', `The server replied with ${res.status}.`, res.status);
    }
    return res.status === 204 ? null : res.json();
  }

  return {
    parents: async () => parentsSchema.parse(await call('v1/family/parents')),
    invite: async () => inviteSchema.parse(await call('v1/family/invites', 'POST', {})),
    join: async (code) => joinSchema.parse(await call('v1/family/join', 'POST', { code })),
    removeParent: async (position) => void (await call(`v1/family/parents/${position}`, 'DELETE')),
    requestDeletion: async () => deletionSchema.parse(await call('v1/family/deletion', 'POST', {})),
    cancelDeletion: async () => void (await call('v1/family/deletion', 'DELETE')),
    events: async () => eventsSchema.parse(await call('v1/family/events')),
    markSeen: async () => void (await call('v1/family/events/seen', 'POST', {})),
    removalNotice: async () => noticeSchema.parse(await call('v1/removal-notice')),
    seenRemovalNotice: async () => void (await call('v1/removal-notice/seen', 'POST', {})),
  };
}

const Context = createContext<ParentsApi>(
  createParentsApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);
export const ParentsApiProvider = Context.Provider;
export const useParentsApi = () => useContext(Context);

export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  });

export const messageOf = (err: unknown) =>
  err instanceof Error ? err.message : 'Something went wrong. Please try again.';
