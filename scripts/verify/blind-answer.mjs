// Pipeline step 3 (docs/VERIFICATION.md): a model from a DIFFERENT provider answers the item
// without seeing the answer. The step passes only if its answer matches, with high confidence.
import { createPythonChecker } from '../content/maths-engine.mjs';
import { stamp } from './record.mjs';
import { sameAnswer } from '../../packages/core/src/answer-normalise.ts';
import {
  meetsRounding,
  roundingOf,
  simplestForm,
  standardForm,
  withMinus,
  withoutSubject,
} from '../../packages/core/src/answer-format.ts';

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
  numeric:
    'Reply with the number (and unit if needed), written to the accuracy the question asks for.',
  short_answer: 'Reply with a short answer: a word, phrase or value.',
  flashcard: 'Reply with what belongs on the back of this flashcard, as briefly as possible.',
  worked_maths:
    'Reply with the final answer only: all solutions separated by commas, or the expression.',
};

const HOW_FORMULA =
  'Reply with the formula in plain calculator notation: sqrt() for roots, ^ for powers, * for ' +
  'multiplication, +- for ±, and brackets around every numerator and denominator. Then write ' +
  '"where" and any conditions that must hold (for example "where b != 0").';

/** The prompt sent to the second model. It never contains the answer, explanation or hint. */
export function blindAnswerPrompt(item) {
  const lines = [];
  if (item.type === 'flashcard') lines.push(`Flashcard front: ${item.front}`);
  else lines.push(`Question: ${item.prompt}`);
  if (item.type === 'multiple_choice') {
    lines.push('Options:', ...item.options.map((o, i) => `${i}. ${o}`));
  }
  lines.push('', item.back_formula ? HOW_FORMULA : HOW[item.type]);
  return { system: SYSTEM, prompt: lines.join('\n') };
}

const NUMBER = /-?\d+(?:\.\d+)?(?:\s*\/\s*-?\d+(?:\.\d+)?)?/;
/** The first number in the text as written ("1,250.0 cm" gives "1250.0"), or null. */
function numberText(text) {
  const m = String(text)
    .replace(/,(?=\d{3})/g, '')
    .match(NUMBER);
  return m ? m[0] : null;
}
function toNumber(text) {
  const n = numberText(text);
  if (n === null) return null;
  const [a, b] = n.split('/').map((s) => Number(s.trim()));
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
    case 'numeric': {
      const rounding = roundingOf(item.answer);
      const value = item.answer.value;
      return {
        expected: value,
        matches: (typed) => {
          const raw = withMinus(String(typed));
          // Simplest form as marking reads it: a fraction in lowest terms, never 69/99 or 0.697.
          if (
            item.answer.simplest_form &&
            !simplestForm(withoutSubject(words(raw), item.answer.subject))
          ) {
            return false;
          }
          // Standard form as marking reads it (markNumeric): any common spelling, and proper
          // standard form when the answer is in standard form.
          const said = withoutSubject(words(String(raw)), item.answer.subject);
          const shown = standardForm(said);
          const wanted = standardForm(value);
          if (wanted && !shown?.proper) return false;
          if (shown) {
            if (rounding) return meetsRounding(said, value, rounding);
            return closeEnough(shown.plain, wanted?.plain ?? value, item.answer.tolerance);
          }
          const a = withoutSubject(String(raw), item.answer.subject);
          if (rounding) return meetsRounding(numberText(a) ?? '', value, rounding);
          return isPlainNumber(value)
            ? closeEnough(a, value, item.answer.tolerance)
            : tight(a) === tight(value);
        },
      };
    }
    case 'short_answer': {
      // The same answer normaliser as marking (packages/core, #133): maths notation such as
      // x² for x^2, any_order and units. End punctuation is still ignored, as before.
      const options = { anyOrder: item.answer.any_order === true, units: item.answer.units };
      return {
        expected: item.answer.accepted.join(' | '),
        matches: (a) =>
          item.answer.accepted.some(
            (x) => words(x) === words(a) || sameAnswer(x, words(String(a)), options),
          ),
      };
    }
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
        matches: (a) =>
          tight(withoutSubject(String(a), item.answer.subject)) === tight(item.answer.expression),
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

// Conditions match ignoring spaces and case, with ≠, != and =/= read the same.
const condition = (s) =>
  s
    .toLowerCase()
    .replace(/!=|=\/=/g, '≠')
    .replace(/\s+/g, '');

/**
 * Maths flashcards (back_formula): the maths engine compares the formula part of the answer, and
 * the answer must state every condition. { ok, notes }.
 */
async function formulaVerdict(item, answer, maths) {
  const [formulaPart, ...rest] = String(answer).split(/\bwhere\b/i);
  const given = formulaPart.replace(/[\s,;]+$/, '').trim();
  const { formula, conditions = [] } = item.back_formula;
  const [result] = await maths([{ id: item.id, kind: 'formula', expected: formula, given }]);
  // Each stated condition is a whole clause ("a != 0", "b > 1"), so "a != 0.5" never counts as
  // "a ≠ 0": clauses are split on commas, semicolons and "and", then compared whole.
  const stated = new Set(
    rest
      .join(' ')
      .split(/,|;|\band\b/i)
      .map((c) => condition(c).replace(/\.$/, ''))
      .filter(Boolean),
  );
  const missing = conditions.filter((c) => !stated.has(condition(c)));
  const notes = [
    `maths engine: ${result?.ok ? 'same formula' : 'not the same formula'}`,
    ...missing.map((c) => `does not state "${c}": a person must check`),
  ];
  return { ok: Boolean(result?.ok) && missing.length === 0, notes };
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
export async function runBlindAnswer(
  item,
  provider,
  {
    now = () => new Date(),
    maths = createPythonChecker({ python: process.env.MATHS_PYTHON }),
  } = {},
) {
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
  const formula = item.back_formula ? await formulaVerdict(item, output.answer, maths) : null;
  const matches = formula ? formula.ok : want.matches(output.answer);
  const sure = output.confidence === 'high';
  const notes = [
    `model answered "${output.answer}"; expected "${formula ? item.back_formula.formula : want.expected}"`,
    ...(formula ? formula.notes : []),
    ...(sure ? [] : [`confidence ${output.confidence}`]),
  ].join('; ');
  const result = matches && sure ? 'pass' : 'fail';
  return { id: item.id, result, check: record(provider, modelVersion, result, notes, now) };
}
