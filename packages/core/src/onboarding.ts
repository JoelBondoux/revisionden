/**
 * Onboarding rules: which school years we take, the subjects for each level, the exam boards
 * that offer each subject, which GCSEs are tiered, and when the final exams are.
 * See docs/PRODUCT_RULES.md "Onboarding".
 */
import type { CreateEnrolmentRequest } from './schemas';

export type Level = 'gcse' | 'a_level';
export type Board = 'AQA' | 'Edexcel' | 'OCR' | 'Eduqas';
export type BoardChoice = Board | 'not_sure';
export type TierChoice = 'foundation' | 'higher' | 'none' | 'not_sure';

export interface Subject {
  id: string;
  name: string;
  level: Level;
  boards: readonly Board[];
  tiered: boolean;
}

/** School years a parent can pick when adding a child. */
export const ONBOARDING_YEARS = [9, 10, 11, 12, 13] as const;

export const LEVEL_LABELS: Record<Level, string> = { gcse: 'GCSE', a_level: 'A-Level' };

export const BOARD_LABELS: Record<BoardChoice, string> = {
  AQA: 'AQA',
  Edexcel: 'Pearson Edexcel',
  OCR: 'OCR',
  Eduqas: 'WJEC Eduqas',
  not_sure: 'Not sure',
};

export const TIER_LABELS: Record<Exclude<TierChoice, 'none'>, string> = {
  foundation: 'Foundation',
  higher: 'Higher',
  not_sure: 'Not sure',
};

const MAIN_FOUR: readonly Board[] = ['AQA', 'Edexcel', 'OCR', 'Eduqas'];
const LANGUAGES: readonly Board[] = ['AQA', 'Edexcel', 'Eduqas'];
const A_LEVEL_MATHS: readonly Board[] = ['AQA', 'Edexcel', 'OCR'];

const gcse = (slug: string, name: string, tiered = false, boards = MAIN_FOUR): Subject => ({
  id: `gcse-${slug}`,
  name,
  level: 'gcse',
  boards,
  tiered,
});
const aLevel = (slug: string, name: string, boards = MAIN_FOUR): Subject => ({
  id: `alevel-${slug}`,
  name,
  level: 'a_level',
  boards,
  tiered: false,
});

export const SUBJECTS: readonly Subject[] = [
  gcse('english-language', 'English Language'),
  gcse('english-literature', 'English Literature'),
  gcse('maths', 'Maths', true),
  gcse('statistics', 'Statistics', true),
  gcse('combined-science', 'Combined Science', true),
  gcse('biology', 'Biology', true),
  gcse('chemistry', 'Chemistry', true),
  gcse('physics', 'Physics', true),
  gcse('french', 'French', true, LANGUAGES),
  gcse('spanish', 'Spanish', true, LANGUAGES),
  gcse('german', 'German', true, LANGUAGES),
  gcse('history', 'History'),
  gcse('drama', 'Drama'),
  gcse('film-studies', 'Film Studies', false, ['Eduqas']),
  aLevel('maths', 'Maths', A_LEVEL_MATHS),
  aLevel('further-maths', 'Further Maths', A_LEVEL_MATHS),
  aLevel('computer-science', 'Computer Science', ['AQA', 'OCR', 'Eduqas']),
  aLevel('physics', 'Physics'),
];

export function levelForYear(yearGroup: number): Level | undefined {
  if (yearGroup >= 9 && yearGroup <= 11) return 'gcse';
  if (yearGroup === 12 || yearGroup === 13) return 'a_level';
  return undefined;
}

export function subjectsForLevel(level: Level): Subject[] {
  return SUBJECTS.filter((s) => s.level === level);
}

export function findSubject(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export function boardsFor(subjectId: string): Board[] {
  return [...(findSubject(subjectId)?.boards ?? [])];
}

export function isTiered(subjectId: string): boolean {
  return findSubject(subjectId)?.tiered ?? false;
}

/**
 * Final exams are in the summer: Year 11 and Year 13 sit them at the end of this school year,
 * Year 10 and 12 a year later, Year 9 two years later. A school year starts in September.
 */
export function examSeasonFor(
  yearGroup: number,
  today: Date,
): { season: 'summer'; year: number } | undefined {
  const level = levelForYear(yearGroup);
  if (!level) return undefined;
  const schoolYearEnds =
    today.getUTCMonth() >= 8 ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
  const finalYear = level === 'gcse' ? 11 : 13;
  return { season: 'summer', year: schoolYearEnds + (finalYear - yearGroup) };
}

export type SubjectChoice = Pick<CreateEnrolmentRequest, 'subjectId' | 'board' | 'tier'>;

/** Boards and tiers left as "not sure", to remind the parent later. */
export function toCheckLaterCount(choices: readonly SubjectChoice[]): number {
  return choices.reduce(
    (n, c) => n + (c.board === 'not_sure' ? 1 : 0) + (c.tier === 'not_sure' ? 1 : 0),
    0,
  );
}

export type SubjectProblem =
  | 'unknown_subject'
  | 'wrong_level'
  | 'board_not_offered'
  | 'tier_needed'
  | 'not_tiered'
  | 'duplicate';

/** Checks subject, board and tier choices against the child's school year. */
export function validateSubjectChoices(
  yearGroup: number,
  choices: readonly SubjectChoice[],
): { subjectId: string; problem: SubjectProblem }[] {
  const level = levelForYear(yearGroup);
  const seen = new Set<string>();
  const problems: { subjectId: string; problem: SubjectProblem }[] = [];
  for (const choice of choices) {
    const problem = problemWith(choice, level, seen);
    seen.add(choice.subjectId);
    if (problem) problems.push({ subjectId: choice.subjectId, problem });
  }
  return problems;
}

function problemWith(
  { subjectId, board, tier }: SubjectChoice,
  level: Level | undefined,
  seen: Set<string>,
): SubjectProblem | undefined {
  const subject = findSubject(subjectId);
  if (!subject) return 'unknown_subject';
  if (subject.level !== level) return 'wrong_level';
  if (seen.has(subjectId)) return 'duplicate';
  if (board !== 'not_sure' && !(subject.boards as readonly string[]).includes(board)) {
    return 'board_not_offered';
  }
  if (subject.tiered && tier === 'none') return 'tier_needed';
  if (!subject.tiered && tier !== 'none') return 'not_tiered';
  return undefined;
}
