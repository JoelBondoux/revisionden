import { answerReaction } from './reaction';

describe('how Pip reacts to an answer (F13, for J14)', () => {
  it('says right for a right answer and wrong for a wrong one', () => {
    expect(answerReaction({ correct: true, goalWasMet: false, goalMet: false })).toBe('right');
    expect(answerReaction({ correct: false, goalWasMet: false, goalMet: false })).toBe('wrong');
  });

  it("says goal when a right answer meets today's goal for the first time", () => {
    expect(answerReaction({ correct: true, goalWasMet: false, goalMet: true })).toBe('goal');
    expect(answerReaction({ correct: true, goalWasMet: true, goalMet: true })).toBe('right');
  });

  it('says helped for a right answer after Help me understand, even when it meets the goal', () => {
    expect(answerReaction({ correct: true, helped: true, goalWasMet: false, goalMet: false })).toBe(
      'helped',
    );
    expect(answerReaction({ correct: true, helped: true, goalWasMet: false, goalMet: true })).toBe(
      'goal',
    );
  });

  it('says wrong for a wrong answer, helped or not', () => {
    expect(
      answerReaction({ correct: false, helped: true, goalWasMet: false, goalMet: false }),
    ).toBe('wrong');
  });
});
