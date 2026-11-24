import { afterEach, describe, expect, it } from 'vitest';
import { aiUsage, items, topics } from '@revisionden/db';
import okFixture from './fixtures/anthropic-marking-ok.json';
import { createAnthropicProvider } from './anthropic';
import { AI_LABEL } from './marking';
import { createTestContext, jsonRequest, type TestContext, AVATAR } from '../test/helpers';
import { makeStudentWithDevice, studentCookie } from '../test/fixtures';

let ctx: TestContext;
afterEach(async () => ctx.close());

/** Real Anthropic provider (official SDK) with a fake fetch that records the HTTP bodies. */
function recordingProvider(responses: unknown[] = [okFixture]) {
  const bodies: string[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    bodies.push(await new Request(input, init).text());
    const next = responses.shift();
    if (!next) throw new Error('no fixture left');
    return new Response(JSON.stringify(next), { headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;
  const provider = createAnthropicProvider({
    apiKey: 'test-key-not-real',
    gatewayUrl: 'https://gateway.example.com/v1/acct/gw',
    fetch,
  });
  return { bodies, provider };
}

async function setUp(nickname = 'pixel_fox') {
  const rec = recordingProvider();
  ctx = await createTestContext({ aiProviders: { anthropic: rec.provider } });
  const s = await makeStudentWithDevice(ctx.db, nickname);
  const headers = await studentCookie(ctx.db, s.student.id, s.device.id);
  await ctx.db
    .insert(topics)
    .values({ id: 'test-cells', subjectId: 'gcse-biology', board: 'aqa', title: 'Cells' });
  // Made-up item in the content format: prompt, marks and an inline points mark scheme.
  const [item] = await ctx.db
    .insert(items)
    .values({
      topicId: 'test-cells',
      type: 'short_answer',
      // The stored item format (learning/content-sync.ts).
      body: { prompt: 'What does the cell membrane do?', marks: 1 },
      answer: {
        key: { accepted: ['controls what enters and leaves the cell'] },
        markScheme: ['B1 for controls what enters and leaves the cell'],
      },
    })
    .returning();
  return { ...s, headers, item: item!, rec };
}

const markRequest = (itemId: string, answer: string, headers: Record<string, string>) =>
  jsonRequest('POST', { itemId, answer }, headers);

describe('POST /v1/ai/mark-short-answer', () => {
  it('needs an unlocked student device', async () => {
    ctx = await createTestContext();
    const res = await ctx.app.request(
      '/v1/ai/mark-short-answer',
      jsonRequest('POST', { itemId: crypto.randomUUID(), answer: 'x' }),
    );
    expect(res.status).toBe(401);
  });

  it('marks by rules without calling the AI when the wording matches', async () => {
    const { headers, item, rec } = await setUp();
    const res = await ctx.app.request(
      '/v1/ai/mark-short-answer',
      markRequest(item.id, 'It controls what enters and leaves the cell.', headers),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'marked',
      markedBy: 'rules',
      score: 1,
      maxScore: 1,
      awarded: [{ code: 'B1', by: 'rule' }],
    });
    expect(rec.bodies).toHaveLength(0);
  });

  it('marks a wording variant with Claude Haiku 5.5, labelled and citing the mark point', async () => {
    const { headers, item, rec, student } = await setUp();
    const res = await ctx.app.request(
      '/v1/ai/mark-short-answer',
      markRequest(item.id, 'It controls what goes in and out of the cell.', headers),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'marked',
      markedBy: 'ai',
      score: 1,
      maxScore: 1,
      awarded: [{ code: 'B1', by: 'ai', evidence: 'controls what goes in and out' }],
      feedback: 'Good: you described what the membrane does.',
      label: AI_LABEL,
    });
    expect(JSON.parse(rec.bodies[0]!)).toMatchObject({ model: 'claude-haiku-5-5' });
    const [usage] = await ctx.db.select().from(aiUsage);
    expect(usage).toMatchObject({ studentId: student.id, inputTokens: 412, outputTokens: 96 });
  });

  it('never puts the nickname or any profile field in the request sent to the provider', async () => {
    const { headers, item, rec, student } = await setUp();
    await ctx.app.request(
      '/v1/ai/mark-short-answer',
      markRequest(item.id, 'It controls what goes in and out of the cell.', headers),
    );
    expect(rec.bodies).toHaveLength(1);
    const body = rec.bodies[0]!.toLowerCase();
    for (const value of [
      student.nickname,
      student.id,
      student.familyId,
      student.avatarCode,
      AVATAR,
    ]) {
      expect(body).not.toContain(value.toLowerCase());
    }
    expect(body).not.toMatch(/year\s*10/);
    // Only the question, answer, topic and mark scheme are sent.
    const sent = JSON.parse(JSON.parse(rec.bodies[0]!).messages[0].content);
    expect(Object.keys(sent).sort()).toEqual(['answer', 'mark_points', 'question', 'topic']);
  });

  it('refuses an answer that contains the student nickname, without calling the provider', async () => {
    const { headers, item, rec } = await setUp();
    const res = await ctx.app.request(
      '/v1/ai/mark-short-answer',
      markRequest(item.id, 'pixel_fox thinks it keeps things inside', headers),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'personal_data_in_request',
    );
    expect(rec.bodies).toHaveLength(0);
  });

  it('refuses with a friendly error when the monthly cap is reached', async () => {
    const { headers, item, rec, student } = await setUp();
    await ctx.db.insert(aiUsage).values({
      studentId: student.id,
      job: 'short_answer_marking',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      inputTokens: 0,
      outputTokens: 0,
      costMicroUsd: 2_500_000,
      createdAt: ctx.clock.now(),
    });
    const res = await ctx.app.request(
      '/v1/ai/mark-short-answer',
      markRequest(item.id, 'It controls what goes in and out of the cell.', headers),
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('ai_limit_reached');
    expect(body.error.message).toMatch(/comes back on the 1st/);
    expect(rec.bodies).toHaveLength(0);
  });

  it('answers 404 for an unknown item and 400 for one that is not a short answer', async () => {
    const { headers } = await setUp();
    const missing = await ctx.app.request(
      '/v1/ai/mark-short-answer',
      markRequest(crypto.randomUUID(), 'x', headers),
    );
    expect(missing.status).toBe(404);
    const [flash] = await ctx.db
      .insert(items)
      .values({ topicId: 'test-cells', type: 'flashcard', body: {}, answer: {} })
      .returning();
    const wrong = await ctx.app.request(
      '/v1/ai/mark-short-answer',
      markRequest(flash!.id, 'x', headers),
    );
    expect(wrong.status).toBe(400);
  });

  it('rejects an answer longer than 2000 characters', async () => {
    const { headers, item } = await setUp();
    const res = await ctx.app.request(
      '/v1/ai/mark-short-answer',
      markRequest(item.id, 'a'.repeat(2001), headers),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/students/:id/ai-usage', () => {
  it("shows the parent this month's spend against the cap", async () => {
    ctx = await createTestContext();
    const parent = await ctx.signInParent();
    const created = await ctx.app.request(
      '/v1/students',
      jsonRequest(
        'POST',
        { nickname: 'test_kid', avatarCode: AVATAR, yearGroup: 10 },
        parent.headers,
      ),
    );
    const { id } = (await created.json()) as { id: string };
    await ctx.db.insert(aiUsage).values([
      {
        studentId: id,
        job: 'short_answer_marking',
        provider: 'anthropic',
        model: 'claude-haiku-5-5',
        inputTokens: 1,
        outputTokens: 1,
        costMicroUsd: 1200,
        createdAt: ctx.clock.now(),
      },
      {
        studentId: id,
        job: 'short_answer_marking',
        provider: 'anthropic',
        model: 'claude-haiku-5-5',
        inputTokens: 1,
        outputTokens: 1,
        costMicroUsd: 300,
        createdAt: ctx.clock.now(),
      },
      {
        studentId: id,
        job: 'short_answer_marking',
        provider: 'anthropic',
        model: 'claude-haiku-5-5',
        inputTokens: 1,
        outputTokens: 1,
        costMicroUsd: 999,
        createdAt: new Date('2026-10-01T00:00:00Z'),
      },
    ]);
    const res = await ctx.app.request(`/v1/students/${id}/ai-usage`, { headers: parent.headers });
    expect(await res.json()).toEqual({
      month: '2026-11',
      calls: 2,
      spentMicroUsd: 1500,
      capMicroUsd: 2_500_000,
    });

    const other = await ctx.signInParent();
    const hidden = await ctx.app.request(`/v1/students/${id}/ai-usage`, { headers: other.headers });
    expect(hidden.status).toBe(404);
  });
});
