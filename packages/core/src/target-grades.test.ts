import { describe, expect, it } from 'vitest';
import {
  GRADE_SCALES,
  gradeScaleFor,
  isAllowedTarget,
  TargetGradeRequestSchema,
  ParentTargetGradesSchema,
} from './target-grades';

const maths = (tier: 'foundation' | 'higher' | 'none' | 'not_sure', board = 'Edexcel') => ({
  subjectId: 'gcse-maths',
  board,
  tier,
});

describe('grade scales', () => {
  it('gives the Edexcel GCSE Maths higher tier grades 9 to 3 and U, best first', () => {
    expect(gradeScaleFor(maths('higher'))).toEqual(['9', '8', '7', '6', '5', '4', '3', 'U']);
  });

  it('gives the foundation tier grades 5 to 1 and U', () => {
    expect(gradeScaleFor(maths('foundation'))).toEqual(['5', '4', '3', '2', '1', 'U']);
  });

  it('gives the whole 9 to 1 scale while the tier is not chosen', () => {
    expect(gradeScaleFor(maths('not_sure'))).toEqual([
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
      '2',
      '1',
      'U',
    ]);
  });

  it('has no scale where no official citation is stored yet', () => {
    expect(gradeScaleFor(maths('higher', 'AQA'))).toBeNull();
    expect(gradeScaleFor(maths('higher', 'not_sure'))).toBeNull();
    expect(gradeScaleFor({ subjectId: 'alevel-maths', board: 'Edexcel', tier: 'none' })).toBeNull();
  });

  it('cites the official specification for every scale', () => {
    for (const scale of GRADE_SCALES) {
      expect(scale.citations.length).toBeGreaterThan(0);
      for (const c of scale.citations) {
        expect(c.source_type).toBe('specification');
        expect(c.url).toMatch(/^https:\/\/qualifications\.pearson\.com\//);
        expect(c.quote.split(/\s+/).length).toBeLessThanOrEqual(50);
      }
    }
  });
});

describe('allowed targets', () => {
  it('accepts a grade on the scale and refuses one off it', () => {
    expect(isAllowedTarget(maths('higher'), '7')).toBe(true);
    expect(isAllowedTarget(maths('higher'), '2')).toBe(false);
    expect(isAllowedTarget(maths('foundation'), '6')).toBe(false);
    expect(isAllowedTarget(maths('higher'), 'A*')).toBe(false);
  });

  it('refuses every grade where there is no scale', () => {
    expect(isAllowedTarget(maths('higher', 'AQA'), '7')).toBe(false);
  });
});

describe('target grade schemas', () => {
  it('takes a grade or null to clear it', () => {
    expect(TargetGradeRequestSchema.parse({ targetGrade: '7' })).toEqual({ targetGrade: '7' });
    expect(TargetGradeRequestSchema.parse({ targetGrade: null })).toEqual({ targetGrade: null });
    expect(() => TargetGradeRequestSchema.parse({})).toThrow();
    expect(() => TargetGradeRequestSchema.parse({ targetGrade: '' })).toThrow();
  });

  it('describes the parent view: one row per enrolled subject', () => {
    expect(
      ParentTargetGradesSchema.parse({
        subjects: [
          { subjectId: 'gcse-maths', name: 'Maths', targetGrade: '7', grades: ['9', 'U'] },
          { subjectId: 'gcse-history', name: 'History', targetGrade: null, grades: null },
        ],
      }).subjects,
    ).toHaveLength(2);
  });
});
