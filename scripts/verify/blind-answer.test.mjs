import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blindAnswerPrompt, runBlindAnswer, writerProviderOf } from './blind-answer.mjs';
import { draftItem } from './test-content.mjs';

const AT = () => new Date('2026-11-24T12:00:00Z');

function fakeProvider(output, provider = 'openai') {
  const requests = [];
  return {
    provider,
    model: `${provider}-fixture-model`,
    requests,
    async complete(req) {
      requests.push(req);
      return { output, modelVersion: `${provider}-fixture-model-001` };
    },
  };
}

const mc = draftItem('fixture-mc', undefined, {
  type: 'multiple_choice',
  prompt: 'Fixture question with options?',
  options: ['first', 'second', 'third'],
  answer: { option: 1 },
  explanation: 'SECRET EXPLANATION',
});

test('the blind prompt shows the question and options but never the answer or explanation', () => {
  const { prompt } = blindAnswerPrompt(mc);
  assert.match(prompt, /Fixture question with options\?/);
  assert.match(prompt, /0\. first/);
  assert.match(prompt, /2\. third/);
  assert.doesNotMatch(prompt, /SECRET|"option"|answer: 1/);
});

test('multiple choice passes when the second model picks the same option with high confidence', async () => {
  const r = await runBlindAnswer(
    mc,
    fakeProvider({ answer: '1', confidence: 'high', reasoning: 'r' }),
    { now: AT },
  );
  assert.equal(r.result, 'pass');
  assert.deepEqual(r.check, {
    name: 'blind-answer',
    result: 'pass',
    tool: 'openai:openai-fixture-model',
    tool_version: 'openai-fixture-model-001',
    at: '2026-11-24T12:00:00Z',
    notes: 'model answered "1"; expected "1"',
  });
});

test('multiple choice fails when the second model picks another option', async () => {
  const r = await runBlindAnswer(
    mc,
    fakeProvider({ answer: '2', confidence: 'high', reasoning: 'r' }),
    { now: AT },
  );
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /model answered "2"; expected "1"/);
});

test('an unsure answer fails even when it matches', async () => {
  const r = await runBlindAnswer(
    mc,
    fakeProvider({ answer: '1', confidence: 'medium', reasoning: 'r' }),
    { now: AT },
  );
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /confidence medium/);
});

test('numeric answers match within the item tolerance and ignore units and commas', async () => {
  const item = draftItem('fixture-num', undefined, {
    type: 'numeric',
    prompt: 'Fixture?',
    answer: { value: '1250.5', unit: 'cm', tolerance: 0.05 },
    verify: { expression: '1250.5' },
  });
  const ok = await runBlindAnswer(
    item,
    fakeProvider({ answer: '1,250.53 cm', confidence: 'high', reasoning: '' }),
    { now: AT },
  );
  assert.equal(ok.result, 'pass');
  const off = await runBlindAnswer(
    item,
    fakeProvider({ answer: '1250.6', confidence: 'high', reasoning: '' }),
    { now: AT },
  );
  assert.equal(off.result, 'fail');
});

test('numeric answers given as fractions are compared by value', async () => {
  const item = draftItem('fixture-frac', undefined, {
    type: 'numeric',
    prompt: 'Fixture?',
    answer: { value: '0.75' },
    verify: { expression: '3/4' },
  });
  const r = await runBlindAnswer(
    item,
    fakeProvider({ answer: '3/4', confidence: 'high', reasoning: '' }),
    { now: AT },
  );
  assert.equal(r.result, 'pass');
});

// No test needs the real maths engine (CI's script job has no SymPy): this one never matches.
const noMaths = async (checks) => checks.map((c) => ({ id: c.id, ok: false }));
const blind = (item, answer) =>
  runBlindAnswer(item, fakeProvider({ answer, confidence: 'high', reasoning: '' }), {
    now: AT,
    maths: noMaths,
  });

