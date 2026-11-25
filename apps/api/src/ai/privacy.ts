/**
 * Hard rule: requests to AI providers never contain names or personal data (docs/PRIVACY.md).
 * The gateway checks the exact request it is about to send against the student's profile
 * fields and common personal-data patterns, and refuses the call if anything matches.
 */

export interface StudentProfile {
  id: string;
  familyId: string;
  nickname: string;
  avatarCode: string;
  yearGroup: number;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// UK mobile and +44 numbers; plain digit runs are left alone because maths answers use them.
const PHONE = /(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b/;

/** Case-insensitive match of the value on its own, not inside a longer word. */
function wholeWord(value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'i');
}

// Between the words of a nickname: spaces, underscores, or JSON-escaped line breaks and tabs.
const NICKNAME_GAP = String.raw`(?:[\s_]|\\[nrt])+`;

/**
 * A nickname with spaces or underscores ("Thing 1", "pixel_fox") matches however its words are
 * spaced or joined, so "thing  1", "Thing_1" and "pixel fox" are all caught. Underscores at
 * either end ("_Pixel", "Pixel_") may be there or not, and an underscore-only nickname ("__")
 * is matched exactly.
 */
function nicknamePattern(nickname: string): RegExp {
  const words = nickname
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (words.length === 0) return wholeWord(nickname);
  return new RegExp(`(?<![A-Za-z0-9_])_*${words.join(NICKNAME_GAP)}_*(?![A-Za-z0-9_])`, 'i');
}

/** Names of the personal-data fields found in `body` (empty when it is clean). */
export function findPersonalData(body: string, profile: StudentProfile): string[] {
  const found: string[] = [];
  for (const field of ['id', 'familyId', 'nickname', 'avatarCode'] as const) {
    const pattern =
      field === 'nickname' ? nicknamePattern(profile.nickname) : wholeWord(profile[field]);
    if (pattern.test(body)) found.push(field);
  }
  if (new RegExp(`\\byear\\s*${profile.yearGroup}\\b`, 'i').test(body)) found.push('yearGroup');
  if (EMAIL.test(body)) found.push('email');
  if (PHONE.test(body)) found.push('phone');
  return found;
}
