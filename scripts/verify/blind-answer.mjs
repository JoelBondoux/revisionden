// Pipeline step 3 (docs/VERIFICATION.md): a model from a DIFFERENT provider answers the item
// without seeing the answer. The step passes only if its answer matches, with high confidence.
import { createPythonChecker } from '../content/maths-engine.mjs';
import { stamp } from './record.mjs';
import { sameAnswer } from '../../packages/core/src/answer-normalise.ts';
import {
  compactSpaces,
  meetsRounding,
  roundingOf,
  indexForm,
  inForm,
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
/**
 * The first number in the text as written ("1,250.0 cm" gives "1250.0"), or null. Spaces around a
 * sign or "/" go first, as marking reads them (compactSpaces), so "- 3 / 8" keeps its minus.
 */
function numberText(text) {
  const m = compactSpaces(withMinus(String(text)))
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

/**
 * A unit that may follow a number (Codex on #433): a fixed list of symbols, or a word of four or
 * more letters ("people", "minutes", "litres per minute"). One to three letters are never a unit
 * here, so "2n" and "35y" stay algebra and never match "2" or "35".
 */
const UNIT_TAIL = String.raw`(?:°C?|%|(?:mm|cm|km)(?:[²³]|\^[23])?|kg|mg|ml|km/h|m/s|[A-Za-z]{4,}(?:\s+[A-Za-z]{2,})*)`;
const WITH_UNIT = new RegExp(String.raw`^(.*?\d)\s*${UNIT_TAIL}$`);

/** `text` without a trailing unit from UNIT_TAIL ("180°" is "180", "2n" stays "2n"). */
const withoutUnitTail = (text) => WITH_UNIT.exec(text)?.[1] ?? text;

/**
 * The final value of an answer as a plain number, or null (Codex on #433): the text after the last
 * "=", with an optional leading £ and a trailing unit allowed, and nothing else, so "£75" and
 * "3/30 = 0.1" give a number but "75*2", "75^2", "75 or 76" and "2n" do not.
 */
function plainValue(text) {
  const v = withoutUnitTail(
    finalValue(text)
      .replace(/,(?=\d{3})/g, '')
      .replace(/^[£$]\s*/, '')
      .trim(),
  ).trim();
  return isPlainNumber(v) ? v : null;
}

/** The forms inForm reads (answer.form); verify.form may also name an algebra form. */
const NUMBER_FORMS = new Set([
  'fraction',
  'simplest_fraction',
  'improper_fraction',
  'standard_form',
  'index_form',
]);

/** The value after the last "=" ("3/30 = 0.1" gives "0.1"), as text. */
function finalValue(text) {
  return String(text).split('=').pop().trim();
}

/**
 * The number on a flashcard back that is a number or fraction, optionally with a leading £ and a
 * trailing unit from UNIT_TAIL ("20 heads", "£121", "180°"); otherwise null, so "2n" is not 2.
 */
function numberOnBack(back) {
  const m = /^\s*£?\s*(-?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*$/.exec(
    withoutUnitTail(String(back).trim()),
  );
  return m ? m[1].replace(/\s+/g, '') : null;
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
          // The asked form as marking reads it (markNumeric): a fraction, never 0.375; lowest
          // terms, never 69/99; index form compared by value, never 360.
          const { form } = item.answer;
          if (form) {
            const said = withoutSubject(words(raw), item.answer.subject);
            if (!inForm(said, form)) return false;
            if (form === 'index_form') {
              return indexForm(said) === (indexForm(value) ?? BigInt(value));
            }
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
    case 'flashcard': {
      // A number on the back (S4): compare the final value of the answer as a number, so
      // "3/30 = 0.1" matches 0.1 and "20" matches "20 heads". Words stay word for word.
      const number = numberOnBack(item.back);
      return {
        expected: item.back,
        matches: (a) =>
          words(a) === words(item.back) ||
          (number !== null && plainValue(a) !== null && closeEnough(plainValue(a), number)),
      };
    }
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
        matches: (a) => {
          const given = withoutSubject(String(a), item.answer.subject);
          // The asked number form first, as for numeric items (Codex on #433): 12/5, never 2.4.
          // Algebra forms (factorised, expanded) are the maths engine's to judge.
          const form = item.answer.form ?? item.verify?.form;
          if (NUMBER_FORMS.has(form)) {
            const said = withoutSubject(words(withMinus(String(a))), item.answer.subject);
            if (!inForm(said, form)) return false;
          }
          if (tight(given) === tight(item.answer.expression)) return true;
          // A number answer (S4): compare the final value as a number ("£75", "150/2 = 75").
          return (
            isPlainNumber(item.answer.expression) &&
            plainValue(given) !== null &&
            closeEnough(plainValue(given), item.answer.expression)
          );
        },
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

/** A worked expression answer compared by the maths engine's expression check. { ok, notes }. */
async function expressionVerdict(item, answer, maths) {
  const given = withoutSubject(String(answer), item.answer.subject).trim();
  let result;
  try {
    [result] = await maths([
      {
        id: item.id,
        kind: 'expression',
        expression: item.answer.expression,
        answer: given,
        form: item.answer.form ?? item.verify?.form,
        subject: item.answer.subject,
      },
    ]);
  } catch (error) {
    return {
      ok: false,
      notes: [
        `maths engine unavailable, so the answer is not accepted: ${error.message.split('\n')[0]}`,
      ],
    };
  }
  return {
    ok: Boolean(result?.ok),
    notes: [`maths engine: ${result?.ok ? 'same expression' : 'not the same expression'}`],
  };
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
  let matches = formula ? formula.ok : want.matches(output.answer);
  // A worked expression written differently (S4): the maths engine decides ("3.6v" for 18v/5).
  const engine =
    !matches &&
    item.type === 'worked_maths' &&
    typeof item.answer?.expression === 'string' &&
    !isPlainNumber(item.answer.expression)
      ? await expressionVerdict(item, output.answer, maths)
      : null;
  if (engine) matches = engine.ok;
  const sure = output.confidence === 'high';
  const notes = [
    `model answered "${output.answer}"; expected "${formula ? item.back_formula.formula : want.expected}"`,
    ...(formula ? formula.notes : []),
    ...(engine ? engine.notes : []),
    ...(sure ? [] : [`confidence ${output.confidence}`]),
  ].join('; ');
  const result = matches && sure ? 'pass' : 'fail';
  return { id: item.id, result, check: record(provider, modelVersion, result, notes, now) };
}
