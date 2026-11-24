/**
 * Short-answer marking (docs/VERIFICATION.md section 7): rule match against the official mark
 * scheme points first; the AI only judges wording variants for the points the rules did not
 * award, and must cite which point each mark meets, quoting the student's own words. Anything
 * uncertain becomes "check with your teacher", never a guess.
 */
import { z } from 'zod';
import type { AiGateway } from './gateway';

export const AI_LABEL =
  "Marked by AI. This is a guide to help you improve, not your teacher's mark.";
export const CHECK_WITH_TEACHER = 'Not sure about this one. Check with your teacher.';

export interface MarkPoint {
  /** Mark scheme code, for example B1. */
  code: string;
  description: string;
  /** Wording that earns the point by rule (from the official mark scheme). */
  accepted: string[];
}

export interface ShortAnswerQuestion {
  topic: string;
  prompt: string;
  marks: number;
  /** Whole answers that earn full marks by rule. */
  acceptedAnswers: string[];
  points: MarkPoint[];
}

export interface AwardedPoint {
  code: string;
  by: 'rule' | 'ai';
  /** For AI awards: the words in the answer that meet the point. */
  evidence?: string;
}

export type MarkResult =
  | {
      status: 'marked';
      markedBy: 'rules' | 'ai';
      score: number;
      maxScore: number;
      awarded: AwardedPoint[];
      feedback?: string;
      label?: typeof AI_LABEL;
    }
  | {
      status: 'check_with_teacher';
      maxScore: number;
      /** Only the marks the rules awarded with certainty. */
      awarded: AwardedPoint[];
      message: typeof CHECK_WITH_TEACHER;
      label?: typeof AI_LABEL;
    };

export const MAX_ANSWER_LENGTH = 2000;

/** Lower case, punctuation turned into spaces, spaces collapsed. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Words that can flip the meaning of matched wording; such answers go to the AI (or a teacher).
const NEGATION = /\b(not|no|never|none|nor|cannot|cant|isnt|doesnt|dont|wont|arent|wasnt)\b/;
const negated = (normalisedText: string) => NEGATION.test(normalisedText.replace(/ t\b/g, 't'));

const contains = (haystack: string, needle: string) =>
  needle.length > 0 && ` ${haystack} `.includes(` ${needle} `);

const aiOutputSchema = z.object({
  points: z
    .array(z.object({ code: z.string(), met: z.boolean(), evidence: z.string().max(300) }))
    .max(20),
  sure: z.boolean(),
  feedback: z.string().max(400),
});
type AiOutput = z.infer<typeof aiOutputSchema>;

const aiJsonSchema = {
  type: 'object',
  properties: {
    points: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          met: { type: 'boolean' },
          evidence: { type: 'string' },
        },
        required: ['code', 'met', 'evidence'],
        additionalProperties: false,
      },
    },
    sure: { type: 'boolean' },
    feedback: { type: 'string' },
  },
  required: ['points', 'sure', 'feedback'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You check a student's short answer against official mark scheme points for a UK GCSE or A-Level question.
You receive JSON with the topic, the question, the student's answer and the mark points still to decide.
For every mark point, decide whether the answer meets it, allowing different wording with the same meaning.
For each point return its code, met (true or false) and evidence: the exact words copied from the student's answer that meet the point, or an empty string when it is not met.
Only use the codes given. Do not award a point for vague or partly correct wording.
Set sure to false if you are unsure about any point.
feedback: one or two short, encouraging sentences for a teenager about what went well and one next step. Do not rewrite the answer or give a model answer.`;

const checkWithTeacher = (
  maxScore: number,
  awarded: AwardedPoint[],
  usedAi: boolean,
): MarkResult => ({
  status: 'check_with_teacher',
  maxScore,
  awarded,
  message: CHECK_WITH_TEACHER,
  ...(usedAi ? { label: AI_LABEL } : {}),
});

/** True when the AI decided every remaining point exactly once, citing words from the answer. */
function trustworthy(output: AiOutput, remaining: MarkPoint[], answer: string): boolean {
  if (!output.sure) return false;
  const codes = output.points.map((p) => p.code);
  if (codes.length !== remaining.length || new Set(codes).size !== codes.length) return false;
  if (!remaining.every((p) => codes.includes(p.code))) return false;
  const normalisedAnswer = normalise(answer);
  return output.points.every((p) => !p.met || contains(normalisedAnswer, normalise(p.evidence)));
}

export async function markShortAnswer(input: {
  question: ShortAnswerQuestion;
  answer: string;
  studentId: string;
  gateway: AiGateway;
}): Promise<MarkResult> {
  const { question, answer } = input;
  const maxScore = question.marks;
  const text = normalise(answer);

  if (text === '') {
    return { status: 'marked', markedBy: 'rules', score: 0, maxScore, awarded: [] };
  }
  // Rule matching is skipped for answers with a negation, which could reverse the wording.
  const rulesApply = !negated(text);

  if (rulesApply && question.acceptedAnswers.some((a) => contains(text, normalise(a)))) {
    return {
      status: 'marked',
      markedBy: 'rules',
      score: maxScore,
      maxScore,
      awarded: question.points.map((p) => ({ code: p.code, by: 'rule' })),
    };
  }

  const byRule: AwardedPoint[] = question.points
    .filter((p) => rulesApply && p.accepted.some((a) => contains(text, normalise(a))))
    .map((p) => ({ code: p.code, by: 'rule' }));
  const ruleCodes = new Set(byRule.map((a) => a.code));
  const remaining = question.points.filter((p) => !ruleCodes.has(p.code));

  if (byRule.length >= maxScore || (remaining.length === 0 && question.points.length > 0)) {
    return {
      status: 'marked',
      markedBy: 'rules',
      score: Math.min(byRule.length, maxScore),
      maxScore,
      awarded: byRule,
    };
  }
  // No official mark points to check wording against: the AI may not mark it.
  if (remaining.length === 0) return checkWithTeacher(maxScore, byRule, false);

  const { output } = await input.gateway.run({
    studentId: input.studentId,
    job: 'short_answer_marking',
    system: SYSTEM_PROMPT,
    user: JSON.stringify({
      topic: question.topic,
      question: question.prompt,
      answer,
      mark_points: remaining.map((p) => ({ code: p.code, description: p.description })),
    }),
    schema: aiOutputSchema,
    jsonSchema: aiJsonSchema,
    maxTokens: 2000,
  });

  if (!trustworthy(output, remaining, answer)) return checkWithTeacher(maxScore, byRule, true);

  const byAi: AwardedPoint[] = output.points
    .filter((p) => p.met)
    .map((p) => ({ code: p.code, by: 'ai', evidence: p.evidence }));
  const awarded = [...byRule, ...byAi].sort(
    (a, b) =>
      question.points.findIndex((p) => p.code === a.code) -
      question.points.findIndex((p) => p.code === b.code),
  );
  return {
    status: 'marked',
    markedBy: 'ai',
    score: Math.min(awarded.length, maxScore),
    maxScore,
    awarded,
    feedback: output.feedback,
    label: AI_LABEL,
  };
}
