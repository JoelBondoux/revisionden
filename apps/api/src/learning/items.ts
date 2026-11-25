import { inArray, type SQL } from 'drizzle-orm';
import {
  markMultipleChoice,
  markNumeric,
  markShortAnswer,
  servableStatuses,
  type LearnItem,
  type MarkResult,
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
      return String(key.expression ?? '');
    }
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
      return markNumeric(key as { value: string; tolerance?: number }, answer);
    case 'flashcard':
      if (typeof answer !== 'boolean') throw wrongShape();
      return { correct: answer, score: answer ? 1 : 0 };
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
