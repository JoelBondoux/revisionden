/** The full rewards catalogue as data (see docs/REWARDS.md). */
import { CHAPTER_REWARDS } from './chapters';
import { withEffectStyles } from './effect-styles';
import { COLLECTIONS, COLLECTION_REWARDS } from './collections';
import { BUG_HUNTER_REWARDS, MORE_HIDDEN_TRACK_REWARDS, SECRET_REWARDS } from './hidden';
import { LEVEL_REWARDS } from './levels';
import { MILESTONE_REWARDS } from './milestones';
import { SEASONS, SEASON_REWARDS } from './seasons';
import { TITLE_WORD_ROWS, type TitleWordRow } from './title-words';
import type { Reward } from './types';

export * from './types';
export * from './validate';
export { CHAPTER_REWARDS, COLLECTIONS, COLLECTION_REWARDS, LEVEL_REWARDS, MILESTONE_REWARDS };
export { SEASONS, SEASON_REWARDS, BUG_HUNTER_REWARDS, MORE_HIDDEN_TRACK_REWARDS, SECRET_REWARDS };
export { EFFECT_STYLE_UNLOCKS, effectStylesFor, withEffectStyles } from './effect-styles';

/** Every reward as written in the source files, with the old single titles (before R8). */
export const SOURCE_REWARDS: readonly Reward[] = [
  ...MILESTONE_REWARDS,
  ...LEVEL_REWARDS,
  ...CHAPTER_REWARDS,
  ...COLLECTION_REWARDS,
  ...SEASON_REWARDS,
  ...BUG_HUNTER_REWARDS,
  ...MORE_HIDDEN_TRACK_REWARDS,
  ...SECRET_REWARDS,
];

/**
 * Replaces each old single title with the reward's two-part title words (R8) and adds the words
 * of rewards that had no title. A reward name like '"Opening Act" title' becomes
 * 'Title words: Opening, Act'.
 */
export function withTitleWords(
  rewards: readonly Reward[],
  rows: readonly TitleWordRow[] = TITLE_WORD_ROWS,
): Reward[] {
  const byReward = new Map(rows.map((row) => [row.rewardId, row]));
  return rewards.map((r) => {
    const row = byReward.get(r.id);
    const hadTitle = r.items.some((i) => i.kind === 'title');
    if (!row && !hadTitle) return r;
    const words = row
      ? [
          ...(row.first
            ? [{ kind: 'titleWord' as const, part: 'first' as const, text: row.first }]
            : []),
          ...(row.last
            ? [{ kind: 'titleWord' as const, part: 'last' as const, text: row.last }]
            : []),
        ]
      : [];
    const name = /^".+" title$/.test(r.name)
      ? `Title words: ${words.map((w) => w.text).join(', ')}`
      : r.name;
    return { ...r, name, items: [...r.items.filter((i) => i.kind !== 'title'), ...words] };
  });
}

export const REWARDS: readonly Reward[] = withEffectStyles(withTitleWords(SOURCE_REWARDS));
export { TITLE_WORD_ROWS, REVIEWED_BLOCKED_PAIRS } from './title-words';
export type { TitleWordRow } from './title-words';
