import { createContext, useContext } from 'react';
import { z } from 'zod';
import { defaultBaseUrl } from '../../api/ApiContext';

const activitySchema = z.object({
  lastUsedAt: z.string(),
  deletedIfUnusedAfter: z.string(),
  warning: z.object({ unusedSince: z.string(), wouldHaveBeenDeletedOn: z.string() }).nullable(),
});
export type FamilyActivity = z.infer<typeof activitySchema>;

export interface FamilyDataApi {
  /** GET /v1/export: a JSON file of the family's data (the parent session cookie is sent). */
  exportUrl: string;
  /** GET /v1/family/activity: when the account was last used and any inactivity warning. */
  activity(): Promise<FamilyActivity>;
}

export function createFamilyDataApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): FamilyDataApi {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  return {
    exportUrl: new URL('v1/export', root).toString(),
    async activity() {
      const res = await fetch(new URL('v1/family/activity', root), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`The server replied with ${res.status}.`);
      return activitySchema.parse(await res.json());
    },
  };
}

const Context = createContext<FamilyDataApi>(
  createFamilyDataApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);
export const FamilyDataApiProvider = Context.Provider;
export const useFamilyDataApi = () => useContext(Context);
