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
  "For the hint, explanation and model solution steps: Carry out each step it gives literally on this question's numbers. If doing exactly what it says gives a wrong value or does not lead to the marked answer, report factual_error.",
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
  // Option numbers count from 0 (answer.option, distractor:N). Say so and show the correct
  // option's text: a reviewer reading them as 1-based fails correct items as wrong answers.
  const choices = Array.isArray(item.options) && typeof item.answer?.option === 'number';
  if (choices) {
    shown.answer = {
      ...item.answer,
      correct_option_text: item.options[item.answer.option],
    };
  }
  const numbering = choices
    ? [
        '',
        'Options are numbered from 0: "option": 0 is the first option. In the sources,',
        '"distractor:N" means wrong option N, also counted from 0.',
      ]
    : [];
  // The answer normaliser (#133) marks typed answers fairly, so the reviewer must not ask for
  // forms it already accepts (packages/core/src/answer-normalise.ts).
  const typed = Array.isArray(item.answer?.accepted)
    ? [
        '',
        'Typed answers are normalised before marking. For maths answers, spaces and case are ignored; ×, ·, * (and x between two numbers) are one multiply sign, left out where it is not needed; −, – and — are a minus; ÷ is /; superscripts are ^; ≤ and ≥ are <= and >=; √ and sqrt are the same. For word answers, case and extra spaces are ignored. So do not report missing versions that differ only in these ways.',
      ]
    : [];
  // What the maths engine really checked (mathsChecks in scripts/content/validate.mjs): a numeric
  // answer against verify.expression; a worked answer, and its model solution steps when it has
  // them. Never the explanation or the hint, so the reviewer must not be told they were checked.
  const checked =
    item.type === 'numeric'
      ? 'the answer'
      : item.type === 'worked_maths'
        ? Array.isArray(item.steps) && item.steps.length > 0
          ? 'the answer and the model solution steps'
          : 'the answer'
        : null;
  const engine = checked
    ? `The maths engine has checked ${checked}, and nothing else.`
    : 'The maths engine has not checked this item.';
  // A hint nudges the method: what the engine checked backs it, not necessarily the specification
  // text. A new fact in it still needs a source (rule 7).
  const hint =
    typeof item.hint === 'string' && item.hint.trim() !== ''
      ? [
          '',
          `The hint is a method nudge, not a statement of the specification. ${engine} Judge the hint against ${checked ?? 'the quoted sources'}${checked ? ' and the quoted sources' : ''}. Report a problem only if the hint reveals the answer (wording), is not consistent with ${checked ?? 'the item'} (factual_error), is not mathematically correct and suitable for the age group (factual_error or wording), or makes a new factual claim that ${checked ? 'the checked work does not show' : 'the quoted sources do not support'}; a new factual claim needs a quoted source like any other (unsupported_claim), even if the explanation repeats it. Do not report a hint as outside_specification or unsupported_claim only because its method is not described in the quoted sources.`,
        ]
      : [];
  // The explanation is never engine-checked: the reviewer checks it independently (Codex on #262).
  const explanation =
    typeof item.explanation === 'string' && item.explanation.trim() !== ''
      ? [
          '',
          'The explanation has not been checked by the maths engine. Check it yourself, step by step, as independently as the rest of the item: any factual claim in it needs a quoted source (unsupported_claim), and any step that gives a wrong value is a factual_error.',
        ]
      : [];
  // any_order (#133): marking accepts reordered answers, so the reviewer must not ask for them.
  const order =
    item.answer?.any_order === true
      ? [
          '',
          'The answer has "any_order": true. Marking accepts products and sums in any order, a ' +
            'list of values in any order and an equation either way round, so do not report ' +
            'missing reordered versions of the accepted answers. Coordinates and inequalities ' +
            'are never reordered.',
        ]
      : [];
  const sources = item.citations.map(
    (c, i) =>
      `${i + 1}. ${c.publisher}, ${c.title} (${c.document_ref}), ${c.location}; supports ${c.supports.join(', ')}:\n` +
      `   "${c.quote ?? '(no quote yet)'}"`,
  );
  return {
    system: SYSTEM,
    prompt: [
      `Item:\n${JSON.stringify(shown, null, 2)}`,
      ...numbering,
      ...typed,
      ...hint,
      ...explanation,
      ...order,
      '',
      'Official sources:',
      ...sources,
    ].join('\n'),
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
