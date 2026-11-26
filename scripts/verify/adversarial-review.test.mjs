import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewPrompt, runAdversarialReview, PROBLEM_KINDS } from './adversarial-review.mjs';
import { draftItem, quoted } from './test-content.mjs';

const AT = () => new Date('2026-11-24T12:00:00Z');
const fake = (output) => ({
  provider: 'gemini',
  model: 'gemini-fixture-model',
  async complete() {
    return { output, modelVersion: 'gemini-fixture-model-001' };
  },
});

const item = draftItem(
  'fixture-mc',
  [quoted({ quote: 'fixture quoted words', location: 'page 2', supports: ['answer'] })],
  {
    type: 'multiple_choice',
    prompt: 'Fixture question?',
    options: ['first', 'second'],
    answer: { option: 0 },
    explanation: 'Fixture explanation.',
  },
);

test('the reviewer sees the full item, the answer and the quoted sources', () => {
  const { prompt } = reviewPrompt(item);
  assert.match(prompt, /Fixture question\?/);
  assert.match(prompt, /"option": 0/);
  assert.match(prompt, /Fixture explanation\./);
  assert.match(prompt, /fixture quoted words/);
  assert.match(prompt, /page 2/);
});

test('for multiple choice the reviewer is told options count from 0 and sees the correct option text', () => {
  const { prompt } = reviewPrompt(item);
  assert.match(prompt, /"correct_option_text": "first"/);
  assert.match(prompt, /numbered from 0/);
  assert.match(prompt, /distractor:N/);
});

test('items without options get no option-numbering note', () => {
  const card = { ...item, type: 'flashcard', options: undefined, answer: undefined };
  const { prompt } = reviewPrompt(card);
  assert.doesNotMatch(prompt, /numbered from 0|correct_option_text/);
});

test('the reviewer is asked about every kind of problem the protocol names', () => {
  assert.deepEqual(PROBLEM_KINDS, [
    'factual_error',
    'wrong_answer',
    'ambiguity',
    'second_correct_option',
    'outside_specification',
    'unsupported_claim',
    'wording',
  ]);
  const { system } = reviewPrompt(item);
  for (const kind of PROBLEM_KINDS) assert.match(system, new RegExp(kind));
});

test('passes when the reviewer finds no problems and is confident', async () => {
  const r = await runAdversarialReview(item, fake({ problems: [], confidence: 'high' }), {
    now: AT,
  });
  assert.equal(r.result, 'pass');
  assert.deepEqual(r.check, {
    name: 'adversarial-review',
    result: 'pass',
    tool: 'gemini:gemini-fixture-model',
    tool_version: 'gemini-fixture-model-001',
    at: '2026-11-24T12:00:00Z',
    notes: 'no problems found',
  });
});

test('fails and lists every problem the reviewer finds', async () => {
  const problems = [
    { kind: 'second_correct_option', part: 'option 1', description: 'Option 1 is also right.' },
    { kind: 'ambiguity', part: 'question', description: 'Unclear wording.' },
  ];
  const r = await runAdversarialReview(item, fake({ problems, confidence: 'high' }), { now: AT });
  assert.equal(r.result, 'fail');
  assert.equal(
    r.check.notes,
    'second_correct_option (option 1): Option 1 is also right.; ambiguity (question): Unclear wording.',
  );
  assert.deepEqual(r.problems, problems);
});

test('an unsure reviewer fails the item even with no problems listed', async () => {
  const r = await runAdversarialReview(item, fake({ problems: [], confidence: 'low' }), {
    now: AT,
  });
  assert.equal(r.result, 'fail');
  assert.equal(r.check.notes, 'no problems found; confidence low');
});

