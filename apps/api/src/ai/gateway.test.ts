import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { aiUsage } from '@revisionden/db';
import { createTestContext, TEST_CONFIG, type TestContext } from '../test/helpers';
import { makeStudentWithDevice } from '../test/fixtures';
import { ApiError } from '../errors';
import { createAiGateway, monthlySpendMicroUsd, type AiGatewayDeps } from './gateway';
import { AiProviderError, type AiProvider, type AiRequest, type AiResponse } from './types';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => ctx.close());

type Step = AiResponse | AiProviderError;

function fakeProvider(name: AiProvider['name'], ...steps: Step[]) {
  const requests: AiRequest[] = [];
  const provider: AiProvider = {
    name,
    async complete(req) {
      requests.push(req);
      const step = steps.shift();
      if (!step) throw new Error('fake provider has no more steps');
      if (step instanceof AiProviderError) throw step;
      return step;
    },
  };
  return { provider, requests };
}

const ok = (output: unknown = { verdict: 'yes' }): AiResponse => ({
  output,
  usage: { inputTokens: 1000, outputTokens: 200 },
});

const schema = z.object({ verdict: z.enum(['yes', 'no']) });
const call = (studentId: string, user = '{"question":"Is water wet?","answer":"yes"}') => ({
  studentId,
  job: 'short_answer_marking' as const,
  system: 'Mark it.',
  user,
  schema,
  jsonSchema: { type: 'object' },
  maxTokens: 500,
});

function gateway(overrides: Partial<AiGatewayDeps> = {}) {
  const sleeps: number[] = [];
  const g = createAiGateway({
    db: ctx.db,
    clock: ctx.clock,
    config: TEST_CONFIG.ai,
    providers: {},
    sleep: async (ms) => void sleeps.push(ms),
    random: () => 0,
    ...overrides,
  });
  return { g, sleeps };
}

