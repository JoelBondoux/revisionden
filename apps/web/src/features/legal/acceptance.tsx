import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { z } from 'zod';
import { defaultBaseUrl } from '../../api/ApiContext';
import { Button } from '../../components/Button';
import { LinkButton } from '../../components/links';
import { Sheet } from '../../components/Sheet';
import { BeforeYouStart } from './BeforeYouStart';
import { Markdown } from './Markdown';
import { changesSince } from './policyChanges';
import { deviceStorage, isSnoozed, snooze, type SnoozeStorage } from './policyNoticeSnooze';
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
  | { kind: 'ok' }
  | { kind: 'first' }
  | {
      kind: 'changed';
      policies: AcceptedPolicy[];
      /** The version this parent last accepted, per policy. */
      accepted: Partial<Record<AcceptedPolicy, string>>;
    };

/**
 * Compares stored versions with the policies in this build. A policy this parent never accepted
 * goes through the normal first confirmation, even if they accepted another one before.
 */
export function acceptanceStatus(
  accepted: Acceptance[],
  current: Partial<Record<AcceptedPolicy, string>>,
): AcceptanceStatus {
  const relevant = POLICIES_TO_ACCEPT.filter((p) => current[p] !== undefined);
  if (relevant.length === 0) return { kind: 'ok' };
  const stored = new Map(accepted.map((a) => [a.policy, a.version]));
  if (!relevant.every((p) => stored.has(p))) return { kind: 'first' };
  const changed = relevant.filter((p) => stored.get(p) !== current[p]);
  if (!changed.length) return { kind: 'ok' };
  const versions = Object.fromEntries(relevant.map((p) => [p, stored.get(p)!]));
  return { kind: 'changed', policies: changed, accepted: versions };
}

/**
 * Wraps parent screens: a new parent confirms the terms and privacy notice once (versions
 * stored); after a policy changes, a sheet shows only the Changes lines newer than the version
 * this parent accepted, per policy. "I've read the changes" stores
 * the new versions for this parent; closing it hides it on this device for 24 hours (those
 * versions only). If the check cannot be made (offline, API down), the screen is shown anyway.
 */
export function PolicyGate({
  children,
  storage = deviceStorage(),
  now = Date.now,
}: {
  children: ReactNode;
  /** Where a closed notice is remembered (this device's local storage by default). */
  storage?: SnoozeStorage;
  now?: () => number;
}) {
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
      (accepted) => {
        if (!live) return;
        const next = acceptanceStatus(accepted, current);
        const closed =
          next.kind === 'changed' && isSnoozed(storage, versionsOf(next.policies), now());
        setStatus(closed ? { kind: 'ok' } : next);
      },
      () => live && setStatus({ kind: 'ok' }),
    );
    return () => {
      live = false;
    };
    // storage and now are fixed for the life of the gate.
  }, [api, current]);

  const versionsOf = (policies: AcceptedPolicy[]) =>
    Object.fromEntries(policies.map((p) => [p, current[p]!]));

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
    // Shown in the order the checkbox names them; versions are stored exactly as before.
    const shown = [...policies].reverse().flatMap((name) => {
      const policy = library.get(name);
      return policy ? [{ ...policy, name }] : [];
    });
    return (
      <BeforeYouStart
        policies={shown}
        ticked={ticked}
        onTick={setTicked}
        error={error}
        onContinue={() => void accept(policies)}
      />
    );
  }

  const changed = status.kind === 'changed' ? status.policies : [];
  // Each changed policy with its lines since this parent's version; none left means nothing to show.
  const updates = changed.flatMap((name) => {
    const policy = library.get(name);
    const since = status.kind === 'changed' ? status.accepted[name] : undefined;
    const lines = policy && since ? changesSince(policy.changes, since) : [];
    return policy && lines.length ? [{ name, title: policy.title, lines }] : [];
  });
  const titles = updates.map((u) => u.title);
  return (
    <>
      {children}
      <Sheet
        open={updates.length > 0}
        title={`We've updated our ${titles.join(' and ')}`}
        onClose={() => {
          snooze(storage, versionsOf(changed), now());
          setStatus({ kind: 'ok' });
        }}
      >
        <div className="stack">
          {updates.map((u) => (
            <section key={u.name} aria-labelledby={`policy-update-${u.name}`}>
              <h3 id={`policy-update-${u.name}`}>
                {u.title}, version {current[u.name]}
              </h3>
              <Markdown
                text={u.lines.map((l) => `- ${l.version}: ${l.text}`).join('\n')}
                headingOffset={2}
              />
              <p>
                <LinkButton to={`/legal/${u.name}`} variant="secondary">
                  Read the {u.title}
                </LinkButton>
              </p>
            </section>
          ))}
          {error && (
            <p role="alert" className="field__error">
              {error}
            </p>
          )}
          <Button block onClick={() => void accept(changed)}>
            I&apos;ve read the changes
          </Button>
        </div>
      </Sheet>
    </>
  );
}
