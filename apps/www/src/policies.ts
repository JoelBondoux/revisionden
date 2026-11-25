/**
 * The policies, read from docs/legal at build time (one source with the app; docs/LEGAL.md
 * gives the order and who each is for). Placeholders are filled as the app fills them.
 */
import type { PolicyEnv } from './config.ts';
import { renderMarkdown } from './markdown.ts';

export interface PolicySources {
  /** docs/LEGAL.md */
  index: string;
  /** docs/legal/*.md by file name */
  files: Record<string, string>;
}

export interface Policy {
  name: string;
  title: string;
  version: string;
  effectiveDate: string;
  /** No effective date yet: not in force (lead, 2026-11-25). */
  draft: boolean;
  audience: string;
  covers: string;
  plainEnglishHtml: string;
  fullTextHtml: string;
  changesHtml: string;
}

export const DRAFT_BANNER = 'Draft: not yet in force, being reviewed before launch.';
const MISSING_CONTACT = 'contact details to be added';
const MISSING_DATE = 'date to be added';
const DEFAULT_SUPPORT_EMAIL = 'help@revisionden.com';

/** Rows of the "The policies" table in docs/LEGAL.md: file, audience, what it covers. */
function policyList(index: string): { file: string; audience: string; covers: string }[] {
  const rows: { file: string; audience: string; covers: string }[] = [];
  for (const match of index.matchAll(/^\|\s*`([a-z0-9-]+\.md)`\s*\|([^|]+)\|([^|]+)\|/gm)) {
    rows.push({ file: match[1]!, audience: match[2]!.trim(), covers: match[3]!.trim() });
  }
  return rows;
}

function fill(text: string, env: PolicyEnv): string {
  const values: Record<string, string> = {
    OPERATOR_NAME: env.VITE_OPERATOR_NAME ?? MISSING_CONTACT,
    CONTACT_EMAIL: env.VITE_CONTACT_EMAIL ?? MISSING_CONTACT,
    POSTAL_ADDRESS: MISSING_CONTACT,
    EFFECTIVE_DATE: env.VITE_POLICY_EFFECTIVE_DATE ?? MISSING_DATE,
    SUPPORT_EMAIL: env.VITE_SUPPORT_EMAIL ?? DEFAULT_SUPPORT_EMAIL,
  };
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, name: string) => values[name] ?? match);
}

const SECTIONS: Record<string, 'plainEnglish' | 'fullText' | 'changes'> = {
  'in plain english': 'plainEnglish',
  'full text': 'fullText',
  changes: 'changes',
};

function sections(markdown: string) {
  const parts = { plainEnglish: [] as string[], fullText: [] as string[], changes: [] as string[] };
  let current: keyof typeof parts | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      current = SECTIONS[heading[1]!.trim().toLowerCase()] ?? null;
      continue;
    }
    if (current) parts[current].push(line);
  }
  return parts;
}

export function loadPolicies(sources: PolicySources, env: PolicyEnv): Policy[] {
  const list = policyList(sources.index);
  const listed = new Set(list.map((row) => row.file));
  const unlisted = Object.keys(sources.files).filter((file) => !listed.has(file));
  if (unlisted.length) throw new Error(`Not listed in docs/LEGAL.md: ${unlisted.join(', ')}`);
  return list.flatMap(({ file, audience, covers }) => {
    const raw = sources.files[file];
    if (raw === undefined) return [];
    const markdown = fill(raw, env);
    const parts = sections(markdown);
    return [
      {
        name: file.replace(/\.md$/, ''),
        title: markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? file,
        version: markdown.match(/^Version:\s*(.+)$/m)?.[1]?.trim() ?? '',
        effectiveDate: markdown.match(/^Effective date:\s*(.+)$/m)?.[1]?.trim() ?? MISSING_DATE,
        draft: !env.VITE_POLICY_EFFECTIVE_DATE,
        audience,
        covers,
        plainEnglishHtml: renderMarkdown(parts.plainEnglish.join('\n'), 0),
        fullTextHtml: renderMarkdown(parts.fullText.join('\n'), 0),
        changesHtml: renderMarkdown(parts.changes.join('\n'), 0),
      },
    ];
  });
}
