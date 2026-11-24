/**
 * Client for the maths engine (services/maths, `POST /check-working`). No AI: SymPy checks
 * each line of working follows from the one before and whether the final answer is right.
 */
export interface WorkingCheck {
  /** 0-based index of the first line that does not follow from the previous one, or null. */
  firstWrongLine: number | null;
  finalAnswerCorrect: boolean;
}

export interface ExpectedAnswer {
  solutions?: string[];
  expression?: string;
  form?: 'factorised' | 'expanded';
}

export interface MathsEngine {
  checkWorking(lines: string[], expected: ExpectedAnswer): Promise<WorkingCheck>;
}

/** The engine could not be reached or refused the input. */
export class MathsEngineError extends Error {}

export function createMathsEngineClient(
  baseUrl: string,
  fetchFn: typeof fetch = (...args) => fetch(...args),
): MathsEngine {
  const url = new URL('check-working', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  return {
    async checkWorking(lines, expected) {
      let res: Response;
      try {
        res = await fetchFn(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lines, expected }),
        });
      } catch {
        throw new MathsEngineError('The maths engine could not be reached');
      }
      if (!res.ok) throw new MathsEngineError(`The maths engine replied with ${res.status}`);
      const body = (await res.json()) as {
        first_wrong_line: number | null;
        final_answer_correct: boolean | null;
      };
      return {
        firstWrongLine: body.first_wrong_line,
        finalAnswerCorrect: body.final_answer_correct === true,
      };
    },
  };
}
