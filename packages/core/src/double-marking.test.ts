import { describe, expect, it } from 'vitest';
import {
  AI_MARKING_LABEL,
  TEACHER_CHECK_MESSAGE,
  markTwice,
  reconcileMarkings,
  validateMarking,
  type AiMarking,
  type MarkingScheme,
} from './double-marking';

const levels: MarkingScheme = {
  type: 'levels',
  levels: [
    { level: 1, marks: [1, 3] },
    { level: 2, marks: [4, 6] },
    { level: 3, marks: [7, 9] },
    { level: 4, marks: [10, 12] },
  ],
};
const points: MarkingScheme = {
  type: 'points',
  points: [{ code: 'B1' }, { code: 'M1' }, { code: 'A2' }],
};

const atLevel = (
  level: number,
  marks: number,
  confidence: AiMarking['confidence'] = 'high',
): AiMarking => ({
  level,
  marks,
  confidence,
  awards: [{ criterion: `L${level}`, marks, evidence: 'Fixture evidence from the answer.' }],
});

describe('validateMarking', () => {
  it('accepts a level marking that cites its level and stays within its mark range', () => {
    expect(validateMarking(atLevel(3, 8), levels)).toEqual([]);
  });

  it('rejects a level that is not in the scheme', () => {
    expect(validateMarking(atLevel(5, 13), levels)).toContain('level 5 is not in the mark scheme');
  });

  it('rejects marks outside the range of the chosen level', () => {
    expect(validateMarking(atLevel(2, 8), levels)).toContain('8 marks is outside level 2 (4 to 6)');
  });

  it('rejects an award that cites no criterion, or one the scheme does not have', () => {
    const m = { ...atLevel(2, 5), awards: [{ criterion: 'L9', marks: 5, evidence: 'x' }] };
    expect(validateMarking(m, levels)).toContain('award cites L9, which is not in the mark scheme');
    const none = { ...atLevel(2, 5), awards: [] };
    expect(validateMarking(none, levels)).toContain('every mark must cite a criterion');
  });

  it('rejects awards that do not add up to the marks given', () => {
    const m: AiMarking = {
      marks: 3,
      confidence: 'high',
      awards: [
        { criterion: 'B1', marks: 1, evidence: 'x' },
        { criterion: 'M1', marks: 1, evidence: 'y' },
      ],
    };
    expect(validateMarking(m, points)).toContain('awards add up to 2, not 3');
  });

  it('rejects more marks for a point than it is worth, or the same point twice', () => {
    const m: AiMarking = {
      marks: 3,
      confidence: 'high',
      awards: [
        { criterion: 'B1', marks: 2, evidence: 'x' },
        { criterion: 'M1', marks: 1, evidence: 'y' },
      ],
    };
    expect(validateMarking(m, points)).toContain('B1 is worth at most 1');
    const twice: AiMarking = {
      marks: 2,
      confidence: 'high',
      awards: [
        { criterion: 'M1', marks: 1, evidence: 'x' },
        { criterion: 'M1', marks: 1, evidence: 'y' },
      ],
    };
    expect(validateMarking(twice, points)).toContain('M1 is awarded more than once');
  });

  it('rejects a level award that cites a different level from the one given', () => {
    const m = { ...atLevel(2, 5), awards: [{ criterion: 'L3', marks: 5, evidence: 'x' }] };
    expect(validateMarking(m, levels)).toContain('award cites L3 but the marking gives level 2');
  });

  it('rejects a mark point that is not in the scheme', () => {
    const m: AiMarking = {
      marks: 1,
      confidence: 'high',
      awards: [{ criterion: 'C1', marks: 1, evidence: 'x' }],
    };
    expect(validateMarking(m, points)).toContain('award cites C1, which is not in the mark scheme');
  });

  it('rejects an award without evidence from the answer', () => {
    const m = { ...atLevel(2, 5), awards: [{ criterion: 'L2', marks: 5, evidence: ' ' }] };
    expect(validateMarking(m, levels)).toContain('the award for L2 quotes no evidence');
  });
});