test('a rounded numeric answer must be written to the asked accuracy, not just be close', async () => {
  const item = draftItem('fixture-round', undefined, {
    type: 'numeric',
    prompt: 'Fixture? Give your answer to 2 decimal places.',
    answer: { value: '28.27', unit: 'cm^2', decimal_places: 2 },
    verify: { expression: 'pi * 3^2' },
  });
  assert.equal((await blind(item, '28.27 cm²')).result, 'pass');
  assert.equal((await blind(item, '28.274')).result, 'fail');
  assert.equal((await blind(item, '28.3')).result, 'fail');
  const sf = draftItem('fixture-sf', undefined, {
    type: 'numeric',
    prompt: 'Fixture? Give your answer to 3 significant figures.',
    answer: { value: '1250', significant_figures: 3 },
    verify: { expression: '1250' },
  });
  assert.equal((await blind(sf, '1,250')).result, 'pass');
  assert.equal((await blind(sf, '1249.6')).result, 'fail');
  assert.equal((await blind(sf, '1250.0')).result, 'fail'); // right value, 5 sf
  assert.equal((await blind(item, '28.270')).result, 'fail');
});

test('a standard form answer matches in its common spellings, as marking does', async () => {
  const item = draftItem('fixture-standard', undefined, {
    type: 'numeric',
    prompt: 'Fixture? Give your answer in standard form.',
    answer: { value: '6.4 × 10^8' },
    verify: { expression: '6.4 * 10^8' },
  });
  for (const answer of ['6.4 × 10⁸', '6.4x10^8', '6.4e8', '6.4 × 10^8.']) {
    assert.equal((await blind(item, answer)).result, 'pass', answer);
  }
  assert.equal((await blind(item, '64 × 10^7')).result, 'fail');
  assert.equal((await blind(item, '6.4 × 10^9')).result, 'fail');
  const plain = draftItem('fixture-standard-plain', undefined, {
    type: 'numeric',
    prompt: 'Fixture?',
    answer: { value: '0.00032', significant_figures: 2 },
    verify: { expression: '0.00032' },
  });
  assert.equal((await blind(plain, '3.2 × 10⁻⁴')).result, 'pass');
});

test('a unicode minus in the blind answer is a minus', async () => {
  const item = draftItem('fixture-minus', undefined, {
    type: 'numeric',
    prompt: 'Fixture?',
    answer: { value: '-1' },
    verify: { expression: '-1' },
  });
  assert.equal((await blind(item, '−1')).result, 'pass');
  assert.equal((await blind(item, '1')).result, 'fail');
});

test('an answer form (fraction, simplest fraction, index form) is checked as marking does', async () => {
  const item = draftItem('fixture-simplest', undefined, {
    type: 'numeric',
    prompt: 'Fixture? Give your answer as a fraction in its simplest form.',
    answer: { value: '23/33', form: 'simplest_fraction' },
    verify: { expression: '23/33' },
  });
  assert.equal((await blind(item, '23/33')).result, 'pass');
  assert.equal((await blind(item, '69/99')).result, 'fail');
  assert.equal((await blind(item, '0.697')).result, 'fail');
  const fraction = { ...item, answer: { value: '3/8', form: 'fraction' } };
  assert.equal((await blind(fraction, '6/16')).result, 'pass');
  assert.equal((await blind(fraction, '0.375')).result, 'fail');
  const index = draftItem('fixture-index', undefined, {
    type: 'numeric',
    prompt: 'Fixture? Write 360 in index form.',
    answer: { value: '2^3 × 3^2 × 5', form: 'index_form' },
    verify: { expression: '2^3 * 3^2 * 5' },
  });
  assert.equal((await blind(index, '2³ × 3² × 5')).result, 'pass');
  assert.equal((await blind(index, '360')).result, 'fail');
  assert.equal((await blind(index, '2^3 × 3^2 × 7')).result, 'fail');
});

test('a minus spaced from its number still counts in the blind check, as marking reads it', async () => {
  const item = draftItem('fixture-spaced-minus', undefined, {
    type: 'numeric',
    prompt: 'Fixture?',
    answer: { value: '3/8' },
    verify: { expression: '3/8' },
  });
  assert.equal((await blind(item, '3 / 8')).result, 'pass');
  assert.equal((await blind(item, '- 3 / 8')).result, 'fail');
  assert.equal((await blind(item, '− 3/8')).result, 'fail');
  const negative = { ...item, answer: { value: '-3/8' } };
  assert.equal((await blind(negative, '- 3 / 8')).result, 'pass');
  assert.equal((await blind(negative, 'The answer is - 3 / 8.')).result, 'pass');
});

test('the blind model is asked to round as the question says', () => {
  const { prompt } = blindAnswerPrompt(mc);
  assert.doesNotMatch(prompt, /accuracy the question asks/);
  const item = { ...mc, type: 'numeric', options: undefined };
  assert.match(blindAnswerPrompt(item).prompt, /accuracy the question asks/);
});

