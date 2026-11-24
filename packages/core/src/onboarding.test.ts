import { describe, expect, it } from 'vitest';
import {
  BOARD_LABELS,
  ONBOARDING_YEARS,
  boardsFor,
  examSeasonFor,
  findSubject,
  isTiered,
  levelForYear,
  subjectsForLevel,
  toCheckLaterCount,
  validateSubjectChoices,
} from './onboarding';

const AUTUMN_2026 = new Date('2026-11-24T10:00:00Z');

describe('levelForYear', () => {
  it('puts Years 9 to 11 on GCSE and Years 12 and 13 on A-Level', () => {
    expect([9, 10, 11].map(levelForYear)).toEqual(['gcse', 'gcse', 'gcse']);
    expect([12, 13].map(levelForYear)).toEqual(['a_level', 'a_level']);
  });

  it('offers only Years 9 to 13 in onboarding', () => {
    expect(ONBOARDING_YEARS).toEqual([9, 10, 11, 12, 13]);
  });

  it('has no level for years outside onboarding', () => {
    expect(levelForYear(8)).toBeUndefined();
  });
});

describe('examSeasonFor', () => {
  it('works out the summer of the final exams from the school year', () => {
    expect(examSeasonFor(11, AUTUMN_2026)).toEqual({ season: 'summer', year: 2027 });
    expect(examSeasonFor(13, AUTUMN_2026)).toEqual({ season: 'summer', year: 2027 });
    expect(examSeasonFor(10, AUTUMN_2026)).toEqual({ season: 'summer', year: 2028 });
    expect(examSeasonFor(12, AUTUMN_2026)).toEqual({ season: 'summer', year: 2028 });
    expect(examSeasonFor(9, AUTUMN_2026)).toEqual({ season: 'summer', year: 2029 });
  });

  it('uses the school year that started last September', () => {
    expect(examSeasonFor(11, new Date('2027-03-01T00:00:00Z'))).toEqual({
      season: 'summer',
      year: 2027,
    });
    expect(examSeasonFor(11, new Date('2027-09-01T00:00:00Z'))).toEqual({
      season: 'summer',
      year: 2028,
    });
  });

  it('has no exam season for years outside onboarding', () => {
    expect(examSeasonFor(7, AUTUMN_2026)).toBeUndefined();
  });
});

describe('subjectsForLevel', () => {
  it('lists GCSE subjects including Film Studies', () => {
    const names = subjectsForLevel('gcse').map((s) => s.name);
    expect(names).toContain('Film Studies');
    expect(names).toContain('Maths');
    expect(names).not.toContain('Further Maths');
  });

  it('lists A-Level subjects including Further Maths and Computer Science', () => {
    const names = subjectsForLevel('a_level').map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['Maths', 'Further Maths', 'Computer Science']));
    expect(names).not.toContain('Film Studies');
  });

  it('gives every subject a unique id that starts with its level', () => {
    const all = [...subjectsForLevel('gcse'), ...subjectsForLevel('a_level')];
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const s of subjectsForLevel('gcse')) expect(s.id.startsWith('gcse-')).toBe(true);
    for (const s of subjectsForLevel('a_level')) expect(s.id.startsWith('alevel-')).toBe(true);
  });
});

describe('boardsFor', () => {
  it('offers only WJEC Eduqas for GCSE Film Studies', () => {
    expect(boardsFor('gcse-film-studies')).toEqual(['Eduqas']);
  });

  it('offers AQA, Pearson Edexcel and WJEC Eduqas for GCSE languages', () => {
    for (const id of ['gcse-french', 'gcse-spanish', 'gcse-german']) {
      expect(boardsFor(id)).toEqual(['AQA', 'Edexcel', 'Eduqas']);
    }
  });

  it('offers AQA, Pearson Edexcel and OCR for A-Level Maths and Further Maths', () => {
    expect(boardsFor('alevel-maths')).toEqual(['AQA', 'Edexcel', 'OCR']);
    expect(boardsFor('alevel-further-maths')).toEqual(['AQA', 'Edexcel', 'OCR']);
  });

  it('offers AQA, OCR and WJEC Eduqas for A-Level Computer Science', () => {
    expect(boardsFor('alevel-computer-science')).toEqual(['AQA', 'OCR', 'Eduqas']);
  });

  it('offers the four main boards otherwise', () => {
    expect(boardsFor('gcse-history')).toEqual(['AQA', 'Edexcel', 'OCR', 'Eduqas']);
  });

  it('offers nothing for an unknown subject', () => {
    expect(boardsFor('gcse-astrology')).toEqual([]);
  });

  it('labels boards with their full names', () => {
    expect(BOARD_LABELS.Edexcel).toBe('Pearson Edexcel');
    expect(BOARD_LABELS.Eduqas).toBe('WJEC Eduqas');
    expect(BOARD_LABELS.not_sure).toBe('Not sure');
  });
});

