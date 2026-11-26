import { describe, expect, it } from 'vitest';
import { itemAnswer, itemBody, type ContentItem } from './content-sync';
import { correctAnswerText, markItem, toLearnItem, type ItemRow } from './items';

// Lesson pilot W8: the interactive area model for factorising x^2 + bx + c.
const content: ContentItem = {
  id: 'gcse-maths-h-a4-area-0002',
  topic: 'gcse-maths-h-a4',
  type: 'area_model',
  mode: 'guided',
  difficulty: 1,
  prompt: 'Make x^2 + 6x + 8 into a rectangle.',
  quadratic: { b: 6, c: 8 },
  answer: { pair: [2, 4] },
  hint: 'List the pairs that multiply to 8.',
  explanation: '2 × 4 = 8 and 2 + 4 = 6, so x^2 + 6x + 8 = (x + 2)(x + 4).',
  marks: 1,
  source_ref: '1MA1 A4',
  checked_by: ['maths-engine'],
  tags: ['interactive-pilot'],
  verification: { status: 'draft', version: 1 },
};

const row = {
  id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  topicId: 'gcse-maths-h-a4',
  type: 'area_model',
  status: 'draft',
  learningPoint: null,
  sourceRef: null,
  body: itemBody(content),
  answer: itemAnswer(content),
} as unknown as ItemRow;

describe('area model items in the API (W8)', () => {
  it('stores the mode and quadratic for the student, and keeps the pair on the server', () => {
    expect(itemBody(content)).toMatchObject({
      prompt: content.prompt,
      mode: 'guided',
      quadratic: { b: 6, c: 8 },
      hint: content.hint,
    });
    expect(itemBody(content)).not.toHaveProperty('answer');
    expect(itemAnswer(content).key).toEqual({ pair: [2, 4] });
  });

  it('sends the student the prompt, mode and quadratic, never the pair', () => {
    const item = toLearnItem(row, 'Simplifying, expanding and factorising');
    expect(item).toMatchObject({
      type: 'area_model',
      mode: 'guided',
      quadratic: { b: 6, c: 8 },
      prompt: content.prompt,
      hint: content.hint,
      draft: true,
    });
    expect(item).not.toHaveProperty('answer');
    expect(JSON.stringify(item)).not.toContain('"pair"');
  });

  it('marks the pair right in either order, and wrong otherwise', async () => {
    expect(await markItem(row, '2,4', undefined)).toEqual({ correct: true, score: 1 });
    expect(await markItem(row, '4,2', undefined)).toEqual({ correct: true, score: 1 });
    expect(await markItem(row, '1,8', undefined)).toEqual({ correct: false, score: 0 });
  });

  it('refuses an answer that is not two whole numbers', async () => {
    await expect(markItem(row, 'x+2', undefined)).rejects.toMatchObject({ status: 400 });
    await expect(markItem(row, 3, undefined)).rejects.toMatchObject({ status: 400 });
  });

  it('passes on the "Did this help?" flag from the lesson\'s last tile step', () => {
    const last = { ...content, ask_helped: true };
    expect(itemBody(last).askHelped).toBe(true);
    expect(itemBody(content).askHelped).toBeUndefined();
    const lastRow = { ...row, body: itemBody(last) } as unknown as ItemRow;
    expect(toLearnItem(lastRow, 'A4')).toMatchObject({ askHelped: true });
  });

  it('shows the right answer as the two brackets', () => {
    expect(correctAnswerText(row)).toBe('(x + 2)(x + 4)');
  });
});
