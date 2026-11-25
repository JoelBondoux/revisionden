import raw from '../../../../../content/support/uk-services.json';

/**
 * The UK support services behind the Get help page (docs/PRODUCT_RULES.md, Get help). The data is
 * built into the app (no request is made to show it), so the page works offline. Every detail is
 * checked against the service's own site: `pnpm content:validate` fails on a missing source or a
 * check older than 4 months.
 */
export type Audience = 'student' | 'parent';

export interface SourcedText {
  text: string;
  source: string;
}

export type Contact =
  | {
      kind: 'phone';
      label?: string;
      number: string;
      href: string;
      hours?: SourcedText;
      source: string;
    }
  | {
      kind: 'text';
      label?: string;
      number: string;
      keyword?: string;
      href: string;
      hours?: SourcedText;
      source: string;
    }
  | {
      kind: 'whatsapp';
      label?: string;
      number: string;
      href: string;
      hours?: SourcedText;
      source: string;
    }
  | {
      kind: 'email';
      label?: string;
      address: string;
      href: string;
      hours?: SourcedText;
      source: string;
    }
  | {
      kind: 'web_chat' | 'website';
      label?: string;
      url: string;
      hours?: SourcedText;
      source: string;
    };

export interface SupportService {
  id: string;
  service: string;
  audiences: Audience[];
  topics: string[];
  helps_with: string;
  official_domains: string[];
  age_range?: SourcedText;
  area?: SourcedText;
  contacts: Contact[];
  checked_at: string;
  confirmed_by?: string;
  note?: string;
}

export interface HelpTopic {
  id: string;
  title: string;
  intro: string;
  urgent: boolean;
}

export interface SupportData {
  topics: HelpTopic[];
  services: SupportService[];
}

export const supportData = raw as SupportData;

const forAudience = (audience: Audience) =>
  supportData.services.filter((s) => s.audiences.includes(audience));

/** Services shown under a topic: those for this audience that are not parent-only. */
export function servicesFor(audience: Audience, topicId: string): SupportService[] {
  return forAudience(audience).filter(
    (s) => s.topics.includes(topicId) && s.audiences.includes('student'),
  );
}

/** Topics with at least one service to show. */
export function helpTopics(audience: Audience): HelpTopic[] {
  return supportData.topics.filter((t) => servicesFor(audience, t.id).length > 0);
}

/** Services for worried adults (the NSPCC Helpline), shown on the parent version only. */
export function parentOnlyServices(): SupportService[] {
  return supportData.services.filter(
    (s) => s.audiences.includes('parent') && !s.audiences.includes('student'),
  );
}

/** The oldest check date, shown at the foot of the page. */
export function lastChecked(): string {
  return supportData.services
    .map((s) => s.checked_at)
    .sort()
    .at(0)!;
}
