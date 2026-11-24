/**
 * Double AI marking for long answers (docs/VERIFICATION.md section 7, docs/AI.md).
 *
 * Two independent markings against the official mark scheme. Every awarded mark must cite the
 * criterion it meets (a mark point code such as M1, or the level as L3) with evidence from the
 * answer. If either marking is unsure or does not cite the scheme properly, or the two are more
 * than one level (or, for mark points, one mark) apart, the result recommends a teacher check
 * instead of giving a mark. When they agree, the lower marking is used: never over-promise.
 *
 * Kept free of imports and TypeScript-only syntax so the evals harness (evals/) can load it.
 */

export const AI_MARKING_LABEL =
  "Marked by AI. This is a guide to help you improve, not your teacher's mark.";
export const TEACHER_CHECK_MESSAGE =
  'Our two AI markers did not agree closely enough to give a mark. Check with your teacher.';

export type Confidence = 'high' | 'medium' | 'low';

export interface Award {
  /** Mark point code (B1, M1, A2) or level (L3). */
  criterion: string;
  marks: number;
  /** Words from the student's answer that meet the criterion. */
  evidence: string;
}

export interface AiMarking {
  marks: number;
  /** Required for level-marked schemes. */
  level?: number;
  confidence: Confidence;
  awards: Award[];
}

export type MarkingScheme =
  | { type: 'levels'; levels: { level: number; marks: [number, number] }[] }
  | { type: 'points'; points: { code: string }[] };

export type DoubleMarkResult =
  | {
      outcome: 'marked';
      marks: number;
      level?: number;
      awards: Award[];
      label: string;
      markings: [AiMarking, AiMarking];
    }
  | {
      outcome: 'check_with_teacher';
      reason: string;
      message: string;
      label: string;
      markings: AiMarking[];
    };

const pointValue = (code: string) => Number(code.slice(-1));

/** Problems with one marking against the scheme; empty when it is usable. */
export function validateMarking(marking: AiMarking, scheme: MarkingScheme): string[] {
  const problems: string[] = [];
  if (marking.awards.length === 0) problems.push('every mark must cite a criterion');
  const total = marking.awards.reduce((sum, a) => sum + a.marks, 0);
  if (total !== marking.marks) problems.push(`awards add up to ${total}, not ${marking.marks}`);
  for (const a of marking.awards) {
    if (!a.evidence.trim()) problems.push(`the award for ${a.criterion} quotes no evidence`);
  }

  if (scheme.type === 'levels') {
    const level = scheme.levels.find((l) => l.level === marking.level);
    if (!level) {
      problems.push(`level ${marking.level} is not in the mark scheme`);
    } else {
      const [low, high] = level.marks;
      if (marking.marks < low || marking.marks > high) {
        problems.push(`${marking.marks} marks is outside level ${level.level} (${low} to ${high})`);
      }
    }
    for (const a of marking.awards) {
      if (!scheme.levels.some((l) => `L${l.level}` === a.criterion)) {
        problems.push(`award cites ${a.criterion}, which is not in the mark scheme`);
      } else if (a.criterion !== `L${marking.level}`) {
        problems.push(`award cites ${a.criterion} but the marking gives level ${marking.level}`);
      }
    }
  } else {
    const seen = new Set<string>();
    for (const a of marking.awards) {
      const point = scheme.points.find((p) => p.code === a.criterion);
      if (!point) {
        problems.push(`award cites ${a.criterion}, which is not in the mark scheme`);
        continue;
      }
      if (seen.has(a.criterion)) problems.push(`${a.criterion} is awarded more than once`);
      seen.add(a.criterion);
      if (a.marks > pointValue(point.code) || a.marks < 0) {
        problems.push(`${a.criterion} is worth at most ${pointValue(point.code)}`);
      }
    }
  }
  return problems;
}

const teacherCheck = (reason: string, markings: AiMarking[]): DoubleMarkResult => ({
  outcome: 'check_with_teacher',
  reason,
  message: TEACHER_CHECK_MESSAGE,
  label: AI_MARKING_LABEL,
  markings,
});

/** Combines two independent markings into one result (see the rules at the top). */
export function reconcileMarkings(
  first: AiMarking,
  second: AiMarking,
  scheme: MarkingScheme,
): DoubleMarkResult {
  const markings: [AiMarking, AiMarking] = [first, second];
  const problems = [
    ...validateMarking(first, scheme).map((p) => `first marking: ${p}`),
    ...validateMarking(second, scheme).map((p) => `second marking: ${p}`),
  ];
  if (problems.length) return teacherCheck(problems.join('; '), markings);
  if (first.confidence !== 'high' || second.confidence !== 'high') {
    return teacherCheck('a marker was not confident', markings);
  }
  const byLevel = scheme.type === 'levels';
  const gap = byLevel
    ? Math.abs(first.level! - second.level!)
    : Math.abs(first.marks - second.marks);
  if (gap > 1) {
    return teacherCheck(
      `the two markings are ${gap} ${byLevel ? 'levels' : 'marks'} apart`,
      markings,
    );
  }
  const lower = second.marks < first.marks ? second : first;
  return {
    outcome: 'marked',
    marks: lower.marks,
    ...(byLevel ? { level: lower.level } : {}),
    awards: lower.awards,
    label: AI_MARKING_LABEL,
    markings,
  };
}

export interface MarkingRequest {
  question: string;
  answer: string;
  scheme: MarkingScheme;
}

export interface Marker {
  /** Provider and model, for example "anthropic:claude-opus-5-5". */
  id: string;
  mark(request: MarkingRequest): Promise<AiMarking>;
}

/** Marks an answer twice, independently and in parallel, then reconciles the two markings. */
export async function markTwice(
  request: MarkingRequest,
  [a, b]: [Marker, Marker],
): Promise<DoubleMarkResult> {
  if (a.id === b.id) throw new Error('double marking needs two different markers');
  let markings: [AiMarking, AiMarking];
  try {
    markings = await Promise.all([a.mark(request), b.mark(request)]);
  } catch (err) {
    return teacherCheck(`a marker failed: ${(err as Error).message}`, []);
  }
  return reconcileMarkings(markings[0], markings[1], request.scheme);
}
