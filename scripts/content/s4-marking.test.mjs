// Marking-fairness guards for the S4 strands (Ratio, Geometry, Probability, Statistics), from
// Codex reviews on #422 and #429: answers a fair marker accepts must not be marked wrong, and
// any_order must not let a wrong answer through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** The letter a numeric question asks for ("Work out x.", "Find the value of k?", "Work out y when x = 2."), or null. */
export function askedLetter(prompt) {
  const m =
    /\b(?:work out|find|calculate)\s+(?:the value of\s+)?([A-Za-z])(?:\s*[.?]|\s+when\b)/i.exec(
      prompt,
    );
  return m ? m[1] : null;
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
  assert.equal(askedLetter('Work out x_3.'), null);
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
