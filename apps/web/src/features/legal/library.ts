import { fillPlaceholders, parsePolicy, type Policy, type PolicyEnv } from './policy';

export interface PolicyInfo {
  name: string;
  /** Who the policy is mainly for, in plain words (docs/LEGAL.md). */
  audience: string;
  /** What it covers, in a few plain words. */
  summary: string;
}

/** The policies listed in docs/LEGAL.md, in the same order. */
export const POLICIES: PolicyInfo[] = [
  {
    name: 'privacy-notice',
    audience: 'Parents and carers',
    summary: 'What we collect, why, and your rights',
  },
  {
    name: 'privacy-for-young-people',
    audience: 'Students',
    summary: 'Your privacy, explained for you',
  },
  { name: 'data-retention', audience: 'Everyone', summary: 'How long we keep each kind of data' },
  { name: 'processors', audience: 'Everyone', summary: 'The services that handle data for us' },
  {
    name: 'cookies-and-storage',
    audience: 'Everyone',
    summary: 'Cookies and what is kept on your device',
  },
  {
    name: 'terms-of-use',
    audience: 'Parents and students',
    summary: 'The agreement for using the app',
  },
  {
    name: 'acceptable-use',
    audience: 'Students and parents',
    summary: 'Rules for nicknames, friends and feedback',
  },
  { name: 'ai-and-marking', audience: 'Everyone', summary: 'Where AI is used and its limits' },
  {
    name: 'content-accuracy',
    audience: 'Everyone',
    summary: 'How questions are checked, and reporting mistakes',
  },
  {
    name: 'accessibility-statement',
    audience: 'Everyone',
    summary: 'How we make the app work for everyone',
  },
  {
    name: 'childrens-code',
    audience: 'Parents and reviewers',
    summary: "How we meet the ICO Children's Code",
  },
  {
    name: 'complaints-policy',
    audience: 'Parents and carers',
    summary: 'How to make a complaint and what happens next',
  },
];

export interface PolicyLibrary {
  get(name: string): (Policy & PolicyInfo) | undefined;
  version(name: string): string | undefined;
  available(): (Policy & PolicyInfo)[];
}

/** Builds the policy library from raw files keyed by path (as import.meta.glob gives them). */
export function createPolicyLibrary(files: Record<string, string>, env: PolicyEnv): PolicyLibrary {
  const byName = new Map<string, string>();
  for (const [path, text] of Object.entries(files)) {
    const name = path.split('/').pop()!.replace(/\.md$/, '');
    byName.set(name, text);
  }
  const get = (name: string) => {
    const info = POLICIES.find((p) => p.name === name);
    const raw = byName.get(name);
    if (!info || raw === undefined) return undefined;
    return { ...info, ...parsePolicy(fillPlaceholders(raw, env)) };
  };
  return {
    get,
    version: (name) => get(name)?.version,
    available: () => POLICIES.flatMap((p) => get(p.name) ?? []),
  };
}