test('an answer stating the declared subject matches, such as "t = (v - u)/a"', async () => {
  const item = draftItem('fixture-subject', undefined, {
    type: 'worked_maths',
    prompt: 'Make t the subject of v = u + at.',
    answer: { expression: '(v - u)/a', subject: 't' },
    verify: { method: 'expression', expression: '(v - u)/a' },
  });
  assert.equal((await blind(item, 't = (v - u)/a')).result, 'pass');
  assert.equal((await blind(item, '(v-u)/a')).result, 'pass');
  assert.equal((await blind(item, 'u = (v - u)/a')).result, 'fail');
  const inverse = draftItem('fixture-inverse', undefined, {
    type: 'worked_maths',
    prompt: 'f(x) = 2x - 3. Find f^-1(x).',
    answer: { expression: '(x + 3)/2', subject: 'f^-1(x)' },
    verify: { method: 'expression', expression: '(x + 3)/2' },
  });
  assert.equal((await blind(inverse, 'f^-1(x) = (x + 3)/2')).result, 'pass');
  const numeric = draftItem('fixture-t', undefined, {
    type: 'numeric',
    prompt: 'Find t.',
    answer: { value: '4', subject: 't' },
    verify: { expression: '4' },
  });
  assert.equal((await blind(numeric, 't = 4')).result, 'pass');
});

test('short answers match any accepted answer, ignoring case, spacing and end punctuation', async () => {
  const item = draftItem('fixture-short', undefined, {
    answer: { accepted: ['Fixture Answer', 'other'] },
  });
  const r = await runBlindAnswer(
    item,
    fakeProvider({ answer: '  fixture   answer. ', confidence: 'high', reasoning: '' }),
    { now: AT },
  );
  assert.equal(r.result, 'pass');
  const wrong = await runBlindAnswer(
    item,
    fakeProvider({ answer: 'fixture answers', confidence: 'high', reasoning: '' }),
    { now: AT },
  );
  assert.equal(wrong.result, 'fail');
});

test('short answers use the answer normaliser: maths notation, any_order and units (#133)', async () => {
  const circle = draftItem('fixture-circle', undefined, {
    answer: { accepted: ['x^2 + y^2 = 36'] },
  });
  assert.equal((await blind(circle, 'x² + y² = 36')).result, 'pass');
  assert.equal((await blind(circle, 'y² + x² = 36')).result, 'fail'); // order matters by default
  const anyOrder = draftItem('fixture-any-order', undefined, {
    answer: { accepted: ['x^2 + y^2 = 36'], any_order: true },
  });
  assert.equal((await blind(anyOrder, 'y² + x² = 36')).result, 'pass');
  assert.equal((await blind(anyOrder, 'x² + y² = 6')).result, 'fail');
  const withUnit = draftItem('fixture-unit', undefined, {
    answer: { accepted: ['12'], units: ['cm'] },
  });
  assert.equal((await blind(withUnit, '12 cm')).result, 'pass');
  assert.equal((await blind(withUnit, '12 m')).result, 'fail');
});

test('flashcards compare the model answer to the back of the card', async () => {
  const item = draftItem('fixture-card', undefined, {
    type: 'flashcard',
    front: 'Fixture front',
    back: 'Fixture back',
    prompt: undefined,
    answer: undefined,
    marks: undefined,
  });
  const { prompt } = blindAnswerPrompt(item);
  assert.match(prompt, /Fixture front/);
  assert.doesNotMatch(prompt, /Fixture back/);
  const r = await runBlindAnswer(
    item,
    fakeProvider({ answer: 'fixture back', confidence: 'high', reasoning: '' }),
    { now: AT },
  );
  assert.equal(r.result, 'pass');
});

const formulaCard = draftItem('fixture-formula-card', undefined, {
  type: 'flashcard',
  front: 'Fixture formula front',
  back: 'SECRET BACK',
  back_formula: { formula: 'y = m*x + c', conditions: ['m ≠ 0'] },
  prompt: undefined,
  answer: undefined,
  marks: undefined,
});

/** A fake maths engine: records each check and says ok when given === the listed answer. */
function fakeMaths(okFor) {
  const calls = [];
  const maths = async (checks) => {
    calls.push(...checks);
    return checks.map((c) => ({ id: c.id, ok: c.given === okFor }));
  };
  return { maths, calls };
}

