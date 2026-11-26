/**
 * "Learn it first" and "Learn more" links (workstream Q): free lessons from the allowed providers
 * in content/learn-links/*.json, bundled into the app at build time (no request until a tap).
 * A link is shown only when it is reachable (checked_at) and match-checked (match).
 */
export type LearnLinkProvider = 'oak' | 'bitesize' | 'isaac';

export interface LearnLinkMatch {
  /** The page's title as fetched when it was read. */
  page_title: string;
  /** What the page teaches, as read on the page. */
  teaches: string;
  level: 'GCSE' | 'A-Level';
  checked_at: string;
}

export interface LearnLink {
  title: string;
  url: string;
  provider: LearnLinkProvider;
  level: 'GCSE' | 'A-Level';
  board?: string;
  /** Only for these learning points of the topic (without these or `items`: the whole topic). */
  learning_points?: string[];
  /** Only for these items of the topic. */
  items?: string[];
  /** Last confirmed reachable by the CI link check, or null until then. */
  checked_at: string | null;
  /** The recorded content check; without one the link is not shown. */
  match?: LearnLinkMatch;
}

export const PROVIDER_NAMES: Record<LearnLinkProvider, string> = {
  oak: 'Oak National Academy',
  bitesize: 'BBC Bitesize',
  isaac: 'Isaac',
};

const PROVIDERS = new Set<unknown>(Object.keys(PROVIDER_NAMES));
const isIdList = (v: unknown) =>
  v === undefined || (Array.isArray(v) && v.every((x) => typeof x === 'string'));

function isLink(value: unknown): value is LearnLink {
  if (typeof value !== 'object' || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.title === 'string' &&
    typeof l.url === 'string' &&
    l.url.startsWith('https://') &&
    PROVIDERS.has(l.provider) &&
    (l.checked_at === null || typeof l.checked_at === 'string') &&
    isIdList(l.learning_points) &&
    isIdList(l.items)
  );
}

/** Reachable and match-checked: the only links the app shows. */
export function isShown(link: LearnLink): boolean {
  const m = link.match;
  return (
    link.checked_at !== null &&
    typeof m === 'object' &&
    m !== null &&
    typeof m.page_title === 'string' &&
    typeof m.teaches === 'string' &&
    typeof m.checked_at === 'string'
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

const isWholeTopic = (l: LearnLink) => !l.learning_points && !l.items;

/** The topic's shown whole-topic links ("Learn it first"); the button shows only with one. */
export function checkedLinksFor(byTopic: Map<string, LearnLink[]>, topicId: string): LearnLink[] {
  return (byTopic.get(topicId) ?? []).filter((l) => isShown(l) && isWholeTopic(l));
}

/**
 * "Learn more" for a question: the most specific shown links, first those for the item, then
 * those for its learning point, then the whole topic's.
 */
export function learnMoreLinks(
  byTopic: Map<string, LearnLink[]>,
  where: { topicId: string; learningPoint?: string; itemId?: string },
): LearnLink[] {
  const shown = (byTopic.get(where.topicId) ?? []).filter(isShown);
  const { itemId, learningPoint } = where;
  const forItem = itemId ? shown.filter((l) => l.items?.includes(itemId)) : [];
  if (forItem.length) return forItem;
  const forPoint = learningPoint
    ? shown.filter((l) => l.learning_points?.includes(learningPoint))
    : [];
  if (forPoint.length) return forPoint;
  return shown.filter(isWholeTopic);
}

const files = import.meta.glob('../../../../../content/learn-links/*.json', {
  eager: true,
  import: 'default',
});

export const learnLinksByTopic = parseLearnLinkFiles(Object.values(files));