describe('isTiered', () => {
  it('marks the tiered GCSEs', () => {
    for (const id of [
      'gcse-maths',
      'gcse-combined-science',
      'gcse-biology',
      'gcse-chemistry',
      'gcse-physics',
      'gcse-french',
      'gcse-spanish',
      'gcse-german',
      'gcse-statistics',
    ]) {
      expect(isTiered(id)).toBe(true);
    }
  });

  it('does not tier other GCSEs or any A-Level', () => {
    expect(isTiered('gcse-history')).toBe(false);
    expect(isTiered('gcse-film-studies')).toBe(false);
    expect(isTiered('alevel-maths')).toBe(false);
  });

  it('finds subjects by id', () => {
    expect(findSubject('gcse-maths')?.name).toBe('Maths');
    expect(findSubject('nope')).toBeUndefined();
  });
});

describe('toCheckLaterCount', () => {
  it('counts every board and tier left as not sure', () => {
    expect(
      toCheckLaterCount([
        { subjectId: 'gcse-maths', board: 'not_sure', tier: 'not_sure' },
        { subjectId: 'gcse-history', board: 'AQA', tier: 'none' },
        { subjectId: 'gcse-physics', board: 'OCR', tier: 'not_sure' },
      ]),
    ).toBe(3);
  });
});

describe('validateSubjectChoices', () => {
  it('accepts subjects, boards and tiers that fit the school year', () => {
    expect(
      validateSubjectChoices(11, [
        { subjectId: 'gcse-maths', board: 'Edexcel', tier: 'higher' },
        { subjectId: 'gcse-film-studies', board: 'Eduqas', tier: 'none' },
        { subjectId: 'gcse-history', board: 'not_sure', tier: 'none' },
      ]),
    ).toEqual([]);
  });

  it('rejects a subject from the other level', () => {
    expect(
      validateSubjectChoices(12, [{ subjectId: 'gcse-maths', board: 'AQA', tier: 'higher' }]),
    ).toEqual([{ subjectId: 'gcse-maths', problem: 'wrong_level' }]);
  });

  it('rejects an unknown subject', () => {
    expect(
      validateSubjectChoices(10, [{ subjectId: 'gcse-astrology', board: 'AQA', tier: 'none' }]),
    ).toEqual([{ subjectId: 'gcse-astrology', problem: 'unknown_subject' }]);
  });

  it('rejects a board that does not offer the subject', () => {
    expect(
      validateSubjectChoices(10, [{ subjectId: 'gcse-film-studies', board: 'AQA', tier: 'none' }]),
    ).toEqual([{ subjectId: 'gcse-film-studies', problem: 'board_not_offered' }]);
  });

  it('needs a tier choice for tiered subjects and none for the rest', () => {
    expect(
      validateSubjectChoices(10, [
        { subjectId: 'gcse-maths', board: 'AQA', tier: 'none' },
        { subjectId: 'gcse-history', board: 'AQA', tier: 'higher' },
      ]),
    ).toEqual([
      { subjectId: 'gcse-maths', problem: 'tier_needed' },
      { subjectId: 'gcse-history', problem: 'not_tiered' },
    ]);
  });

  it('rejects the same subject twice', () => {
    expect(
      validateSubjectChoices(10, [
        { subjectId: 'gcse-history', board: 'AQA', tier: 'none' },
        { subjectId: 'gcse-history', board: 'OCR', tier: 'none' },
      ]),
    ).toEqual([{ subjectId: 'gcse-history', problem: 'duplicate' }]);
  });

  it('rejects every subject when the year is outside onboarding', () => {
    expect(
      validateSubjectChoices(8, [{ subjectId: 'gcse-history', board: 'AQA', tier: 'none' }]),
    ).toEqual([{ subjectId: 'gcse-history', problem: 'wrong_level' }]);
  });
});
