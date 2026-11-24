/**
 * The only way the API calls an AI model. For every call it:
 * 1. picks the provider and model for the job (docs/AI.md),
 * 2. refuses if the request contains the student's profile or other personal data,
 * 3. refuses if the child's monthly spend cap is reached,
 * 4. calls the provider, retrying busy errors and bad replies with exponential backoff,
 * 5. validates the reply with Zod, and
 * 6. records tokens and cost per child (never the prompt or the answer).
 */
import { and, eq, gte, sum } from 'drizzle-orm';
import type { z } from 'zod';
import { aiUsage, students, type Database } from '@revisionden/db';
import type { AiConfig } from '../env';
import { ApiError } from '../errors';
import type { Clock } from '../rate-limit';
import { costMicroUsd, MODELS, type ModelPrice, type TokenUsage } from './pricing';
import { findPersonalData } from './privacy';
import { AiProviderError, type AiProvider, type ProviderName } from './types';

export type AiJob = 'short_answer_marking' | 'long_answer_marking' | 'second_check';

export interface AiGatewayDeps {
  db: Database;
  clock: Clock;
  config: AiConfig;
  providers: Partial<Record<ProviderName, AiProvider>>;
  sleep?: (ms: number) => Promise<void>;
  /** 0 to 1; adds jitter to the backoff. */
  random?: () => number;
}

export interface AiCall<T> {
  studentId: string;
  job: AiJob;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
}

export interface AiGateway {
  run<T>(call: AiCall<T>): Promise<{ output: T; usage: TokenUsage }>;
}

export const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 250;
const JITTER_MS = 100;

export const aiLimitReached = () =>
  new ApiError(
    429,
    'ai_limit_reached',
    "You've used all your AI marking for this month. It comes back on the 1st. Questions marked by the app still work.",
  );
const aiUnavailable = () =>
  new ApiError(503, 'ai_unavailable', 'AI marking is not switched on yet.');
const aiFailed = () =>
  new ApiError(502, 'ai_failed', 'AI marking is not working right now. Please try again later.');
const personalData = (fields: string[]) =>
  new ApiError(
    400,
    'personal_data_in_request',
    "Please don't include names or personal details in your answer.",
    fields,
  );

/** Start of the calendar month (UTC) that `now` is in: the cap resets then. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function monthlySpendMicroUsd(
  db: Database,
  studentId: string,
  now: Date,
): Promise<number> {
  const [row] = await db
    .select({ total: sum(aiUsage.costMicroUsd) })
    .from(aiUsage)
    .where(and(eq(aiUsage.studentId, studentId), gte(aiUsage.createdAt, monthStart(now))));
  return Number(row?.total ?? 0);
}

interface Route {
  provider: ProviderName;
  model: string;
}

function routeFor(job: AiJob, config: AiConfig): Route | undefined {
  switch (job) {
    case 'short_answer_marking':
      return { provider: 'anthropic', model: MODELS.quick };
    case 'long_answer_marking':
      return { provider: 'anthropic', model: MODELS.long };
    case 'second_check':
      return config.checker && { provider: 'openai', model: config.checker.model };
  }
}

export function createAiGateway(deps: AiGatewayDeps): AiGateway {
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;
  const extraPrices: Record<string, ModelPrice> = deps.config.checker
    ? { [deps.config.checker.model]: deps.config.checker }
    : {};

  async function record(studentId: string, job: AiJob, route: Route, usage: TokenUsage) {
    await deps.db.insert(aiUsage).values({
      studentId,
      job,
      provider: route.provider,
      model: route.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costMicroUsd: costMicroUsd(route.model, usage, extraPrices),
      createdAt: deps.clock.now(),
    });
  }

  return {
    async run(call) {
      const route = routeFor(call.job, deps.config);
      const provider = route && deps.providers[route.provider];
      if (!route || !provider) throw aiUnavailable();

      const request = {
        model: route.model,
        system: call.system,
        user: call.user,
        jsonSchema: call.jsonSchema,
        maxTokens: call.maxTokens,
      };

      const [profile] = await deps.db
        .select()
        .from(students)
        .where(eq(students.id, call.studentId));
      if (!profile) throw new ApiError(404, 'not_found', 'Student not found');
      const found = findPersonalData(JSON.stringify(request), profile);
      if (found.length > 0) throw personalData(found);

      const spent = await monthlySpendMicroUsd(deps.db, call.studentId, deps.clock.now());
      if (spent >= deps.config.monthlyCapMicroUsd) throw aiLimitReached();

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (attempt > 0) await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1) + random() * JITTER_MS);
        try {
          const response = await provider.complete(request);
          await record(call.studentId, call.job, route, response.usage);
          const parsed = call.schema.safeParse(response.output);
          if (parsed.success) return { output: parsed.data, usage: response.usage };
        } catch (err) {
          if (!(err instanceof AiProviderError)) throw err;
          if (err.usage) await record(call.studentId, call.job, route, err.usage);
          if (!err.retryable) throw aiFailed();
        }
      }
      throw aiFailed();
    },
  };
}