describe('reconcileMarkings', () => {
  it('gives a mark when both markers agree within one level, taking the lower one', () => {
    const r = reconcileMarkings(atLevel(3, 8), atLevel(2, 6), levels);
    expect(r).toMatchObject({ outcome: 'marked', level: 2, marks: 6, label: AI_MARKING_LABEL });
    if (r.outcome === 'marked') expect(r.awards[0]!.criterion).toBe('L2');
  });

  it('says check with your teacher when the markers are more than one level apart', () => {
    const r = reconcileMarkings(atLevel(4, 11), atLevel(2, 5), levels);
    expect(r).toMatchObject({
      outcome: 'check_with_teacher',
      reason: 'the two markings are 2 levels apart',
      message: TEACHER_CHECK_MESSAGE,
      label: AI_MARKING_LABEL,
    });
  });

  it('says check with your teacher when either marker is unsure', () => {
    const r = reconcileMarkings(atLevel(3, 8), atLevel(3, 8, 'medium'), levels);
    expect(r).toMatchObject({
      outcome: 'check_with_teacher',
      reason: 'a marker was not confident',
    });
  });

  it('says check with your teacher when a marking does not cite the mark scheme properly', () => {
    const r = reconcileMarkings(atLevel(3, 8), atLevel(2, 8), levels);
    expect(r).toMatchObject({ outcome: 'check_with_teacher' });
    if (r.outcome === 'check_with_teacher')
      expect(r.reason).toMatch(/second marking: 8 marks is outside level 2/);
  });

  it('for mark-point schemes, more than one mark apart counts as a disagreement', () => {
    const one: AiMarking = {
      marks: 1,
      confidence: 'high',
      awards: [{ criterion: 'B1', marks: 1, evidence: 'x' }],
    };
    const three: AiMarking = {
      marks: 3,
      confidence: 'high',
      awards: [
        { criterion: 'B1', marks: 1, evidence: 'x' },
        { criterion: 'A2', marks: 2, evidence: 'y' },
      ],
    };
    const two: AiMarking = {
      marks: 2,
      confidence: 'high',
      awards: [
        { criterion: 'B1', marks: 1, evidence: 'x' },
        { criterion: 'M1', marks: 1, evidence: 'y' },
      ],
    };
    expect(reconcileMarkings(one, three, points)).toMatchObject({
      outcome: 'check_with_teacher',
      reason: 'the two markings are 2 marks apart',
    });
    expect(reconcileMarkings(two, three, points)).toMatchObject({ outcome: 'marked', marks: 2 });
  });

  it('always carries the AI label', () => {
    expect(AI_MARKING_LABEL).toBe(
      "Marked by AI. This is a guide to help you improve, not your teacher's mark.",
    );
  });
});

describe('markTwice', () => {
  const request = { question: 'Fixture?', answer: 'Fixture answer', scheme: levels };

  it('asks two independent markers and reconciles their markings', async () => {
    const seen: string[] = [];
    const marker = (id: string, m: AiMarking) => ({
      id,
      mark: async () => {
        seen.push(id);
        return m;
      },
    });
    const r = await markTwice(request, [marker('a', atLevel(3, 8)), marker('b', atLevel(3, 7))]);
    expect(seen.sort()).toEqual(['a', 'b']);
    expect(r).toMatchObject({ outcome: 'marked', marks: 7 });
  });

  it('refuses to use the same marker twice', async () => {
    const m = { id: 'same', mark: async () => atLevel(3, 8) };
    await expect(markTwice(request, [m, m])).rejects.toThrow('two different markers');
  });

  it('a marker that fails means check with your teacher, never a guessed mark', async () => {
    const ok = { id: 'a', mark: async () => atLevel(3, 8) };
    const broken = {
      id: 'b',
      mark: async (): Promise<AiMarking> => {
        throw new Error('provider unavailable');
      },
    };
    const r = await markTwice(request, [ok, broken]);
    expect(r).toMatchObject({
      outcome: 'check_with_teacher',
      reason: 'a marker failed: provider unavailable',
    });
  });
});
