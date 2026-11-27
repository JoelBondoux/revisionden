// Marking-fairness guards for the S4 strands (Ratio, Geometry, Probability, Statistics), from
// Codex reviews on #422, #429 and #442: answers a fair marker accepts must not be marked wrong,
// and any_order must not let a wrong answer through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withoutUnit } from '../../packages/core/src/answer-format.ts';

const ITEMS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../content/items/gcse-maths-higher',
);
const STRANDS = ['ratio', 'geometry', 'probability', 'statistics'];

function strandItems() {
  const items = [];
  for (const strand of STRANDS) {
    const dir = join(ITEMS, strand);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      items.push(...JSON.parse(readFileSync(join(dir, file), 'utf8')));
    }
  }
  return items;
}

/**
 * The unknown a numeric question asks for ("Work out x.", "Find the value of k?", "Work out y when
 * x = 2.", "What is x_3?", "Work out u₅."), or null. A subscripted unknown counts (Codex on #442).
 */
export function askedLetter(prompt) {
  const m =
    /\b(?:work out|find|calculate|what is)\s+(?:the value of\s+)?([A-Za-z](?:_\(?[A-Za-z0-9+]+\)?|[₀-₉]+)?)(?:\s*[.?]|\s+when\b)/i.exec(
      prompt,
    );
  return m ? m[1] : null;
}

// A unit as a question writes it: a symbol or a word, singular or plural, squared or cubed.
const UNIT =
  '(?:°C|°|£|%|degrees|pounds|pence|(?:milli|centi|kilo)?(?:metre|gram|litre)s?|' +
  '(?:second|minute|hour|day|year|newton)s?|mm|cm|km|m|mg|kg|g|ml|N|s|h)(?:[²³]|\\^[23])?';
const UNIT_PHRASE = new RegExp(`^${UNIT}(?:\\s*(?:/|per)\\s*${UNIT})?$`);

/**
 * The unit a numeric question asks its answer in, as the question words it ("in °C per minute",
 * "Change 350 cm to metres", "Work out angle B" asks for degrees), or null (Codex on #442).
 */
export function askedUnit(prompt) {
  const sentences = prompt
    .split(/(?<=[.?])\s+/)
    .filter((s) => !/^Give your answer (?:correct|to|as|in its)/.test(s));
  const ask = sentences.at(-1) ?? '';
  const named = /(?:\bin|^Change\b.*\bto)\s+([^.?]+?)\s*[.?]?\s*$/.exec(ask);
  if (named && UNIT_PHRASE.test(named[1].trim())) return named[1].trim();
  const asksAngle =
    /\b(?:work out|find|calculate|what is)\b/i.test(ask) &&
    /\b(?:angle|bearing)\b/i.test(ask) &&
    !/\d°\s+angle/.test(ask);
  return asksAngle ? '°' : null;
}

/** The answer typed the way the question words its unit: "-4 °C per minute", "£12.50", "60°". */
export function typedWithUnit(value, unit) {
  return unit === '£' ? [`£${value}`] : [`${value} ${unit}`, `${value}${unit}`];
}

/** Tokens of an any_order answer that hold two or more letters in a row ("HT"). */
export function multiLetterTokens(answer) {
  return String(answer)
    .split(/[,;\s]+/)
    .filter((t) => /[A-Za-z]{2,}/.test(t));
}

test('askedLetter finds a single-letter unknown and ignores words and names', () => {
  assert.equal(askedLetter('3 : 5 = 12 : x. Work out x.'), 'x');
  assert.equal(askedLetter('Find the value of k?'), 'k');
  assert.equal(askedLetter('Work out y when x = 10.'), 'y');
  assert.equal(askedLetter('Work out the angle ACB.'), null);
  assert.equal(askedLetter('Work out PB.'), null);
  assert.equal(askedLetter('Work out x_3.'), 'x_3');
  assert.equal(askedLetter('Work out x_1, then x_2, then x_3. What is x_3?'), 'x_3');
  assert.equal(askedLetter('Work out u₅.'), 'u₅');
});

