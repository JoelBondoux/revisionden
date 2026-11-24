import { describe, expect, it } from 'vitest';
import { toShortAnswerQuestion } from './items';

const row = (body: unknown, answer: unknown = { accepted: ['a'] }) => ({
  type: 'short_answer',
  topicId: 'topic-1',
  body,
  answer,
});

describe('toShortAnswerQuestion', () => {
  it('reads mark points from the inline mark scheme, whose own wording earns the point by rule', () => {
    expect(
      toShortAnswerQuestion(
        row({ prompt: 'Q?', marks: 2, mark_scheme: ['B1 for idea one', 'B2 idea two'] }),
      ),
    ).toEqual({
      topic: 'topic-1',
      prompt: 'Q?',
      marks: 2,
      acceptedAnswers: ['a'],
      points: [
        { code: 'B1', description: 'idea one', accepted: ['idea one'] },
        { code: 'B2', description: 'idea two', accepted: ['idea two'] },
      ],
    });
  });

  it('prefers structured mark points with their accepted wording', () => {
    const q = toShortAnswerQuestion(
      row({
        prompt: 'Q?',
        marks: 1,
        mark_points: [{ code: 'B1', description: 'd', accepted: ['x y'] }],
      }),
    );
    expect(q?.points).toEqual([{ code: 'B1', description: 'd', accepted: ['x y'] }]);
  });

  it('turns the accepted answers of a one-mark item into its single mark point', () => {
    const q = toShortAnswerQuestion(row({ prompt: 'Q?', marks: 1 }, { accepted: ['nucleus'] }));
    expect(q?.points).toEqual([
      { code: 'B1', description: 'Gives an accepted answer: nucleus', accepted: ['nucleus'] },
    ]);
  });

  it('has no mark points for a multi-mark item without a mark scheme', () => {
    expect(toShortAnswerQuestion(row({ prompt: 'Q?', marks: 3 }))?.points).toEqual([]);
  });

  it('returns null for other item types or a malformed body', () => {
    expect(
      toShortAnswerQuestion({ ...row({ prompt: 'Q', marks: 1 }), type: 'flashcard' }),
    ).toBeNull();
    expect(toShortAnswerQuestion(row({ marks: 1 }))).toBeNull();
    expect(
      toShortAnswerQuestion(row({ prompt: 'Q', marks: 1, mark_scheme: ['nonsense'] })),
    ).toBeNull();
  });
});
