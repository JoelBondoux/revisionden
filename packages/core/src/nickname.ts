/**
 * Nickname rules for student profiles (see docs/PRIVACY.md and docs/PRODUCT_RULES.md).
 * - 2 to 16 characters: letters A–Z, numbers and underscore only.
 * - Not on the block list. Strong words are blocked anywhere in the name; short words that
 *   appear inside ordinary words (for example "ass" in "class") only when they stand alone
 *   between underscores. Number-for-letter swaps (sh1t) and underscores (f_u_c_k) are seen
 *   through.
 */
export type NicknameRejection = 'too_short' | 'too_long' | 'invalid_characters' | 'blocked';

export type NicknameResult =
  { ok: true; nickname: string } | { ok: false; reason: NicknameRejection };

export interface NicknameOptions {
  /** Extra words to block anywhere in the name (for example from a moderation list). */
  extraBlocked?: string[];
}

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;
export const NICKNAME_PATTERN = /^[A-Za-z0-9_]+$/;

/** Blocked anywhere in the name, after removing underscores and undoing number swaps. */
const BLOCKED_ANYWHERE = [
  'fuck',
  'shit',
  'cunt',
  'bitch',
  'wank',
  'twat',
  'bollock',
  'bastard',
  'slut',
  'whore',
  'porn',
  'nazi',
  'hitler',
  'nigg',
  'faggot',
  'retard',
  'pussy',
  'dildo',
];

/** Blocked only as a whole part of the name (split on underscores). */
const BLOCKED_STANDALONE = [
  'ass',
  'arse',
  'sex',
  'rape',
  'dick',
  'cock',
  'piss',
  'tit',
  'tits',
  'fag',
  'slag',
  'hoe',
  'nob',
  // Pretending to be staff or the app itself.
  'admin',
  'moderator',
  'mod',
  'staff',
  'teacher',
  'official',
  'support',
  'revisionden',
];

const NUMBER_SWAPS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
};

function undoSwaps(text: string): string {
  return text.toLowerCase().replace(/[0-9]/g, (digit) => NUMBER_SWAPS[digit] ?? digit);
}

function isBlocked(nickname: string, extraBlocked: string[]): boolean {
  const squashed = undoSwaps(nickname.replace(/_/g, ''));
  const anywhere = [...BLOCKED_ANYWHERE, ...extraBlocked.map((w) => w.toLowerCase())];
  if (anywhere.some((word) => squashed.includes(word))) return true;
  const parts = nickname.split('_').map(undoSwaps);
  return parts.some((part) => BLOCKED_STANDALONE.includes(part));
}

/**
 * Whether text contains a blocked word, by the nickname rules (spaces and hyphens count as word
 * breaks). Used by the two-part title validator (R8) to check every word pairing.
 */
export function containsBlockedWord(text: string): boolean {
  return isBlocked(text.replace(/[\s-]+/g, '_'), []);
}

export function validateNickname(raw: string, options: NicknameOptions = {}): NicknameResult {
  const length = [...raw].length;
  if (length < NICKNAME_MIN_LENGTH) return { ok: false, reason: 'too_short' };
  if (length > NICKNAME_MAX_LENGTH) return { ok: false, reason: 'too_long' };
  if (!NICKNAME_PATTERN.test(raw)) return { ok: false, reason: 'invalid_characters' };
  if (isBlocked(raw, options.extraBlocked ?? [])) return { ok: false, reason: 'blocked' };
  return { ok: true, nickname: raw };
}

/** Plain-English message for each rejection, for forms and API errors. */
export const NICKNAME_MESSAGES: Record<NicknameRejection, string> = {
  too_short: `Nickname must be at least ${NICKNAME_MIN_LENGTH} characters`,
  too_long: `Nickname must be at most ${NICKNAME_MAX_LENGTH} characters`,
  invalid_characters: 'Nickname can only use letters, numbers and underscores',
  blocked: 'Please choose a different nickname',
};
