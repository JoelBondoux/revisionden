/**
 * "Learn it first" and "Learn more" links (workstream Q): free lessons from the allowed providers
 * in content/learn-links/*.json, bundled into the app at build time (no request until a tap).
 * A web link is shown only when it is reachable (checked_at) and match-checked (match), or is a
 * legacy whole-topic link from Q5 (reachable, no match record yet; the validator allows only
 * those). External links are interim: `revisionden` is our own note (planned), with an app route
 * instead of a URL, always listed first, and it can hide the external links it covers.
 */
export type LearnLinkProvider = 'oak' | 'bitesize' | 'isaac' | 'revisionden';

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
  /** A web page (every provider but revisionden). */
  url?: string;
  /** An in-house note's app route (revisionden only). */
  route?: string;
  /** revisionden only: hide the external links for the same item, point or topic. */
  hide_external?: boolean;
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
  revisionden: 'RevisionDen notes',
};

const PROVIDERS = new Set<unknown>(Object.keys(PROVIDER_NAMES));
const isIdList = (v: unknown) =>
  v === undefined || (Array.isArray(v) && v.every((x) => typeof x === 'string'));

function isLink(value: unknown): value is LearnLink {
  if (typeof value !== 'object' || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.title === 'string' &&
    (l.provider === 'revisionden'
      ? typeof l.route === 'string' && /^\/[a-z0-9/-]+$/.test(l.route)
      : typeof l.url === 'string' && l.url.startsWith('https://')) &&
    PROVIDERS.has(l.provider) &&
    (l.checked_at === null || typeof l.checked_at === 'string') &&
    isIdList(l.learning_points) &&
    isIdList(l.items)
  );
}

const isWholeTopic = (l: LearnLink) => !l.learning_points && !l.items;
export const isInHouse = (l: LearnLink) => l.provider === 'revisionden';

/** Shown: an in-house note, a reachable match-checked web link, or a legacy whole-topic link. */
export function isShown(link: LearnLink): boolean {
  if (isInHouse(link)) return true;
  if (link.checked_at === null) return false;
  const m = link.match;
  if (m === undefined) return isWholeTopic(link);
  return (
    typeof m === 'object' &&
    m !== null &&
    typeof m.page_title === 'string' &&
    typeof m.teaches === 'string' &&
    typeof m.checked_at === 'string'
  );
}

/** In-house notes first; when one says so, the external links beside it are hidden. */
function arrange(links: LearnLink[]): LearnLink[] {
  const ours = links.filter(isInHouse);
  if (ours.some((l) => l.hide_external)) return ours;
  return [...ours, ...links.filter((l) => !isInHouse(l))];
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

/** The topic's shown whole-topic links ("Learn it first"); the button shows only with one. */
export function checkedLinksFor(byTopic: Map<string, LearnLink[]>, topicId: string): LearnLink[] {
  return arrange((byTopic.get(topicId) ?? []).filter((l) => isShown(l) && isWholeTopic(l)));
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
  if (forItem.length) return arrange(forItem);
  const forPoint = learningPoint
    ? shown.filter((l) => l.learning_points?.includes(learningPoint))
    : [];
  if (forPoint.length) return arrange(forPoint);
  return arrange(shown.filter(isWholeTopic));
}

const files = import.meta.glob('../../../../../content/learn-links/*.json', {
  eager: true,
  import: 'default',
});

export const learnLinksByTopic = parseLearnLinkFiles(Object.values(files));
