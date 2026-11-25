/**
 * Two-part titles (R8; see docs/REWARDS.md "Two-part titles"). A student picks one first word
 * and one last word from the words their rewards have unlocked; the title shows under their
 * nickname. Words are curated data (catalogue/title-words.ts), never free text, and can be
 * changed at any time for free.
 */
import {
  REVIEWED_BLOCKED_PAIRS,
  REWARDS,
  SOURCE_REWARDS,
  type Rarity,
  type Reward,
  type TitlePart,
} from './catalogue';
import { z } from 'zod';
import { containsBlockedWord } from './nickname';
import { RaritySchema } from './rewards-schemas';

export interface TitleWord {
  text: string;
  part: TitlePart;
  /** The reward that unlocks it. */
  rewardId: string;
  rarity: Rarity;
}

export interface TitleChoice {
  first: string | null;
  last: string | null;
}

/** One word: a capital letter, then letters, with single hyphens between parts. */
export const TITLE_WORD_PATTERN = /^[A-Z][A-Za-z]*(-[A-Za-z]+)*$/;
export const TITLE_WORD_MAX_LENGTH = 16;

export function titleWordsFrom(rewards: readonly Reward[]): TitleWord[] {
  return rewards.flatMap((r) =>
    r.items.flatMap((i) =>
      i.kind === 'titleWord'
        ? [{ text: i.text, part: i.part, rewardId: r.id, rarity: r.rarity }]
        : [],
    ),
  );
}

export const TITLE_WORDS: readonly TitleWord[] = titleWordsFrom(REWARDS);

const pairKey = (first: string, last: string) => `${first} ${last}`;
const REVIEWED = new Set(REVIEWED_BLOCKED_PAIRS.map(([f, l]) => pairKey(f, l)));

/** The words a student has unlocked, rarest first within each part. */
export function titleWordsFor(earnedIds: readonly string[]): {
  first: TitleWord[];
  last: TitleWord[];
} {
  const earned = new Set(earnedIds);
  const mine = TITLE_WORDS.filter((w) => earned.has(w.rewardId));
  return {
    first: mine.filter((w) => w.part === 'first'),
    last: mine.filter((w) => w.part === 'last'),
  };
}

/** True when the pair is on the manual review list (fine words that read badly together). */
export function isReviewedPair(first: string, last: string): boolean {
  return REVIEWED.has(pairKey(first, last));
}

export type TitleRejection = 'locked' | 'reviewed';

export function chooseTitle(
  choice: TitleChoice,
  earnedIds: readonly string[],
): { ok: true } | { ok: false; reason: TitleRejection } {
  const words = titleWordsFor(earnedIds);
  const unlocked = (text: string | null, list: TitleWord[]) =>
    text === null || list.some((w) => w.text === text);
  if (!unlocked(choice.first, words.first) || !unlocked(choice.last, words.last)) {
    return { ok: false, reason: 'locked' };
  }
  if (choice.first && choice.last && isReviewedPair(choice.first, choice.last)) {
    return { ok: false, reason: 'reviewed' };
  }
  return { ok: true };
}

export const TITLE_MESSAGES: Record<TitleRejection, string> = {
  locked: "You haven't unlocked that word yet",
  reviewed: "Those two words don't go together. Try another pair",
};

export function formatTitle(choice: TitleChoice): string | null {
  const text = [choice.first, choice.last].filter(Boolean).join(' ');
  return text || null;
}

/**
 * Checks the title words: format, unique per part, a real reward for each, every reward that
 * had an old single title migrated, no blocked word in any word or any possible pairing, and
 * every reviewed pair made of real words. Returns problems (empty when all is well).
 */
export function validateTitleWords(
  words: readonly TitleWord[] = TITLE_WORDS,
  reviewed: readonly (readonly [string, string])[] = REVIEWED_BLOCKED_PAIRS,
  rewards: readonly Reward[] = REWARDS,
  sourceRewards: readonly Reward[] = SOURCE_REWARDS,
): string[] {
  const errors: string[] = [];
  const ids = new Set(rewards.map((r) => r.id));
  const firsts = words.filter((w) => w.part === 'first');
  const lasts = words.filter((w) => w.part === 'last');
  for (const list of [firsts, lasts]) {
    const seen = new Set<string>();
    for (const w of list) {
      if (seen.has(w.text)) errors.push(`"${w.text}": used twice as a ${w.part} word`);
      seen.add(w.text);
    }
  }
  for (const w of words) {
    if (!TITLE_WORD_PATTERN.test(w.text) || w.text.length > TITLE_WORD_MAX_LENGTH) {
      errors.push(`"${w.text}": a title word is one word of letters and hyphens, up to 16`);
    }
    if (!ids.has(w.rewardId)) errors.push(`"${w.text}": reward ${w.rewardId} is missing`);
    if (containsBlockedWord(w.text)) errors.push(`"${w.text}": contains a blocked word`);
  }
  const withWords = new Set(words.map((w) => w.rewardId));
  for (const r of sourceRewards) {
    if (r.items.some((i) => i.kind === 'title') && !withWords.has(r.id)) {
      errors.push(`${r.id}: its old title has no title words`);
    }
  }
  for (const f of firsts) {
    for (const l of lasts) {
      if (containsBlockedWord(pairKey(f.text, l.text))) {
        errors.push(`"${pairKey(f.text, l.text)}": the pairing reads as a blocked word`);
      }
    }
  }
  const texts = (list: TitleWord[]) => new Set(list.map((w) => w.text));
  const firstTexts = texts(firsts);
  const lastTexts = texts(lasts);
  for (const [f, l] of reviewed) {
    if (!firstTexts.has(f) || !lastTexts.has(l)) {
      errors.push(`reviewed pair "${f} ${l}": both words must exist`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------
// API shapes for GET and PUT /v1/student/rewards/title
// ---------------------------------------------------------------------------------------------

const TitleWordText = z.string().regex(TITLE_WORD_PATTERN).max(TITLE_WORD_MAX_LENGTH);

export const TitleChoiceSchema = z.object({
  first: TitleWordText.nullable(),
  last: TitleWordText.nullable(),
});

export const TitleWordSchema = z.object({
  text: z.string(),
  part: z.enum(['first', 'last']),
  rewardId: z.string(),
  rarity: RaritySchema,
});

export const StudentTitleResponseSchema = z.object({
  nickname: z.string(),
  first: z.string().nullable(),
  last: z.string().nullable(),
  /** "First Last", one word alone, or null when none is picked. */
  title: z.string().nullable(),
  words: z.object({ first: z.array(TitleWordSchema), last: z.array(TitleWordSchema) }),
});
export type StudentTitleResponse = z.infer<typeof StudentTitleResponseSchema>;