test('a formula flashcard asks for calculator notation and conditions, never showing the back', () => {
  const { prompt } = blindAnswerPrompt(formulaCard);
  assert.match(prompt, /Fixture formula front/);
  assert.match(prompt, /calculator notation/);
  assert.match(prompt, /where/);
  assert.doesNotMatch(prompt, /SECRET|m\*x/);
});

test('a formula flashcard passes when the maths engine finds the same formula and every condition is stated', async () => {
  const { maths, calls } = fakeMaths('y = c + x*m');
  const r = await runBlindAnswer(
    formulaCard,
    fakeProvider({ answer: 'y = c + x*m, where m != 0', confidence: 'high', reasoning: '' }),
    { now: AT, maths },
  );
  assert.deepEqual(calls, [
    { id: 'fixture-formula-card', kind: 'formula', expected: 'y = m*x + c', given: 'y = c + x*m' },
  ]);
  assert.equal(r.result, 'pass');
  assert.match(r.check.notes, /maths engine: same formula/);
});

test('a formula flashcard fails when the maths engine finds a different formula', async () => {
  const { maths } = fakeMaths('nothing matches');
  const r = await runBlindAnswer(
    formulaCard,
    fakeProvider({ answer: 'y = m*x - c where m ≠ 0', confidence: 'high', reasoning: '' }),
    { now: AT, maths },
  );
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /maths engine: not the same formula/);
});

test('a formula flashcard fails for a person to check when the answer leaves out a condition', async () => {
  const { maths } = fakeMaths('y = m*x + c');
  const r = await runBlindAnswer(
    formulaCard,
    fakeProvider({ answer: 'y = m*x + c', confidence: 'high', reasoning: '' }),
    { now: AT, maths },
  );
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /does not state "m ≠ 0": a person must check/);
});

test('a condition must be stated exactly, not as part of a different condition', async () => {
  for (const answer of [
    'y = m*x + c where m != 0.5',
    'y = m*x + c where m != 05',
    'y = m*x + c where km != 0',
  ]) {
    const { maths } = fakeMaths('y = m*x + c');
    const r = await runBlindAnswer(
      formulaCard,
      fakeProvider({ answer, confidence: 'high', reasoning: '' }),
      { now: AT, maths },
    );
    assert.equal(r.result, 'fail', answer);
  }
  const { maths } = fakeMaths('y = m*x + c');
  const ok = await runBlindAnswer(
    formulaCard,
    fakeProvider({
      answer: 'y = m*x + c where c > 1 and m ≠ 0.',
      confidence: 'high',
      reasoning: '',
    }),
    { now: AT, maths },
  );
  assert.equal(ok.result, 'pass');
});

test('worked maths solutions match as a set, in any order', async () => {
  const item = draftItem('fixture-solve', undefined, {
    type: 'worked_maths',
    prompt: 'Fixture?',
    answer: { solutions: ['3', '-2'] },
    verify: { method: 'solve', equation: 'x' },
  });
  const r = await runBlindAnswer(
    item,
    fakeProvider({ answer: 'x = -2, x = 3', confidence: 'high', reasoning: '' }),
    { now: AT },
  );
  assert.equal(r.result, 'pass');
  const missing = await runBlindAnswer(
    item,
    fakeProvider({ answer: '3', confidence: 'high', reasoning: '' }),
    { now: AT },
  );
  assert.equal(missing.result, 'fail');
});

test('worked maths expressions match after removing spaces and multiplication signs', async () => {
  const item = draftItem('fixture-expr', undefined, {
    type: 'worked_maths',
    prompt: 'Fixture?',
    answer: { expression: '(x + 2)(x + 3)' },
    verify: { method: 'expression', expression: 'x' },
  });
  const r = await runBlindAnswer(
    item,
    fakeProvider({ answer: '(x+2)*(x+3)', confidence: 'high', reasoning: '' }),
    { now: AT },
  );
  assert.equal(r.result, 'pass');
});

test('extended answers have no single answer to compare, so they fail and need a person', async () => {
  const item = draftItem('fixture-long', undefined, {
    type: 'extended_answer',
    prompt: 'Fixture essay?',
    answer: undefined,
    mark_scheme_ref: 'fixture-ms',
  });
  const provider = fakeProvider({ answer: 'x', confidence: 'high', reasoning: '' });
  const r = await runBlindAnswer(item, provider, { now: AT });
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /no single answer/);
  assert.equal(provider.requests.length, 0);
});

