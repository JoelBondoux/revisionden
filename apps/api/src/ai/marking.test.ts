import { describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import type { AiCall, AiGateway } from './gateway';
import {
  AI_LABEL,
  CHECK_WITH_TEACHER,
  markShortAnswer,
  normalise,
  type ShortAnswerQuestion,
} from './marking';

// Made-up question in the shape of a points mark scheme (no real exam content).
const question: ShortAnswerQuestion = {
  topic: 'cell-biology',
  prompt: 'Give two jobs of the cell membrane.',
  marks: 2,
  acceptedAnswers: [],
  points: [
    {
      code: 'B1',
      description: 'Controls what enters and leaves the cell',
      accepted: ['controls what enters and leaves'],
    },
    {
      code: 'B2',
      description: 'Holds the cell together / gives a boundary',
      accepted: ['holds the cell together'],
    },
  ],
};

function fakeGateway(output: unknown) {
  const calls: AiCall<unknown>[] = [];
  const gateway: AiGateway = {
    async run(call) {
      calls.push(call as AiCall<unknown>);
      const parsed = call.schema.parse(output);
      return { output: parsed, usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
  return { calls, gateway };
}

const unusedGateway: AiGateway = {
  run: async () => {
    throw new Error('AI should not be called');
  },
};

const mark = (answer: string, gateway: AiGateway = unusedGateway, q = question) =>
  markShortAnswer({ question: q, answer, studentId: 'student-1', gateway });

describe('normalise', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(normalise('  It CONTROLS, what-enters!  ')).toBe('it controls what enters');
  });
});

describe('markShortAnswer', () => {
  it('awards marks by rules alone when the answer matches the mark scheme wording', async () => {
    const result = await mark('It controls what enters and leaves. It holds the cell together.');
    expect(result).toEqual({
      status: 'marked',
      markedBy: 'rules',
      score: 2,
      maxScore: 2,
      awarded: [
        { code: 'B1', by: 'rule' },
        { code: 'B2', by: 'rule' },
      ],
    });
  });

  it('gives full marks by rules for an accepted whole answer', async () => {
    const q = { ...question, acceptedAnswers: ['Barrier and control'] };
    expect(await mark('barrier and control.', unusedGateway, q)).toMatchObject({
      status: 'marked',
      markedBy: 'rules',
      score: 2,
    });
  });

  it('gives full marks by rules when an accepted answer appears inside a sentence', async () => {
    const q = { ...question, acceptedAnswers: ['barrier and control'] };
    expect(await mark('I think it is a barrier and control thing', unusedGateway, q)).toMatchObject(
      {
        markedBy: 'rules',
        score: 2,
      },
    );
  });

  it('never awards a mark by rule when the answer negates the wording', async () => {
    const q = { ...question, marks: 1, acceptedAnswers: ['the nucleus'], points: [] };
    expect(await mark('It is not the nucleus', unusedGateway, q)).toMatchObject({
      status: 'check_with_teacher',
    });
    const { calls, gateway } = fakeGateway({
      points: [
        { code: 'B1', met: false, evidence: '' },
        { code: 'B2', met: false, evidence: '' },
      ],
      sure: true,
      feedback: 'Check what the membrane does.',
    });
    const result = await mark("It doesn't control what enters and leaves", gateway);
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ markedBy: 'ai', score: 0 });
  });

  it('scores a blank answer 0 without asking the AI', async () => {
    expect(await mark('   ')).toMatchObject({ status: 'marked', markedBy: 'rules', score: 0 });
  });

  it('asks the AI only about the points the rules did not award, and cites each point', async () => {
    const { calls, gateway } = fakeGateway({
      points: [{ code: 'B2', met: true, evidence: 'keeps the cell in one piece' }],
      sure: true,
      feedback: 'Both jobs are there.',
    });
    const answer = 'It controls what enters and leaves, and keeps the cell in one piece.';
    const result = await mark(answer, gateway);

    expect(result).toEqual({
      status: 'marked',
      markedBy: 'ai',
      score: 2,
      maxScore: 2,
      awarded: [
        { code: 'B1', by: 'rule' },
        { code: 'B2', by: 'ai', evidence: 'keeps the cell in one piece' },
      ],
      feedback: 'Both jobs are there.',
      label: AI_LABEL,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.job).toBe('short_answer_marking');
    expect(calls[0]!.studentId).toBe('student-1');
    expect(JSON.parse(calls[0]!.user)).toEqual({
      topic: 'cell-biology',
      question: question.prompt,
      answer,
      mark_points: [{ code: 'B2', description: question.points[1]!.description }],
    });
    expect(calls[0]!.system).toMatch(/do not rewrite/i);
  });

  it('labels every AI-marked result exactly', () => {
    expect(AI_LABEL).toBe(
      "Marked by AI. This is a guide to help you improve, not your teacher's mark.",
    );
  });

  it('awards nothing for a point the AI says is not met', async () => {
    const { gateway } = fakeGateway({
      points: [
        { code: 'B1', met: false, evidence: '' },
        { code: 'B2', met: false, evidence: '' },
      ],
      sure: true,
      feedback: 'Say what the membrane does.',
    });
    expect(await mark('It is green.', gateway)).toMatchObject({
      status: 'marked',
      markedBy: 'ai',
      score: 0,
      awarded: [],
      label: AI_LABEL,
    });
  });

  describe('uncertain means "check with your teacher", never a guess', () => {
    const uncertain = async (output: unknown) =>
      mark('It does membrane things.', fakeGateway(output).gateway);

    it('when the AI says it is not sure', async () => {
      const result = await uncertain({
        points: [
          { code: 'B1', met: true, evidence: 'membrane things' },
          { code: 'B2', met: false, evidence: '' },
        ],
        sure: false,
        feedback: 'Hmm.',
      });
      expect(result).toEqual({
        status: 'check_with_teacher',
        maxScore: 2,
        awarded: [],
        message: CHECK_WITH_TEACHER,
        label: AI_LABEL,
      });
    });

    it('when the AI cites a point that is not in the mark scheme', async () => {
      expect(
        await uncertain({
          points: [{ code: 'C9', met: true, evidence: 'membrane things' }],
          sure: true,
          feedback: '',
        }),
      ).toMatchObject({ status: 'check_with_teacher' });
    });

    it('when the AI leaves a point out', async () => {
      expect(
        await uncertain({
          points: [{ code: 'B1', met: false, evidence: '' }],
          sure: true,
          feedback: '',
        }),
      ).toMatchObject({ status: 'check_with_teacher' });
    });

    it("when the AI's evidence is not actually in the student's answer", async () => {
      expect(
        await uncertain({
          points: [
            { code: 'B1', met: true, evidence: 'controls entry and exit' },
            { code: 'B2', met: false, evidence: '' },
          ],
          sure: true,
          feedback: '',
        }),
      ).toMatchObject({ status: 'check_with_teacher' });
    });

    it('keeps marks the rules awarded with certainty', async () => {
      const { gateway } = fakeGateway({
        points: [{ code: 'B2', met: true, evidence: 'something' }],
        sure: false,
        feedback: '',
      });
      expect(await mark('It controls what enters and leaves. something', gateway)).toMatchObject({
        status: 'check_with_teacher',
        awarded: [{ code: 'B1', by: 'rule' }],
      });
    });
  });

  it('does not use AI when there are no official mark points to check against', async () => {
    const q = { ...question, points: [], acceptedAnswers: ['a barrier'] };
    expect(await mark('a wall', unusedGateway, q)).toEqual({
      status: 'check_with_teacher',
      maxScore: 2,
      awarded: [],
      message: CHECK_WITH_TEACHER,
    });
  });

  it('passes gateway refusals (such as the monthly cap) straight through', async () => {
    const gateway: AiGateway = {
      run: async () => {
        throw new ApiError(429, 'ai_limit_reached', 'limit');
      },
    };
    await expect(mark('It does membrane things.', gateway)).rejects.toMatchObject({
      code: 'ai_limit_reached',
    });
  });
});
