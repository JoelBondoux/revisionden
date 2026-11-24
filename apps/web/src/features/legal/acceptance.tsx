import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { defaultBaseUrl } from '../../api/ApiContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Sheet } from '../../components/Sheet';
import { Markdown } from './Markdown';
import { usePolicyLibrary } from './PolicyLibraryContext';
import './legal.css';

/** The policies a parent confirms (docs/LEGAL.md): the version is stored, nothing else. */
export const POLICIES_TO_ACCEPT = ['privacy-notice', 'terms-of-use'] as const;
export type AcceptedPolicy = (typeof POLICIES_TO_ACCEPT)[number];

const acceptanceSchema = z.object({
  policy: z.string(),
  version: z.string(),
  acceptedAt: z.string(),
});
export type Acceptance = z.infer<typeof acceptanceSchema>;

export interface LegalApi {
  list(): Promise<Acceptance[]>;
  accept(list: { policy: AcceptedPolicy; version: string }[]): Promise<Acceptance[]>;
}

/** Client for GET and PUT /v1/policy-acceptances (parent session cookie). */
export function createLegalApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): LegalApi {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  const schema = z.object({ acceptances: acceptanceSchema.array() });
  async function send(init?: RequestInit) {
    const res = await fetch(new URL('v1/policy-acceptances', root), {
      credentials: 'include',
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`The server replied with ${res.status}.`);
    return schema.parse(await res.json()).acceptances;
  }
  return {
    list: () => send(),
    accept: (acceptances) => send({ method: 'PUT', body: JSON.stringify({ acceptances }) }),
  };
}

const Context = createContext<LegalApi>(
  createLegalApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);
export const LegalApiProvider = Context.Provider;
export const useLegalApi = () => useContext(Context);

export type AcceptanceStatus =
  { kind: 'ok' } | { kind: 'first' } | { kind: 'changed'; policies: AcceptedPolicy[] };

/** Compares stored versions with the policies in this build. */
export function acceptanceStatus(
  accepted: Acceptance[],
  current: Partial<Record<AcceptedPolicy, string>>,
): AcceptanceStatus {
  const relevant = POLICIES_TO_ACCEPT.filter((p) => current[p] !== undefined);
  if (relevant.length === 0) return { kind: 'ok' };
  const stored = new Map(accepted.map((a) => [a.policy, a.version]));
  if (!relevant.some((p) => stored.has(p))) return { kind: 'first' };
  const changed = relevant.filter((p) => stored.get(p) !== current[p]);
  return changed.length ? { kind: 'changed', policies: changed } : { kind: 'ok' };
}

/**
 * Wraps parent screens: a new parent confirms the terms and privacy notice once (versions
 * stored); after a policy changes, a sheet shows what changed and asks them to confirm.
 * If the check cannot be made (offline, API down), the screen is shown anyway.
 */
export function PolicyGate({ children }: { children: ReactNode }) {
  const api = useLegalApi();
  const library = usePolicyLibrary();
  const [status, setStatus] = useState<AcceptanceStatus | 'loading'>('loading');
  const [ticked, setTicked] = useState(false);
  const [error, setError] = useState<string>();

  const current = useMemo(() => {
    const versions: Partial<Record<AcceptedPolicy, string>> = {};
    for (const p of POLICIES_TO_ACCEPT) {
      const version = library.version(p);
      if (version) versions[p] = version;
    }
    return versions;
  }, [library]);

  useEffect(() => {
    let live = true;
    api.list().then(
      (accepted) => live && setStatus(acceptanceStatus(accepted, current)),
      () => live && setStatus({ kind: 'ok' }),
    );
    return () => {
      live = false;
    };
  }, [api, current]);

  const accept = useCallback(
    async (policies: AcceptedPolicy[]) => {
      setError(undefined);
      try {
        await api.accept(policies.map((policy) => ({ policy, version: current[policy]! })));
        setStatus({ kind: 'ok' });
      } catch {
        setError('Could not save your confirmation. Please try again.');
      }
    },
    [api, current],
  );

  if (status === 'loading') return <p aria-live="polite">Loading…</p>;

  if (status.kind === 'first') {
    const policies = POLICIES_TO_ACCEPT.filter((p) => current[p]);
    return (
      <div className="stack">
        <h1>Before you start</h1>
        <Card>
          <p>
            Please read how RevisionDen works and how we look after your family&apos;s data. Both
            start with a short summary in plain English.
          </p>
          <label className="legal-check">
            <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
            <span>
              I have read the <Link to="/legal/terms-of-use">Terms of use</Link> and{' '}
              <Link to="/legal/privacy-notice">Privacy notice</Link>
            </span>
          </label>
        </Card>
        {error && (
          <p role="alert" className="field__error">
            {error}
          </p>
        )}
        <Button block disabled={!ticked} onClick={() => void accept(policies)}>
          Continue
        </Button>
      </div>
    );
  }

  const changed = status.kind === 'changed' ? status.policies : [];
  const titles = changed.map((p) => library.get(p)?.title ?? p);
  return (
    <>
      {children}
      <Sheet
        open={changed.length > 0}
        title={`We've updated our ${titles.join(' and ')}`}
        onClose={() => setStatus({ kind: 'ok' })}
      >
        <div className="stack">
          {changed.map((p) => (
            <div key={p}>
              <p>
                <Link to={`/legal/${p}`}>Read the {library.get(p)?.title ?? p}</Link>
              </p>
              <Markdown text={library.get(p)?.changes ?? ''} headingOffset={2} />
            </div>
          ))}
          {error && (
            <p role="alert" className="field__error">
              {error}
            </p>
          )}
          <Button block onClick={() => void accept(changed)}>
            Confirm
          </Button>
        </div>
      </Sheet>
    </>
  );
}
