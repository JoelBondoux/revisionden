import { itemSpeechText, mathsToSpeech } from './maths';

describe('reading maths aloud', () => {
  it.each([
    ['x^2 + 3', 'x squared plus 3'],
    ['y³ - 1', 'y cubed minus 1'],
    ['Work out 8^(2/3).', 'Work out 8 to the power 2 over 3.'],
    ['2^5', '2 to the power 5'],
    ['Area = pi * 3^2', 'Area equals pi times 3 squared'],
    ['√49', 'the square root of 49'],
    ['3/4 of 20', '3 over 4 of 20'],
    ['6 × 7 ÷ 2', '6 times 7 divided by 2'],
    ['x ≤ 5 and y ≥ -2', 'x is less than or equal to 5 and y is greater than or equal to minus 2'],
    ['a < b > c', 'a is less than b is greater than c'],
    ['±4', 'plus or minus 4'],
    ['90°', '90 degrees'],
    ['28.27 cm^2', '28.27 square centimetres'],
    ['12 m^3', '12 cubic metres'],
    ['2πr', '2 pi r'],
    // Exactly the powers the screen raises (F9b, Codex review on #254).
    ['10^2.5', '10 to the power 2.5'],
    ['10^−3', '10 to the power minus 3'],
    ['10^-3', '10 to the power minus 3'],
    ['x^2y', 'x squared y'],
    ['e^(x^2)', 'e to the power x squared'],
    ['x^n + 1', 'x to the power n plus 1'],
    ['Press ^ to raise', 'Press ^ to raise'],
  ])('reads %s as "%s"', (text, spoken) => {
    expect(mathsToSpeech(text)).toBe(spoken);
  });

  it('leaves ordinary words and hyphens alone', () => {
    expect(mathsToSpeech('A well-known fact: the angles add up.')).toBe(
      'A well-known fact: the angles add up.',
    );
  });

  it('reads a multiple choice question with its options', () => {
    expect(
      itemSpeechText({
        id: 'i1',
        topicId: 't',
        topicTitle: 'T',
        draft: false,
        type: 'multiple_choice',
        prompt: 'Which is x^2 when x = 3?',
        options: ['6', '9'],
      }),
    ).toBe('Which is x squared when x equals 3? Option 1: 6. Option 2: 9.');
  });

  it('reads the unit of a numeric question and the front of a flashcard', () => {
    const base = { id: 'i1', topicId: 't', topicTitle: 'T', draft: false } as const;
    expect(
      itemSpeechText({ ...base, type: 'numeric', prompt: 'Find the area.', unit: 'cm^2' }),
    ).toBe('Find the area. Answer in square centimetres.');
    expect(
      itemSpeechText({ ...base, type: 'flashcard', front: 'What is π?', back: 'About 3.14' }),
    ).toBe('What is pi?');
  });
});
