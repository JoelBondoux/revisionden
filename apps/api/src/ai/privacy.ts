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

/** Names of the personal-data fields found in `body` (empty when it is clean). */
export function findPersonalData(body: string, profile: StudentProfile): string[] {
  const found: string[] = [];
  for (const field of ['id', 'familyId', 'nickname', 'avatarCode'] as const) {
    if (wholeWord(profile[field]).test(body)) found.push(field);
  }
  if (new RegExp(`\\byear\\s*${profile.yearGroup}\\b`, 'i').test(body)) found.push('yearGroup');
  if (EMAIL.test(body)) found.push('email');
  if (PHONE.test(body)) found.push('phone');
  return found;
}
