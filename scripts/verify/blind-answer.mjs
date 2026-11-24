// Pipeline step 3 (docs/VERIFICATION.md): a model from a DIFFERENT provider answers the item
// without seeing the answer. The step passes only if its answer matches, with high confidence.
import { stamp } from './record.mjs';

export const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'Your final answer only.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'Brief working.' },
  },
  required: ['answer', 'confidence', 'reasoning'],
  additionalProperties: false,
};

const SYSTEM =
  'You are checking a GCSE or A-Level revision question. Answer it yourself, carefully and ' +
  'independently. Give only the final answer in "answer". Say "low" confidence if the question ' +
  'is ambiguous, has more than one correct answer, or you are not sure.';

const HOW = {
  multiple_choice: 'Reply with the number of the correct option only (for example "2").',
  numeric: 'Reply with the number (and unit if needed).',
  short_answer: 'Reply with a short answer: a word, phrase or value.',
  flashcard: 'Reply with what belongs on the back of this flashcard, as briefly as possible.',
  worked_maths:
    'Reply with the final answer only: all solutions separated by commas, or the expression.',
};

/** The prompt sent to the second model. It never contains the answer, explanation or hint. */
export function blindAnswerPrompt(item) {
  const lines = [];
  if (item.type === 'flashcard') lines.push(`Flashcard front: ${item.front}`);
  else lines.push(`Question: ${item.prompt}`);
  if (item.type === 'multiple_choice') {
    lines.push('Options:', ...item.options.map((o, i) => `${i}. ${o}`));
  }
  lines.push('', HOW[item.type]);
  return { system: SYSTEM, prompt: lines.join('\n') };
}

const NUMBER = /-?\d+(?:\.\d+)?(?:\s*\/\s*-?\d+(?:\.\d+)?)?/;
function toNumber(text) {
  const m = String(text)
    .replace(/,(?=\d{3})/g, '')
    .match(NUMBER);
  if (!m) return null;
  const [a, b] = m[0].split('/').map((s) => Number(s.trim()));
  return b === undefined ? a : a / b;
}
const isPlainNumber = (text) => /^\s*-?\d+(\.\d+)?(\s*\/\s*-?\d+(\.\d+)?)?\s*$/.test(String(text));
const words = (s) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?;:,]+$/, '');
const tight = (s) => s.toLowerCase().replace(/[\s*\u00d7\u00b7]/g, '');

function closeEnough(given, expected, tolerance) {
  const a = toNumber(given);
  const b = toNumber(expected);
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= (tolerance ?? 1e-9 * Math.max(1, Math.abs(b)));
}

function sameValue(given, expected) {
  return isPlainNumber(expected) ? closeEnough(given, expected) : tight(given) === tight(expected);
}

function solutionsOf(text) {
  return String(text)
    .split(/,|;|\bor\b|\band\b/)
    .map((s) => s.replace(/^\s*[a-z]\s*=\s*/i, '').trim())
    .filter(Boolean);
}

/** { expected, matches(answer) } for an item, or null when it has no single answer. */
function expectation(item) {
  switch (item.type) {
    case 'multiple_choice':
      return {
        expected: String(item.answer.option),
        matches: (a) => toNumber(a) === item.answer.option,
      };
    case 'numeric':
      return {
        expected: item.answer.value,
        matches: (a) =>
          isPlainNumber(item.answer.value)
            ? closeEnough(a, item.answer.value, item.answer.tolerance)
            : tight(a) === tight(item.answer.value),
      };
    case 'short_answer':
      return {
        expected: item.answer.accepted.join(' | '),
        matches: (a) => item.answer.accepted.some((x) => words(x) === words(a)),
      };
    case 'flashcard':
      return { expected: item.back, matches: (a) => words(a) === words(item.back) };
    case 'worked_maths':
      if (item.answer.solutions) {
        const want = item.answer.solutions;
        return {
          expected: want.join(', '),
          matches: (a) => {
            const got = solutionsOf(a);
            return (
              got.length === want.length &&
              want.every((w) => got.some((g) => sameValue(g, w))) &&
              got.every((g) => want.some((w) => sameValue(g, w)))
            );
          },
        };
      }
      return {
        expected: item.answer.expression,
        matches: (a) => tight(a) === tight(item.answer.expression),
      };
    default:
      return null;
  }
}

const PROVIDER_HINTS = [
  ['anthropic', /anthropic|claude/i],
  ['openai', /openai|gpt|\bo\d/i],
  ['gemini', /gemini|google/i],
];

/** The provider that wrote the item (from its grounded-writing check); Claude by default. */
export function writerProviderOf(item) {
  const tool = item.verification?.checks?.find((c) => c.name === 'grounded-writing')?.tool ?? '';
  return PROVIDER_HINTS.find(([, re]) => re.test(tool))?.[0] ?? 'anthropic';
}

const record = (provider, modelVersion, result, notes, now) => ({
  name: 'blind-answer',
  result,
  tool: `${provider.provider}:${provider.model}`,
  tool_version: modelVersion,
  at: stamp(now()),
  notes,
});

/** Runs the blind answer for one item: { id, result, check } (check is the record entry). */
export async function runBlindAnswer(item, provider, { now = () => new Date() } = {}) {
  const writer = writerProviderOf(item);
  if (provider.provider === writer) {
    throw new Error(
      `the blind answer must come from a different provider than the writer (${writer})`,
    );
  }
  const want = expectation(item);
  if (!want) {
    const notes = `${item.type} items have no single answer to compare; needs human approval`;
    return {
      id: item.id,
      result: 'fail',
      check: record(provider, provider.model, 'fail', notes, now),
    };
  }
  const { output, modelVersion } = await provider.complete({
    ...blindAnswerPrompt(item),
    schema: ANSWER_SCHEMA,
    schemaName: 'blind_answer',
  });
  const matches = want.matches(output.answer);
  const sure = output.confidence === 'high';
  const notes = [
    `model answered "${output.answer}"; expected "${want.expected}"`,
    ...(sure ? [] : [`confidence ${output.confidence}`]),
  ].join('; ');
  const result = matches && sure ? 'pass' : 'fail';
  return { id: item.id, result, check: record(provider, modelVersion, result, notes, now) };
}
