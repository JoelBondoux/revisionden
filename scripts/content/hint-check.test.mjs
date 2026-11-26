import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hintErrors } from './hint-check.mjs';

const numeric = (value, hint, prompt = 'Work out 3 × 4 + 2.') => ({
  type: 'numeric',
  prompt,
  answer: { value },
  hint,
});

test('an item without a hint has no hint errors', () => {
  assert.deepEqual(
    hintErrors({ type: 'numeric', prompt: 'Work out 2 + 2.', answer: { value: '4' } }),
    [],
  );
});

test('a hint that names the numeric answer is refused', () => {
  assert.equal(hintErrors(numeric('14', 'The answer is 14.')).length, 1);
});

test('a hint that gives the numeric answer in another form is refused', () => {
  assert.equal(hintErrors(numeric('0.5', 'You should get 1/2.')).length, 1);
  assert.equal(hintErrors(numeric('-3', 'It comes to −3.')).length, 1);
  assert.equal(hintErrors(numeric('4/3', 'That is about 1.333.', 'Find the gradient.')).length, 1);
});

test('a hint may repeat a number that is already in the question', () => {
  assert.deepEqual(
    hintErrors(numeric('4', 'Multiply 4 by the other number.', 'Work out 4 × 1.')),
    [],
  );
});

test('a hint that only nudges toward the method passes', () => {
  assert.deepEqual(hintErrors(numeric('14', 'Do the multiplication before the addition.')), []);
});

test('a hint that contains an accepted short answer is refused, ignoring spaces and case', () => {
  const item = {
    type: 'short_answer',
    prompt: 'Find the nth term of 5, 8, 11, 14, ...',
    answer: { accepted: ['3n + 2'] },
    hint: 'Try 3N+2 and check it.',
  };
  assert.equal(hintErrors(item).length, 1);
});

test('a hint that contains a worked solution or the final expression is refused', () => {
  const solve = {
    type: 'worked_maths',
    prompt: 'Solve 2x + 1 = 7.',
    answer: { solutions: ['x = 3'] },
    hint: 'Subtract 1 then divide: x = 3.',
  };
  const expr = {
    type: 'worked_maths',
    prompt: 'Expand 2(x + 3).',
    answer: { expression: '2x + 6' },
    hint: 'Multiply each term to get 2x + 6.',
  };
  assert.equal(hintErrors(solve).length, 1);
  assert.equal(hintErrors(expr).length, 1);
});

test('a hint that quotes the correct option of a multiple-choice item is refused', () => {
  const item = {
    type: 'multiple_choice',
    prompt: 'Which line is parallel to y = 2x + 1?',
    options: ['y = 3x + 1', 'y = 2x - 5', 'y = -2x + 1'],
    answer: { option: 1 },
    hint: 'Look for y = 2x - 5.',
  };
  assert.equal(hintErrors(item).length, 1);
  assert.deepEqual(hintErrors({ ...item, hint: 'Parallel lines have the same gradient.' }), []);
});

test('a hint that repeats the back of a flashcard is refused', () => {
  const card = {
    type: 'flashcard',
    front: 'Gradient of a distance-time graph?',
    back: 'Speed',
    hint: 'It is speed.',
  };
  assert.equal(hintErrors(card).length, 1);
  assert.deepEqual(hintErrors({ ...card, hint: 'Think about distance divided by time.' }), []);
});

test('a standard-form answer is read as the whole number, not its first digits (n9-0006)', () => {
  const sf = (hint) =>
    hintErrors({
      type: 'numeric',
      prompt: 'Work out (3.2 × 10^4) × (2 × 10^4). Give your answer in standard form.',
      answer: { value: '6.4*10^8', form: 'standard_form' },
      hint,
    });
  assert.equal(sf('It comes to 640000000.').length, 1);
  assert.equal(sf('It comes to 640,000,000.').length, 1);
  assert.equal(sf('Write it as 6.4 × 10^8.').length, 1);
  assert.deepEqual(sf('Multiply 3.2 by 2 to get 6.4, then add the powers of 10.'), []);
});

test('a hint with the plain value of a standard-form answer is refused (n9-0006)', () => {
  const sf = (hint) =>
    hintErrors({
      type: 'numeric',
      prompt: 'Write 6.4 × 10^8 as an ordinary number.',
      answer: { value: '640000000' },
      hint,
    });
  assert.equal(sf('It is 640000000.').length, 1);
  assert.equal(sf('It is 640,000,000.').length, 1);
  assert.equal(sf('It is 640 000 000.').length, 1);
  assert.deepEqual(sf('Multiply 6.4 by 10 eight times.'), []);
});

test('a hint with the answer as a mixed number is refused', () => {
  assert.equal(hintErrors(numeric('4/3', 'That is 1 1/3.', 'Find the gradient.')).length, 1);
});

test('a standard-form answer written with superscript powers is refused (n9-0006)', () => {
  const sf = (
    hint,
    prompt = 'Work out (3.2 × 10^4) × (2 × 10^4). Give your answer in standard form.',
  ) =>
    hintErrors({
      type: 'numeric',
      prompt,
      answer: { value: '6.4*10^8', form: 'standard_form' },
      hint,
    });
  assert.equal(sf('The answer is 6.4 × 10⁸.').length, 1);
  assert.equal(sf('The answer is 6.4×10⁸.').length, 1);
  assert.deepEqual(sf('Multiply 3.2 by 2, then add the powers: 10⁴ × 10⁴.'), []);
  // A small answer with a negative superscript power.
  const small = (hint) =>
    hintErrors({
      type: 'numeric',
      prompt: 'Write 0.00052 in standard form.',
      answer: { value: '5.2*10^-4' },
      hint,
    });
  assert.equal(small('It is 5.2 × 10⁻⁴.').length, 1);
  assert.deepEqual(small('Move the decimal point until the number is between 1 and 10.'), []);
});

test('a superscript power already shown in the question may be repeated', () => {
  const item = {
    type: 'numeric',
    prompt: 'Write 6.4 × 10⁸ as an ordinary number.',
    answer: { value: '640000000' },
    hint: 'Start from 6.4 × 10⁸ and move the decimal point 8 places.',
  };
  assert.deepEqual(hintErrors(item), []);
});
