// Pipeline step 4 (docs/VERIFICATION.md): a reviewer model is told to find errors, ambiguity, a
// second correct option, content outside the specification or claims the sources do not support.
// Any problem, or an unsure reviewer, fails the step.
import { stamp } from './record.mjs';

export const PROBLEM_KINDS = [
  'factual_error',
  'wrong_answer',
  'ambiguity',
  'second_correct_option',
  'outside_specification',
  'unsupported_claim',
  'wording',
];

export const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: PROBLEM_KINDS },
          part: {
            type: 'string',
            description: 'question, answer, option N, explanation, hint ...',
          },
          description: { type: 'string' },
        },
        required: ['kind', 'part', 'description'],
        additionalProperties: false,
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['problems', 'confidence'],
  additionalProperties: false,
};

const SYSTEM = [
  'You are an exacting examiner reviewing a GCSE or A-Level revision item before students see it.',
  'Your job is to find problems, not to approve. Check every part against the quoted official sources.',
  'Report each problem with one of these kinds:',
  '- factual_error: a statement that is wrong;',
  '- wrong_answer: the marked answer is not correct;',
  '- ambiguity: a student could reasonably read the question another way;',
  '- second_correct_option: another option or answer is also correct;',
  '- outside_specification: the content goes beyond the cited specification;',
  '- unsupported_claim: a claim that the quoted sources do not back up;',
  '- wording: unclear, misleading or unsuitable wording for the age group.',
  'Return an empty list only if you find nothing. Say "low" or "medium" confidence if unsure.',
].join('\n');

const PARTS = [
  'type',
  'prompt',
  'front',
  'back',
  'options',
  'answer',
  'marks',
  'mark_scheme',
  'hint',
  'explanation',
  'steps',
];

/** The prompt for the reviewer: the whole item including its answer, plus the cited quotes. */
export function reviewPrompt(item) {
  const shown = Object.fromEntries(
    PARTS.filter((k) => item[k] !== undefined).map((k) => [k, item[k]]),
  );
  const sources = item.citations.map(
    (c, i) =>
      `${i + 1}. ${c.publisher}, ${c.title} (${c.document_ref}), ${c.location}; supports ${c.supports.join(', ')}:\n` +
      `   "${c.quote ?? '(no quote yet)'}"`,
  );
  return {
    system: SYSTEM,
    prompt: [`Item:\n${JSON.stringify(shown, null, 2)}`, '', 'Official sources:', ...sources].join(
      '\n',
    ),
  };
}

/** Runs the adversarial review for one item: { id, result, problems, check }. */
export async function runAdversarialReview(item, provider, { now = () => new Date() } = {}) {
  const { output, modelVersion } = await provider.complete({
    ...reviewPrompt(item),
    schema: REVIEW_SCHEMA,
    schemaName: 'adversarial_review',
  });
  const { problems, confidence } = output;
  const sure = confidence === 'high';
  const result = problems.length === 0 && sure ? 'pass' : 'fail';
  const found = problems.length
    ? problems.map((p) => `${p.kind} (${p.part}): ${p.description}`).join('; ')
    : 'no problems found';
  return {
    id: item.id,
    result,
    problems,
    check: {
      name: 'adversarial-review',
      result,
      tool: `${provider.provider}:${provider.model}`,
      tool_version: modelVersion,
      at: stamp(now()),
      notes: sure ? found : `${found}; confidence ${confidence}`,
    },
  };
}
