import { describe, expect, it } from 'vitest';
import { createMathsEngineClient, MathsEngineError } from './maths-engine';

describe('maths engine client', () => {
  it('posts the lines and the expected answer, and reads the result', async () => {
    let sent: { url: string; body: unknown } | undefined;
    const engine = createMathsEngineClient('https://maths.example.com', async (url, init) => {
      sent = { url: String(url), body: JSON.parse(String(init?.body)) };
      return Response.json({ first_wrong_line: 1, final_answer_correct: false });
    });
    const result = await engine.checkWorking(['x + 1 = 3', 'x = 5'], { solutions: ['2'] });
    expect(sent).toEqual({
      url: 'https://maths.example.com/check-working',
      body: { lines: ['x + 1 = 3', 'x = 5'], expected: { solutions: ['2'] } },
    });
    expect(result).toEqual({ firstWrongLine: 1, finalAnswerCorrect: false });
  });

  it('treats an unknown final answer as not correct', async () => {
    const engine = createMathsEngineClient('https://maths.example.com/', async () =>
      Response.json({ first_wrong_line: null, final_answer_correct: null }),
    );
    expect(await engine.checkWorking(['x = 2'], { expression: 'x' })).toEqual({
      firstWrongLine: null,
      finalAnswerCorrect: false,
    });
  });

  it('fails clearly when the engine refuses the input or cannot be reached', async () => {
    const refused = createMathsEngineClient('https://maths.example.com', async () =>
      Response.json({ detail: 'bad' }, { status: 400 }),
    );
    await expect(refused.checkWorking(['?'], { expression: 'x' })).rejects.toThrow(
      MathsEngineError,
    );
    const down = createMathsEngineClient('https://maths.example.com', async () => {
      throw new TypeError('network');
    });
    await expect(down.checkWorking(['x'], { expression: 'x' })).rejects.toThrow(/reached/);
  });
});
