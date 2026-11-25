import { supportEmail } from './supportEmail';

/** A policy file from docs/legal, split into its parts (layout in docs/LEGAL.md). */
export interface Policy {
  title: string;
  version: string;
  effectiveDate: string;
  plainEnglish: string;
  fullText: string;
  changes: string;
}

/** Build variables that fill the placeholders in the policy text. */
export interface PolicyEnv {
  VITE_OPERATOR_NAME?: string;
  VITE_CONTACT_EMAIL?: string;
  VITE_POSTAL_ADDRESS?: string;
  VITE_POLICY_EFFECTIVE_DATE?: string;
  VITE_SUPPORT_EMAIL?: string;
}

export const MISSING_CONTACT = 'contact details to be added';
export const MISSING_DATE = 'date to be added';

const SECTIONS = {
  'in plain english': 'plainEnglish',
  'full text': 'fullText',
  changes: 'changes',
} as const;

export function parsePolicy(markdown: string): Policy {
  const policy: Policy = {
    title: markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? '',
    version: markdown.match(/^Version:\s*(.+)$/m)?.[1]?.trim() ?? '',
    effectiveDate: markdown.match(/^Effective date:\s*(.+)$/m)?.[1]?.trim() ?? '',
    plainEnglish: '',
    fullText: '',
    changes: '',
  };
  let current: keyof typeof SECTIONS | null = null;
  const lines: Record<string, string[]> = { plainEnglish: [], fullText: [], changes: [] };
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      const key = heading[1]!.trim().toLowerCase();
      current = key in SECTIONS ? (key as keyof typeof SECTIONS) : null;
      continue;
    }
    if (current) lines[SECTIONS[current]]!.push(line);
  }
  policy.plainEnglish = lines.plainEnglish!.join('\n').trim();
  policy.fullText = lines.fullText!.join('\n').trim();
  policy.changes = lines.changes!.join('\n').trim();
  return policy;
}

const value = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

/**
 * Replaces {{OPERATOR_NAME}}, {{CONTACT_EMAIL}}, {{POSTAL_ADDRESS}}, {{EFFECTIVE_DATE}} and
 * {{SUPPORT_EMAIL}} (help@revisionden.com unless VITE_SUPPORT_EMAIL is set).
 */
export function fillPlaceholders(text: string, env: PolicyEnv): string {
  const values: Record<string, string> = {
    OPERATOR_NAME: value(env.VITE_OPERATOR_NAME, MISSING_CONTACT),
    CONTACT_EMAIL: value(env.VITE_CONTACT_EMAIL, MISSING_CONTACT),
    POSTAL_ADDRESS: value(env.VITE_POSTAL_ADDRESS, MISSING_CONTACT),
    EFFECTIVE_DATE: value(env.VITE_POLICY_EFFECTIVE_DATE, MISSING_DATE),
    SUPPORT_EMAIL: supportEmail(env.VITE_SUPPORT_EMAIL),
  };
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, name: string) => values[name] ?? match);
}
