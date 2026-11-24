import { z } from 'zod';
import type { MarkPoint, ShortAnswerQuestion } from './marking';

// The item format stored by the content sync (learning/content-sync.ts, ItemBody and
// ItemAnswer): body.prompt and body.marks are shown to the student; answer.key is the content
// item's answer and answer.markScheme its mark points ("B1 for ..."). markPoints is an optional
// structured form with rule wording per point.
const bodySchema = z.object({
  prompt: z.string().min(1),
  marks: z.number().int().min(1).max(20),
});
const answerSchema = z.object({
  key: z.object({ accepted: z.array(z.string().min(1)).default([]) }).default({}),
  markScheme: z.array(z.string().min(1)).optional(),
  markPoints: z
    .array(
      z.object({
        code: z.string().regex(/^[A-Z]{1,2}[0-9]$/),
        description: z.string().min(1),
        accepted: z.array(z.string().min(1)).default([]),
      }),
    )
    .optional(),
});

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
  const accepted = answer.data.key.accepted;

  let points: MarkPoint[];
  if (answer.data.markPoints) {
    points = answer.data.markPoints;
  } else if (answer.data.markScheme) {
    const parsed = answer.data.markScheme.map((line) => MARK_SCHEME_LINE.exec(line.trim()));
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
