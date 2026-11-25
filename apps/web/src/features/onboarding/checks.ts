import { findSubject, type Enrolment } from '@revisionden/core';

export interface CheckItem {
  subjectId: string;
  field: 'board' | 'tier';
  text: string;
}

/** Boards and tiers left as "Not sure", in plain words ("Maths exam board", "Maths tier"). */
export function checkItems(enrolments: readonly Enrolment[]): CheckItem[] {
  return enrolments.flatMap((e) => {
    const name = findSubject(e.subjectId)?.name ?? e.subjectId;
    const items: CheckItem[] = [];
    if (e.board === 'not_sure') {
      items.push({ subjectId: e.subjectId, field: 'board', text: `${name} exam board` });
    }
    if (e.tier === 'not_sure') {
      items.push({ subjectId: e.subjectId, field: 'tier', text: `${name} tier` });
    }
    return items;
  });
}