describe('AI gateway', () => {
  it('sends quick marking to Claude Haiku 5.5, validates the reply and records usage', async () => {
    const { student } = await makeStudentWithDevice(ctx.db);
    const fake = fakeProvider('anthropic', ok());
    const { g } = gateway({ providers: { anthropic: fake.provider } });

    const result = await g.run(call(student.id));
    expect(result).toEqual({
      output: { verdict: 'yes' },
      usage: { inputTokens: 1000, outputTokens: 200 },
    });
    expect(fake.requests[0]).toMatchObject({
      model: 'claude-haiku-5-5',
      system: 'Mark it.',
      maxTokens: 500,
    });

    const rows = await ctx.db.select().from(aiUsage);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      studentId: student.id,
      job: 'short_answer_marking',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      inputTokens: 1000,
      outputTokens: 200,
      costMicroUsd: 200,
    });
  });

  it('refuses with a friendly error once the monthly cap is reached, before calling the provider', async () => {
    const { student } = await makeStudentWithDevice(ctx.db);
    await ctx.db.insert(aiUsage).values({
      studentId: student.id,
      job: 'short_answer_marking',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      inputTokens: 1,
      outputTokens: 1,
      costMicroUsd: 2_500_000,
      createdAt: ctx.clock.now(),
    });
    const fake = fakeProvider('anthropic', ok());
    const { g } = gateway({ providers: { anthropic: fake.provider } });

    const err = await g.run(call(student.id)).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: 'ai_limit_reached' });
    expect(err.message).toBe(
      "You've used this month's AI marking allowance. It resets on 1 December. Questions marked by the app still work.",
    );
    expect(fake.requests).toHaveLength(0);
  });

  it("does not count last month's spend against this month", async () => {
    const { student } = await makeStudentWithDevice(ctx.db);
    await ctx.db.insert(aiUsage).values({
      studentId: student.id,
      job: 'short_answer_marking',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      inputTokens: 1,
      outputTokens: 1,
      costMicroUsd: 9_000_000,
      createdAt: new Date('2026-10-31T23:59:00Z'),
    });
    expect(await monthlySpendMicroUsd(ctx.db, student.id, ctx.clock.now())).toBe(0);
    const { g } = gateway({ providers: { anthropic: fakeProvider('anthropic', ok()).provider } });
    await expect(g.run(call(student.id))).resolves.toBeDefined();
  });

  it('keeps each child to their own cap', async () => {
    const a = await makeStudentWithDevice(ctx.db);
    const b = await makeStudentWithDevice(ctx.db);
    await ctx.db.insert(aiUsage).values({
      studentId: a.student.id,
      job: 'x',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      inputTokens: 1,
      outputTokens: 1,
      costMicroUsd: 3_000_000,
      createdAt: ctx.clock.now(),
    });
    const { g } = gateway({ providers: { anthropic: fakeProvider('anthropic', ok()).provider } });
    await expect(g.run(call(b.student.id))).resolves.toBeDefined();
  });

  it('retries busy errors with exponential backoff, counting every billed attempt', async () => {
    const { student } = await makeStudentWithDevice(ctx.db);
    const fake = fakeProvider(
      'anthropic',
      new AiProviderError('busy', true, 529),
      new AiProviderError('not json', true, 200, { inputTokens: 1000, outputTokens: 200 }),
      ok(),
    );
    const { g, sleeps } = gateway({ providers: { anthropic: fake.provider } });
    await expect(g.run(call(student.id))).resolves.toMatchObject({ output: { verdict: 'yes' } });
    expect(sleeps).toEqual([250, 500]);
    expect(await ctx.db.select().from(aiUsage)).toHaveLength(2);
  });

  it('retries when the reply does not match the schema', async () => {
    const { student } = await makeStudentWithDevice(ctx.db);
    const fake = fakeProvider('anthropic', ok({ verdict: 'maybe' }), ok());
    const { g } = gateway({ providers: { anthropic: fake.provider } });
    await expect(g.run(call(student.id))).resolves.toMatchObject({ output: { verdict: 'yes' } });
    expect(fake.requests).toHaveLength(2);
  });

  it('gives up after three attempts with a friendly error', async () => {
    const { student } = await makeStudentWithDevice(ctx.db);
    const busy = () => new AiProviderError('busy', true, 529);
    const fake = fakeProvider('anthropic', busy(), busy(), busy());
    const { g } = gateway({ providers: { anthropic: fake.provider } });
    const err = await g.run(call(student.id)).catch((e) => e);
    expect(err).toMatchObject({ status: 502, code: 'ai_failed' });
    expect(fake.requests).toHaveLength(3);
  });

  it('does not retry an error that will not go away', async () => {
    const { student } = await makeStudentWithDevice(ctx.db);
    const fake = fakeProvider('anthropic', new AiProviderError('bad', false, 400));
    const { g } = gateway({ providers: { anthropic: fake.provider } });
    expect(await g.run(call(student.id)).catch((e) => e)).toMatchObject({ code: 'ai_failed' });
    expect(fake.requests).toHaveLength(1);
  });

  it('answers 503 when the provider for the job is not configured', async () => {
    const { student } = await makeStudentWithDevice(ctx.db);
    const { g } = gateway();
    expect(await g.run(call(student.id)).catch((e) => e)).toMatchObject({
      status: 503,
      code: 'ai_unavailable',
    });
  });

  it('routes the second check to the configured checker model on a different provider', async () => {
    const { student } = await makeStudentWithDevice(ctx.db);
    const fake = fakeProvider('openai', ok());
    const config = {
      ...TEST_CONFIG.ai,
      checker: { model: 'checker-model', inputUsdPerMTok: 0.2, outputUsdPerMTok: 0.8 },
    };
    const { g } = gateway({ config, providers: { openai: fake.provider } });
    await g.run({ ...call(student.id), job: 'second_check' });
    expect(fake.requests[0]!.model).toBe('checker-model');
    const [row] = await ctx.db.select().from(aiUsage);
    expect(row).toMatchObject({ provider: 'openai', model: 'checker-model', costMicroUsd: 360 });

    const { g: noChecker } = gateway({ providers: { openai: fake.provider } });
    expect(
      await noChecker.run({ ...call(student.id), job: 'second_check' }).catch((e) => e),
    ).toMatchObject({ code: 'ai_unavailable' });
  });

  describe('hard rule: no names or personal data in requests', () => {
    it.each(['nickname', 'avatarCode', 'id', 'familyId'] as const)(
      'refuses a request that contains the student %s, without calling the provider',
      async (field) => {
        const { student } = await makeStudentWithDevice(ctx.db, 'pixel_fox');
        const fake = fakeProvider('anthropic', ok());
        const { g } = gateway({ providers: { anthropic: fake.provider } });
        const user = JSON.stringify({ question: 'q', answer: `my ${field} is ${student[field]}` });
        const err = await g.run(call(student.id, user)).catch((e) => e);
        expect(err).toMatchObject({ status: 400, code: 'personal_data_in_request' });
        expect(fake.requests).toHaveLength(0);
        expect(await ctx.db.select().from(aiUsage)).toHaveLength(0);
      },
    );

    it('checks the system prompt too', async () => {
      const { student } = await makeStudentWithDevice(ctx.db, 'pixel_fox');
      const fake = fakeProvider('anthropic', ok());
      const { g } = gateway({ providers: { anthropic: fake.provider } });
      const err = await g
        .run({ ...call(student.id), system: 'You are marking for pixel_fox.' })
        .catch((e) => e);
      expect(err).toMatchObject({ code: 'personal_data_in_request' });
    });

    it('never sends the student id or nickname with a normal request', async () => {
      const { student } = await makeStudentWithDevice(ctx.db, 'pixel_fox');
      const fake = fakeProvider('anthropic', ok());
      const { g } = gateway({ providers: { anthropic: fake.provider } });
      await g.run(call(student.id));
      const sent = JSON.stringify(fake.requests);
      expect(sent).not.toContain(student.id);
      expect(sent.toLowerCase()).not.toContain('pixel_fox');
    });
  });
});