test('the reviewer is told when order does not matter, and what that covers', () => {
  const short = {
    ...item,
    type: 'short_answer',
    options: undefined,
    answer: { accepted: ['x^2 + y^2 = 36'], any_order: true },
  };
  const { prompt } = reviewPrompt(short);
  assert.match(prompt, /any_order/);
  assert.match(prompt, /in any order/);
  assert.match(prompt, /do not report missing reordered/i);
  assert.match(prompt, /coordinates and inequalities are never reordered/i);
  const ordered = { ...short, answer: { accepted: ['x^2 + y^2 = 36'] } };
  assert.doesNotMatch(reviewPrompt(ordered).prompt, /any_order/);
});

test('the reviewer is told how typed answers are normalised, so it does not ask for those forms', () => {
  const short = {
    ...item,
    type: 'short_answer',
    options: undefined,
    answer: { accepted: ['p^3q'], any_order: true },
  };
  const { prompt } = reviewPrompt(short);
  assert.match(prompt, /spaces and case are ignored/i);
  assert.match(prompt, /×, ·, \* .* multiply/);
  assert.match(prompt, /do not report missing versions that differ only/i);
  // Multiple choice has no typed answer, so no note.
  assert.doesNotMatch(reviewPrompt(item).prompt, /spaces and case are ignored/i);
});

test('the reviewer judges a hint as a method nudge backed by the steps, and still wants a source for a new fact', () => {
  const hinted = {
    ...item,
    type: 'worked_maths',
    options: undefined,
    hint: 'Collect the x terms on one side first.',
    steps: ['5x - 2x = 7 + 2', '3x = 9', 'x = 3'],
  };
  const { prompt } = reviewPrompt(hinted);
  assert.match(prompt, /hint is a method nudge/i);
  assert.match(prompt, /reveals? the answer/i);
  assert.match(prompt, /consistent with the (?:item's )?(?:verified |checked )?steps/i);
  assert.match(prompt, /mathematically correct and suitable for the age group/i);
  assert.match(prompt, /new factual claim .* needs a quoted source/i);
  assert.match(
    prompt,
    /do not report .* method .* not (?:described|named) in the (?:quoted )?sources/i,
  );
  assert.doesNotMatch(
    reviewPrompt({ ...hinted, hint: undefined }).prompt,
    /hint is a method nudge/i,
  );
});

test("the reviewer is told to carry out every step literally on the question's numbers", () => {
  const { system } = reviewPrompt(item);
  assert.match(
    system,
    /Carry out each step it gives literally on this question's numbers\. If doing exactly what it says gives a wrong value or does not lead to the marked answer, report factual_error\./,
  );
  assert.match(system, /hint, explanation and model solution steps/i);
});

// n10-0003's old hint, "Write 2.45 over 100", gives 0.0245, not 245/100: both providers passed it.
const oldHint = draftItem(
  'gcse-maths-h-n10-0003',
  [quoted({ quote: 'fixture quoted words', location: 'page 2', supports: ['answer'] })],
  {
    type: 'numeric',
    options: undefined,
    prompt: 'Write 2.45 as an improper fraction in its simplest form.',
    answer: { value: '49/20', form: 'improper_fraction' },
    verify: { expression: '245/100' },
    hint: 'Write 2.45 over 100.',
    explanation: '2.45 = 245/100. Divide top and bottom by 5: 49/20.',
  },
);

test('a hint that gives a wrong value when followed literally fails the review', async () => {
  let asked;
  const reviewer = {
    provider: 'openai',
    model: 'openai-fixture-model',
    async complete(request) {
      asked = request;
      return {
        output: {
          problems: [
            {
              kind: 'factual_error',
              part: 'hint',
              description: 'Writing 2.45 over 100 gives 2.45/100 = 0.0245, not 245/100.',
            },
          ],
          confidence: 'high',
        },
        modelVersion: 'openai-fixture-model-001',
      };
    },
  };
  const r = await runAdversarialReview(oldHint, reviewer, { now: AT });
  assert.match(asked.system, /Carry out each step it gives literally/);
  assert.match(asked.prompt, /Write 2\.45 over 100\./);
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /^factual_error \(hint\): Writing 2\.45 over 100 gives/);
});