test('askedUnit reads the unit the answer is asked in, and ignores units in the data', () => {
  assert.equal(
    askedUnit(
      'A graph ... from (0, 80) to (10, 40). Work out the rate of change, in °C per minute.',
    ),
    '°C per minute',
  );
  assert.equal(askedUnit('Change 2.4 kg to grams.'), 'grams');
  assert.equal(askedUnit('Work out the speed in m/s.'), 'm/s');
  assert.equal(askedUnit('Work out the area. Give your answer correct to 1 decimal place.'), null);
  assert.equal(askedUnit('A car travels 120 km in 2 hours. Work out x.'), null);
  assert.equal(
    askedUnit('Write 45 as a fraction of 60. Give your answer in its simplest form.'),
    null,
  );
  assert.equal(askedUnit('Angle A = 40°. Work out angle B.'), '°');
  assert.equal(askedUnit('Work out the side opposite the 35° angle.'), null);
  assert.equal(
    askedUnit('Each exterior angle is 24°. How many sides does the polygon have?'),
    null,
  );
});

test('multiLetterTokens flags outcome lists but not numbers or equations', () => {
  assert.deepEqual(multiLetterTokens('HH, HT, TH, TT'), ['HH', 'HT', 'TH', 'TT']);
  assert.deepEqual(multiLetterTokens('4, 5, 6'), []);
  assert.deepEqual(multiLetterTokens('x = 3, y = 2'), []);
});

test('S4 numeric items that ask for a letter declare answer.subject', () => {
  const missing = strandItems()
    .filter(
      (i) =>
        i.type === 'numeric' && askedLetter(i.prompt) && i.answer.subject !== askedLetter(i.prompt),
    )
    .map((i) => i.id);
  assert.deepEqual(missing, []);
});

test('S4 numeric answers typed with the unit the question asks in are marked right (Codex on #442)', () => {
  // The marker strips only the item's own unit (answer.unit), so a question that names a unit
  // must declare it, in a form whose spellings include the question's wording.
  const refused = strandItems()
    .filter((i) => i.type === 'numeric' && askedUnit(i.prompt))
    .filter((i) =>
      typedWithUnit(i.answer.value, askedUnit(i.prompt)).some(
        (typed) => withoutUnit(typed, i.answer.unit) !== i.answer.value,
      ),
    )
    .map((i) => `${i.id} (${askedUnit(i.prompt)})`);
  assert.deepEqual(refused, []);
});

test('S4 any_order answers have no multi-letter tokens, whose letters could be reordered', () => {
  const bad = strandItems()
    .filter((i) => i.type === 'short_answer' && i.answer.any_order)
    .filter((i) => i.answer.accepted.some((a) => multiLetterTokens(a).length > 0))
    .map((i) => i.id);
  assert.deepEqual(bad, []);
});

test('S4 set answers also accept the braced form', () => {
  const bad = strandItems()
    .filter((i) => i.type === 'short_answer' && /\{[^}]*\}/.test(i.prompt))
    .filter((i) => !i.answer.accepted.some((a) => /^\s*\{.*\}\s*$/.test(a)))
    .map((i) => i.id);
  assert.deepEqual(bad, []);
});

/** Items grouped by strand, for rules that apply to a strand as a whole. */
function byStrand() {
  const groups = {};
  for (const strand of STRANDS) {
    const dir = join(ITEMS, strand);
    if (!existsSync(dir)) continue;
    groups[strand] = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  return groups;
}

test('S4 multiple-choice answers are spread over the option positions (Codex on #430)', () => {
  // Options are served in stored order, so a strand whose answers sit mostly in one position
  // can be gamed by always picking it.
  const crowded = [];
  for (const [strand, items] of Object.entries(byStrand())) {
    const mc = items.filter((i) => i.type === 'multiple_choice');
    if (mc.length < 4) continue;
    const counts = {};
    for (const i of mc) counts[i.answer.option] = (counts[i.answer.option] ?? 0) + 1;
    const most = Math.max(...Object.values(counts));
    if (most > Math.ceil(mc.length / 2))
      crowded.push(`${strand}: ${most} of ${mc.length} in one position`);
  }
  assert.deepEqual(crowded, []);
});

test('every S4 learning point has at least 3 interchangeable items (Codex on #430)', () => {
  const thin = [];
  for (const items of Object.values(byStrand())) {
    const counts = {};
    for (const i of items) counts[i.learning_point] = (counts[i.learning_point] ?? 0) + 1;
    for (const [lp, n] of Object.entries(counts)) if (n < 3) thin.push(`${lp} (${n})`);
  }
  assert.deepEqual(thin, []);
});
