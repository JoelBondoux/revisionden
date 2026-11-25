/**
 * The friendly "Before you start" page (docs/LEGAL.md, "Accepting the terms and privacy notice")
 * is built from each policy's own "In plain English" section, so its cards can never say
 * anything the policy does not. Each top-level bullet becomes one card; a bold start ending in a
 * full stop ("**Who we are.** …") becomes the card's label. Icons are decoration only.
 */
export interface SummaryPoint {
  label: string | null;
  /** Markdown, exactly as in the policy (wrapped lines joined with a space). */
  text: string;
  icon: string;
}

export interface AcceptanceSummary {
  intro: string;
  points: SummaryPoint[];
}

const LABEL = /^\*\*([^*]+?)\.\*\*\s+(.*)$/;

/** Ordered: the first rule whose words appear in the label (or text) picks the icon. */
const ICON_RULES: [RegExp, string][] = [
  [/^who we are$/i, 'building'],
  [/about your child/i, 'folder'],
  [/about you$/i, 'key'],
  [/parent/i, 'family'],
  [/^why$/i, 'target'],
  [/\bAI\b/, 'sparkle'],
  [/help/i, 'hand'],
  [/who else/i, 'eye'],
  [/how long/i, 'clock'],
  [/rights/i, 'scales'],
  [/grades?\b/i, 'target'],
  [/students?\b/i, 'steps'],
];
/** For cards with no label, only these strong words choose the icon. */
const TEXT_RULES: [RegExp, string][] = [
  [/\bAI\b/, 'sparkle'],
  [/\bgrades?\b/i, 'target'],
];
const FALLBACK_ICONS = ['info', 'shield', 'refresh', 'padlock', 'speech', 'robot'];

const ruleIcon = (words: string | null, rules = ICON_RULES) =>
  words ? rules.find(([rule]) => rule.test(words))?.[1] : undefined;

/** The icon for a card: from its words if a rule matches, else the next one in a fixed cycle. */
export function summaryIcon(labelOrText: string | null, index: number): string {
  return ruleIcon(labelOrText) ?? FALLBACK_ICONS[index % FALLBACK_ICONS.length]!;
}

export function parseAcceptanceSummary(plainEnglish: string): AcceptanceSummary {
  const intro: string[] = [];
  const bullets: string[] = [];
  for (const line of plainEnglish.split(/\r?\n/)) {
    const item = line.match(/^-\s+(.*)$/);
    if (item) bullets.push(item[1]!.trim());
    else if (bullets.length && /^\s{2,}\S/.test(line)) {
      bullets[bullets.length - 1] += ` ${line.trim()}`;
    } else if (!bullets.length) intro.push(line);
  }
  let fallback = 0;
  const points = bullets.map((bullet) => {
    const labelled = bullet.match(LABEL);
    const label = labelled ? labelled[1]!.trim() : null;
    const text = labelled ? labelled[2]!.trim() : bullet;
    const icon =
      (label ? ruleIcon(label) : ruleIcon(text, TEXT_RULES)) ?? summaryIcon(null, fallback++);
    return { label, text, icon };
  });
  return { intro: intro.join('\n').trim(), points };
}

/** How many cards show before "Show all … points". */
export const FEATURED_COUNT = 4;

/**
 * The cards shown first for each policy, most important first (product owner, 2026-11-25).
 * Matched against the card's label, or its text when it has none; a test checks each matches
 * exactly one card in the real policy, so a wording change cannot silently drop one.
 */
export const FEATURED_POINTS: Record<string, RegExp[]> = {
  'terms-of-use': [
    /^The parent is in charge$/,
    /^It's a revision helper, not a teacher$/,
    /^\*\*AI marks are a guide\*\*/,
    /^No promises about grades$/,
  ],
  'privacy-notice': [
    /^What we keep about your child$/,
    /^What we keep about you$/,
    /^AI marking$/,
    /^Your rights$/,
  ],
};

/**
 * Splits the cards into the ones shown first (the chosen ones in their order, topped up from the
 * start of the policy to FEATURED_COUNT) and the rest, which keep the policy's order.
 */
export function featuredFirst(points: SummaryPoint[], chosen: RegExp[]) {
  const picked: SummaryPoint[] = [];
  for (const rule of chosen) {
    const match = points.find((p) => !picked.includes(p) && rule.test(p.label ?? p.text));
    if (match) picked.push(match);
  }
  for (const point of points) {
    if (picked.length >= FEATURED_COUNT) break;
    if (!picked.includes(point)) picked.push(point);
  }
  const featured = picked.slice(0, FEATURED_COUNT);
  return { featured, rest: points.filter((p) => !featured.includes(p)) };
}
