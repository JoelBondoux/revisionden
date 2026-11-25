import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { defaultBaseUrl } from '../../api/ApiContext';

/** The family's programmes (`/v1/family/programmes`): only the beta programme is ever shown. */
export interface ProgrammesApi {
  get(): Promise<{ beta: boolean }>;
  leaveBeta(): Promise<void>;
}

export function createProgrammesApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): ProgrammesApi {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  const url = (path: string) => new URL(`v1/family/${path}`, root);
  return {
    get: async () => {
      const res = await fetch(url('programmes'), { credentials: 'include' });
      if (!res.ok) return { beta: false };
      return z.object({ beta: z.boolean() }).parse(await res.json());
    },
    leaveBeta: async () => {
      const res = await fetch(url('programmes/beta'), { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Could not leave the beta programme');
    },
  };
}

/** A small "Beta" badge for families in the beta programme, with a way to leave it. */
export function BetaBadge({ api: given }: { api?: ProgrammesApi }) {
  const api = useMemo(
    () =>
      given ??
      createProgrammesApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [given],
  );
  const [beta, setBeta] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .get()
      .then((p) => live && setBeta(p.beta))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [api]);

  if (!beta) return null;
  return (
    <p className="secondary-text">
      <Pill tone="primary">Beta</Pill> Your family is trying new features early.{' '}
      <Button
        onClick={async () => {
          try {
            await api.leaveBeta();
            setBeta(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        Leave the beta programme
      </Button>
      {failed && <span role="alert"> Something went wrong. Please try again.</span>}
    </p>
  );
}
