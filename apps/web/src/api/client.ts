import type { ZodType } from 'zod';
import {
  answerResultSchema,
  familySchema,
  learningPathSchema,
  lessonSchema,
  type AnswerRequest,
  type AnswerResult,
  type Family,
  type LearningPath,
  type Lesson,
} from './schemas';

export type ApiErrorKind = 'network' | 'http' | 'schema';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  getFamily(): Promise<Family>;
  getPath(studentId: string): Promise<LearningPath>;
  getLesson(lessonId: string): Promise<Lesson>;
  submitAnswer(lessonId: string, answer: AnswerRequest): Promise<AnswerResult>;
}

interface ClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

/** Typed API client. Every response is checked against its schema before it is used. */
export function createApiClient({
  baseUrl,
  fetch = (...args) => globalThis.fetch(...args),
}: ClientOptions): ApiClient {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  async function request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, root), {
        ...init,
        headers: { Accept: 'application/json', ...init?.headers },
      });
    } catch {
      throw new ApiError('network', 'The request could not be sent.');
    }
    if (!response.ok) {
      throw new ApiError('http', `The server replied with ${response.status}.`, response.status);
    }
    const parsed = schema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new ApiError('schema', `Unexpected response from ${path}.`);
    }
    return parsed.data;
  }

  return {
    getFamily: () => request('family', familySchema),
    getPath: (studentId) =>
      request(`students/${encodeURIComponent(studentId)}/path`, learningPathSchema),
    getLesson: (lessonId) => request(`lessons/${encodeURIComponent(lessonId)}`, lessonSchema),
    submitAnswer: (lessonId, answer) =>
      request(`lessons/${encodeURIComponent(lessonId)}/answers`, answerResultSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answer),
      }),
  };
}