test('the blind answer must come from a different provider from the writer', async () => {
  const p = fakeProvider({ answer: '1', confidence: 'high', reasoning: '' }, 'anthropic');
  await assert.rejects(
    runBlindAnswer(mc, p, { now: AT }),
    /must come from a different provider than the writer \(anthropic\)/,
  );
});

test('the writer provider is read from the grounded-writing check, defaulting to Anthropic', () => {
  assert.equal(writerProviderOf(mc), 'anthropic');
  const byGemini = {
    ...mc,
    verification: {
      ...mc.verification,
      checks: [
        {
          name: 'grounded-writing',
          result: 'pass',
          tool: 'gemini:fixture',
          tool_version: '1',
          at: 'x',
        },
      ],
    },
  };
  assert.equal(writerProviderOf(byGemini), 'gemini');
});

const card = (back) =>
  draftItem('fixture-number-card', undefined, {
    type: 'flashcard',
    front: 'Fixture number front',
    back,
    prompt: undefined,
    answer: undefined,
    marks: undefined,
  });
const said = (answer) => fakeProvider({ answer, confidence: 'high', reasoning: '' });

test('a number flashcard compares the final value of the answer as a number (S4)', async () => {
  const pass = await runBlindAnswer(card('0.1'), said('3/30 = 0.1'), { now: AT });
  assert.equal(pass.result, 'pass');
  const fraction = await runBlindAnswer(card('1/4'), said('5/20 = 1/4'), { now: AT });
  assert.equal(fraction.result, 'pass');
  const wrong = await runBlindAnswer(card('0.1'), said('3/30 = 0.2'), { now: AT });
  assert.equal(wrong.result, 'fail');
});

test('a number flashcard with a unit compares the number, so "20" matches "20 heads" (S4)', async () => {
  assert.equal((await runBlindAnswer(card('20 heads'), said('20'), { now: AT })).result, 'pass');
  assert.equal(
    (await runBlindAnswer(card('£121'), said('121 pounds'), { now: AT })).result,
    'pass',
  );
  assert.equal((await runBlindAnswer(card('20 heads'), said('21'), { now: AT })).result, 'fail');
});

test('a word flashcard is still compared word for word', async () => {
  const r = await runBlindAnswer(card('chord'), said('secant'), { now: AT });
  assert.equal(r.result, 'fail');
});

const workedNumber = draftItem('fixture-worked-number', undefined, {
  type: 'worked_maths',
  prompt: 'Fixture?',
  answer: { expression: '75' },
  verify: { method: 'expression', expression: '150/2' },
});

test('a worked answer that is a number compares the final value as a number, without the engine (S4)', async () => {
  assert.equal((await runBlindAnswer(workedNumber, said('£75'), { now: AT })).result, 'pass');
  assert.equal(
    (await runBlindAnswer(workedNumber, said('150/2 = 75'), { now: AT })).result,
    'pass',
  );
  assert.equal((await runBlindAnswer(workedNumber, said('£76'), { now: AT })).result, 'fail');
});

test('a worked expression that differs in writing is checked by the maths engine (S4)', async () => {
  const item = draftItem('fixture-worked-expr', undefined, {
    type: 'worked_maths',
    prompt: 'Fixture?',
    answer: { expression: '18*v/5' },
    verify: { method: 'expression', expression: 'v*3600/1000' },
  });
  const calls = [];
  const maths = async (checks) => {
    calls.push(...checks);
    return checks.map((c) => ({ id: c.id, ok: c.answer === '3.6v' }));
  };
  const r = await runBlindAnswer(item, said('3.6v'), { now: AT, maths });
  assert.equal(r.result, 'pass');
  assert.equal(calls[0].kind, 'expression');
  assert.equal(calls[0].expression, '18*v/5');
  assert.match(r.check.notes, /maths engine: same expression/);
  const no = await runBlindAnswer(item, said('3.5v'), { now: AT, maths });
  assert.equal(no.result, 'fail');
});

test('a maths engine error fails the check with a note instead of stopping the run (S4)', async () => {
  const item = draftItem('fixture-engine-down', undefined, {
    type: 'worked_maths',
    prompt: 'Fixture?',
    answer: { expression: '18*v/5' },
    verify: { method: 'expression', expression: 'v*3600/1000' },
  });
  const broken = async () => {
    throw new Error('maths engine exited with code 1');
  };
  const r = await runBlindAnswer(item, said('3.6v'), { now: AT, maths: broken });
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /maths engine could not check/);
});
