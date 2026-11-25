/**
 * "Learn it first" links (workstream Q): free official lessons per topic from
 * content/learn-links/*.json, bundled into the app at build time (no request until a tap).
 */
export type LearnLinkProvider = 'oak' | 'bitesize';

export interface LearnLink {
  title: string;
  url: string;
  provider: LearnLinkProvider;
  level: 'GCSE' | 'A-Level';
  board?: string;
  /** Last confirmed working by the CI link check, or null until then. */
  checked_at: string | null;
}

export const PROVIDER_NAMES: Record<LearnLinkProvider, string> = {
  oak: 'Oak National Academy',
  bitesize: 'BBC Bitesize',
};

function isLink(value: unknown): value is LearnLink {
  if (typeof value !== 'object' || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.title === 'string' &&
    typeof l.url === 'string' &&
    l.url.startsWith('https://') &&
    (l.provider === 'oak' || l.provider === 'bitesize') &&
    (l.checked_at === null || typeof l.checked_at === 'string')
  );
}

/** Links by topic id. The content validator checks the files; this only skips bad shapes. */
export function parseLearnLinkFiles(files: readonly unknown[]): Map<string, LearnLink[]> {
  const byTopic = new Map<string, LearnLink[]>();
  for (const file of files) {
    if (typeof file !== 'object' || file === null) continue;
    const { topic, links } = file as { topic?: unknown; links?: unknown };
    if (typeof topic !== 'string' || !Array.isArray(links)) continue;
    byTopic.set(topic, links.filter(isLink));
  }
  return byTopic;
}

/** The topic's links that have been checked; the button shows only when there is one. */
export function checkedLinksFor(byTopic: Map<string, LearnLink[]>, topicId: string): LearnLink[] {
  return (byTopic.get(topicId) ?? []).filter((l) => l.checked_at !== null);
}

const files = import.meta.glob('../../../../../content/learn-links/*.json', {
  eager: true,
  import: 'default',
});

export const learnLinksByTopic = parseLearnLinkFiles(Object.values(files));
