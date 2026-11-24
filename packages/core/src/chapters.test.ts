import { describe, expect, it } from 'vitest';
import {
  CHAPTERS,
  CHAPTER_FULL_XP,
  chapterForYear,
  chapterXp,
  schoolYearOf,
  yearGroupOn,
} from './chapters';

describe('year chapters', () => {
  it('has one chapter per school year from Year 9 to Year 13', () => {
    expect(CHAPTERS.map((c) => [c.number, c.yearGroup])).toEqual([
      [1, 9],
      [2, 10],
      [3, 11],
      [4, 12],
      [5, 13],
    ]);
    expect(CHAPTERS.map((c) => c.level)).toEqual(['gcse', 'gcse', 'gcse', 'a_level', 'a_level']);
  });

  it('maps a year group to its chapter', () => {
    expect(chapterForYear(9)).toBe(1);
    expect(chapterForYear(12)).toBe(4);
    expect(chapterForYear(13)).toBe(5);
    expect(chapterForYear(8)).toBeNull();
    expect(chapterForYear(14)).toBeNull();
  });

  it('starts a school year on 1 September', () => {
    expect(schoolYearOf('2026-08-31')).toBe(2025);
    expect(schoolYearOf('2026-09-01')).toBe(2026);
    expect(schoolYearOf('2027-06-15')).toBe(2026);
  });

  it('works out the year group on an earlier day from the year group today', () => {
    expect(yearGroupOn('2026-10-01', 10, '2026-11-24')).toBe(10);
    expect(yearGroupOn('2026-06-01', 10, '2026-11-24')).toBe(9);
    expect(yearGroupOn('2024-10-01', 13, '2026-11-24')).toBe(11);
  });
});

describe('chapterXp', () => {
  const today = '2026-11-24';

  it('credits XP to the chapter of the school year it was earned in', () => {
    const xp = chapterXp({
      days: [
        { day: '2025-10-01', xp: 100 },
        { day: '2026-10-01', xp: 40 },
      ],
      yearGroup: 11,
      today,
    });
    expect(xp).toEqual({ 1: 0, 2: 100, 3: 40, 4: 0, 5: 0 });
  });

  it('starts a mid-way joiner at their current chapter with earlier chapters at zero', () => {
    const xp = chapterXp({ days: [{ day: '2026-10-01', xp: 500 }], yearGroup: 12, today });
    expect(xp).toEqual({ 1: 0, 2: 0, 3: 0, 4: 500, 5: 0 });
  });

  it('spills XP past a full chapter into the earliest unfinished earlier chapter, for collectors', () => {
    const xp = chapterXp({
      days: [
        { day: '2026-09-10', xp: CHAPTER_FULL_XP },
        { day: '2026-10-01', xp: 300 },
      ],
      yearGroup: 12,
      today,
    });
    expect(xp).toEqual({ 1: 300, 2: 0, 3: 0, 4: CHAPTER_FULL_XP, 5: 0 });
  });

  it('never spills into a later chapter, and stops when every chapter so far is full', () => {
    const xp = chapterXp({
      days: [{ day: '2026-10-01', xp: CHAPTER_FULL_XP * 3 }],
      yearGroup: 9,
      today,
    });
    expect(xp).toEqual({ 1: CHAPTER_FULL_XP, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it('puts days before Year 9 into chapter 1 and ignores days after Year 13', () => {
    const xp = chapterXp({
      days: [
        { day: '2025-10-01', xp: 10 },
        { day: '2026-10-01', xp: 20 },
      ],
      yearGroup: 9,
      today,
    });
    expect(xp[1]).toBe(30);
    expect(chapterXp({ days: [{ day: '2026-10-01', xp: 5 }], yearGroup: 14, today })).toEqual({
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    });
  });
});
