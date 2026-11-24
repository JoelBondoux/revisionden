/**
 * Year chapters: one themed reward track per school year, Year 9 to Year 13 (see
 * docs/REWARDS.md "Year chapters").
 *
 * Chapter progress is reward XP (see reward-xp.ts) earned during that chapter's school year.
 * A student who joins mid-way starts at their current chapter. Once a chapter is full, extra XP
 * from that school year spills into the earliest unfinished earlier chapter, so earlier chapters
 * stay earnable for collectors. Nothing ever spills forward, and nothing resets at A-Level.
 */
import type { DayXp } from './reward-xp';

export type ChapterNumber = 1 | 2 | 3 | 4 | 5;

export interface Chapter {
  number: ChapterNumber;
  yearGroup: number;
  level: 'gcse' | 'a_level';
  name: string;
  theme: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { number: 1, yearGroup: 9, level: 'gcse', name: 'First Steps', theme: 'First steps into GCSE' },
  {
    number: 2,
    yearGroup: 10,
    level: 'gcse',
    name: 'Building Up',
    theme: 'Building up (mocks begin)',
  },
  { number: 3, yearGroup: 11, level: 'gcse', name: 'Exam Year', theme: 'Exam year' },
  { number: 4, yearGroup: 12, level: 'a_level', name: 'Sixth Form', theme: 'Sixth form' },
  { number: 5, yearGroup: 13, level: 'a_level', name: 'Final Year', theme: 'Final year' },
];

/** Reward XP that fills a chapter: a little under a school year of daily practice. */
export const CHAPTER_FULL_XP = 12_000;
/** Steps in each chapter's track (the last one is the finale). */
export const CHAPTER_STEPS = 30;
export const CHAPTER_STEP_XP = CHAPTER_FULL_XP / CHAPTER_STEPS;

export type ChapterXp = Record<ChapterNumber, number>;

export function chapterForYear(yearGroup: number): ChapterNumber | null {
  return CHAPTERS.find((c) => c.yearGroup === yearGroup)?.number ?? null;
}

/** The calendar year a school year starts in (school years start on 1 September). */
export function schoolYearOf(day: string): number {
  const [year, month] = day.split('-').map(Number) as [number, number];
  return month >= 9 ? year : year - 1;
}

export function yearGroupOn(day: string, currentYearGroup: number, today: string): number {
  return currentYearGroup - (schoolYearOf(today) - schoolYearOf(day));
}

const FIRST_YEAR = CHAPTERS[0]!.yearGroup;
const LAST_YEAR = CHAPTERS[CHAPTERS.length - 1]!.yearGroup;

export function chapterXp(input: {
  days: readonly DayXp[];
  yearGroup: number;
  today: string;
}): ChapterXp {
  const xp: ChapterXp = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const { day, xp: dayXp } of input.days) {
    const year = yearGroupOn(day, input.yearGroup, input.today);
    if (year > LAST_YEAR) continue;
    const own = chapterForYear(Math.max(FIRST_YEAR, year))!;
    let left = dayXp;
    const order = [own, ...([1, 2, 3, 4, 5] as const).filter((c) => c < own)];
    for (const chapter of order) {
      const room = CHAPTER_FULL_XP - xp[chapter];
      const add = Math.min(room, left);
      xp[chapter] += add;
      left -= add;
      if (left === 0) break;
    }
  }
  return xp;
}
