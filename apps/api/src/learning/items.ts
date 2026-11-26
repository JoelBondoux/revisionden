import { inArray, type SQL } from 'drizzle-orm';
import {
  explainSteps,
  checkAreaModelPair,
  factorisedForm,
  parseAreaModelAnswer,
  markMultipleChoice,
  markNumeric,
  markShortAnswer,
  servableStatuses,
  type LearnItem,
  type MarkResult,
  type NumericKey,
} from '@revisionden/core';
import { items } from '@revisionden/db';
import { ApiError } from '../errors';
import type { ItemAnswer, ItemBody } from './content-sync';
import type { ExpectedAnswer, MathsEngine } from './maths-engine';

export type ItemRow = typeof items.$inferSelect;

/**
 * The content gate (docs/VERIFICATION.md): only verified items, plus drafts when the
 * development flag is on. Every query that serves or accepts an item uses this.
 */
export const servableItem = (serveDrafts: boolean): SQL =>
  inArray(items.status, servableStatuses(serveDrafts));

const body = (row: ItemRow) => row.body as ItemBody;
const answerOf = (row: ItemRow) => row.answer as ItemAnswer;

/** Shapes a stored item for a student. The answer key never leaves the server. */
export function toLearnItem(row: ItemRow, topicTitle: string): LearnItem {
  const b = body(row);
  const base = {
    id: row.id,
    topicId: row.topicId,
    topicTitle,
    draft: row.status !== 'verified',
    ...(b.hint ? { hint: b.hint } : {}),
    ...(row.learningPoint ? { learningPoint: row.learningPoint } : {}),
    ...(helpSteps(row).length > 0 ? { canHelp: true as const } : {}),
    ...(row.contentId ? { contentId: row.contentId } : {}),
  };
  const prompt = b.prompt ?? '';
  switch (row.type) {
    case 'multiple_choice':
      return { ...base, type: 'multiple_choice', prompt, options: b.options ?? [] };
    case 'numeric':
      return { ...base, type: 'numeric', prompt, ...(b.unit ? { unit: b.unit } : {}) };
    case 'flashcard':
      return {
        ...base,
        type: 'flashcard',
        front: b.front ?? '',
        back: b.back ?? '',
        ...(row.sourceRef ? { sourceRef: row.sourceRef } : {}),
      };
    case 'short_answer':
    case 'worked_maths':
    case 'extended_answer':
      return { ...base, type: row.type, prompt };
    case 'area_model':
      return {
        ...base,
        type: 'area_model',
        prompt,
        mode: b.mode ?? 'explore',
        quadratic: b.quadratic ?? { b: 1, c: 1 },
        ...(b.askHelped ? { askHelped: true as const } : {}),
      };
    default:
      throw new Error(`Unknown item type in the database: ${row.type}`);
  }
}

/** The right answer in words, shown with instant feedback and on wrong-answer flashcards. */
export function correctAnswerText(row: ItemRow): string {
  const b = body(row);
  const key = answerOf(row).key ?? {};
  const verify = answerOf(row).verify ?? {};
  switch (row.type) {
    case 'multiple_choice':
      return b.options?.[key.option as number] ?? '';
    case 'short_answer':
      return (key.accepted as string[] | undefined)?.[0] ?? '';
    case 'numeric':
      return [key.value, b.unit].filter(Boolean).join(' ');
    case 'worked_maths': {
      if (Array.isArray(key.solutions)) {
        const prefix = typeof verify.variable === 'string' ? `${verify.variable} = ` : '';
        return (key.solutions as string[]).map((s) => `${prefix}${s}`).join(' or ');
      }
      const subject = typeof key.subject === 'string' ? `${key.subject} = ` : '';
      return `${subject}${String(key.expression ?? '')}`;
    }
    case 'area_model':
      return Array.isArray(key.pair) ? factorisedForm(key.pair as [number, number]) : '';
    default:
      return b.back ?? '';
  }
}

export const explanationOf = (row: ItemRow) => answerOf(row).explanation;

const wrongShape = () =>
  new ApiError(400, 'invalid_answer', 'That answer does not fit this kind of question');

export interface Marked extends MarkResult {
  firstWrongLine?: number | null;
}

/** Marks an answer. Maths working goes to the maths engine; long answers are not marked yet. */
export async function markItem(
  row: ItemRow,
  answer: unknown,
  engine: MathsEngine | undefined,
): Promise<Marked> {
  const key = answerOf(row).key ?? {};
  switch (row.type) {
    case 'multiple_choice':
      if (typeof answer !== 'number') throw wrongShape();
      return markMultipleChoice(key as { option: number }, answer);
    case 'short_answer':
      if (typeof answer !== 'string') throw wrongShape();
      return markShortAnswer(key as { accepted: string[] }, answer);
    case 'numeric':
      if (typeof answer !== 'string') throw wrongShape();
      return markNumeric(key as unknown as NumericKey, answer);
    case 'flashcard':
      if (typeof answer !== 'boolean') throw wrongShape();
      return { correct: answer, score: answer ? 1 : 0 };
    case 'area_model': {
      // The student's pair, "p,q" (W8). Right when it multiplies to c and adds to b.
      const pair = typeof answer === 'string' ? parseAreaModelAnswer(answer) : null;
      const quadratic = body(row).quadratic;
      if (!pair || !quadratic) throw wrongShape();
      const correct = checkAreaModelPair(quadratic, pair).correct;
      return { correct, score: correct ? 1 : 0 };
    }
    case 'worked_maths': {
      if (typeof answer !== 'object' || answer === null || !('lines' in answer)) throw wrongShape();
      if (!engine) {
        throw new ApiError(503, 'maths_engine_unavailable', 'Maths checking is not available');
      }
      const verify = answerOf(row).verify ?? {};
      const expected: ExpectedAnswer = {
        ...(key as ExpectedAnswer),
        ...(verify.form ? { form: verify.form as ExpectedAnswer['form'] } : {}),
      };
      const check = await engine.checkWorking((answer as { lines: string[] }).lines, expected);
      const correct = check.finalAnswerCorrect && check.firstWrongLine === null;
      return { correct, score: correct ? 1 : 0, firstWrongLine: check.firstWrongLine };
    }
    default:
      throw new ApiError(
        422,
        'not_marked_yet',
        'Long answers will be marked by AI soon. For now, compare your answer with your notes.',
      );
  }
}

/**
 * "Help me understand" (F10): the item's verified worked solution, one step at a time, ending on
 * the answer (the F7 Explain steps). Empty for flashcards and long answers, and for items with no
 * worked steps, mark scheme or explanation.
 */
export function helpSteps(row: ItemRow): string[] {
  if (row.type === 'flashcard' || row.type === 'extended_answer') return [];
  const a = answerOf(row);
  return explainSteps({
    steps: a.steps,
    markScheme: a.markScheme,
    explanation: a.explanation,
    answer: correctAnswerText(row),
  });
}
