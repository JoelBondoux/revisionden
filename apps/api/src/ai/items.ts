import { z } from 'zod';
import type { MarkPoint, ShortAnswerQuestion } from './marking';

// The item format from content/schemas/item.schema.json, as stored in `items.body` and
// `items.answer`. `mark_points` is an optional structured form with rule wording per point.
const bodySchema = z.object({
  prompt: z.string().min(1),
  marks: z.number().int().min(1).max(20),
  mark_scheme: z.array(z.string().min(1)).optional(),
  mark_points: z
    .array(
      z.object({
        code: z.string().regex(/^[A-Z]{1,2}[0-9]$/),
        description: z.string().min(1),
        accepted: z.array(z.string().min(1)).default([]),
      }),
    )
    .optional(),
});
const answerSchema = z.object({ accepted: z.array(z.string().min(1)).default([]) });

const MARK_SCHEME_LINE = /^([A-Z]{1,2}[0-9])\s+(?:for\s+)?(.+)$/;

/** Turns a stored short-answer item into a marking question, or null if it cannot be marked. */
export function toShortAnswerQuestion(item: {
  type: string;
  topicId: string;
  body: unknown;
  answer: unknown;
}): ShortAnswerQuestion | null {
  if (item.type !== 'short_answer') return null;
  const body = bodySchema.safeParse(item.body);
  const answer = answerSchema.safeParse(item.answer ?? {});
  if (!body.success || !answer.success) return null;
  const accepted = answer.data.accepted;

  let points: MarkPoint[];
  if (body.data.mark_points) {
    points = body.data.mark_points;
  } else if (body.data.mark_scheme) {
    const parsed = body.data.mark_scheme.map((line) => MARK_SCHEME_LINE.exec(line.trim()));
    if (parsed.some((m) => !m)) return null;
    // The official wording of a point earns it by rule; the AI only judges other wording.
    points = parsed.map((m) => ({ code: m![1]!, description: m![2]!, accepted: [m![2]!] }));
  } else if (body.data.marks === 1 && accepted.length > 0) {
    points = [
      { code: 'B1', description: `Gives an accepted answer: ${accepted.join('; ')}`, accepted },
    ];
  } else {
    points = [];
  }

  return {
    topic: item.topicId,
    prompt: body.data.prompt,
    marks: body.data.marks,
    acceptedAnswers: accepted,
    points,
  };
}
