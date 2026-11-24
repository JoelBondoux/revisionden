import { afterEach, describe, expect, it } from 'vitest';
import {
  aiUsage,
  attempts,
  dailyXp,
  flashcards,
  items,
  reminderSettings,
  streaks,
  topics,
} from '@revisionden/db';
import { ParentDashboardSchema, StudentStatsSchema, topicMastery } from '@revisionden/core';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';

let ctx: TestContext;
afterEach(async () => ctx?.close());

const MIN = 60_000;
const DAY = 86_400_000;
// The test clock starts at Tuesday 2026-11-24 10:00 UTC (10:00 in London).
const NOW = Date.parse('2026-11-24T10:00:00Z');

/** Made-up topics and items; not educational content. */
async function seedContent(db: TestContext['db']) {
  await db.insert(topics).values([
    { id: 'stats-topic-a', subjectId: 'gcse-maths', board: 'test-board', title: 'Demo topic A' },
    { id: 'stats-topic-b', subjectId: 'gcse-maths', board: 'test-board', title: 'Demo topic B' },
    { id: 'stats-topic-c', subjectId: 'gcse-physics', board: 'test-board', title: 'Demo topic C' },
  ]);
  const rows = await db
    .insert(items)
    .values(
      ['stats-topic-a', 'stats-topic-b', 'stats-topic-c'].map((topicId) => ({
        topicId,
        type: 'multiple_choice',
        body: { prompt: 'Demo question' },
        answer: { key: { option: 0 } },
        status: 'verified',
      })),
    )
    .returning({ id: items.id, topicId: items.topicId });
  return Object.fromEntries(rows.map((r) => [r.topicId, r.id])) as Record<string, string>;
}

async function seedStudy(ctx: TestContext, studentId: string) {
  const item = await seedContent(ctx.db);
  const answer = (topicId: string, at: number, score: number | null, extra = {}) => ({
    studentId,
    itemId: item[topicId]!,
    correct: score === 1,
    score,
    mode: 'learn',
    xpEarned: score === 1 ? 10 : 0,
    createdAt: new Date(at),
    ...extra,
  });
  // This week (Monday 23 Nov): a session at 16:00 with answers 2 minutes apart, one part
  // mark and one unmarked answer, then a gap of 30 minutes and two more answers.
  const monday = Date.parse('2026-11-23T16:00:00Z');
  await ctx.db.insert(attempts).values([
    answer('stats-topic-a', monday, 1),
    answer('stats-topic-a', monday + 2 * MIN, 1),
    answer('stats-topic-a', monday + 4 * MIN, 0.5),
    answer('stats-topic-b', monday + 6 * MIN, null),
    answer('stats-topic-b', monday + 36 * MIN, 0),
    answer('stats-topic-c', monday + 37 * MIN, 1),
    // Last week (Tuesday 17 Nov), one short session at 22:00 (quiet hours).
    answer('stats-topic-a', Date.parse('2026-11-17T22:00:00Z'), 1),
    answer('stats-topic-a', Date.parse('2026-11-17T22:03:00Z'), 1),
    // Five weeks ago.
    answer('stats-topic-b', NOW - 35 * DAY, 1),
  ]);
  await ctx.db.insert(dailyXp).values([
    { studentId, day: '2026-11-17', xp: 20 },
    { studentId, day: '2026-11-23', xp: 35 },
    { studentId, day: '2026-11-24', xp: 5 },
  ]);
  await ctx.db.insert(streaks).values({ studentId, current: 2, best: 6, lastDate: '2026-11-23' });
  await ctx.db.insert(flashcards).values({
    studentId,
    topicId: 'stats-topic-a',
    origin: 'own',
    front: 'Own card front',
    back: 'Own card back',
    lastReviewedAt: new Date(Date.parse('2026-11-24T07:00:00Z')),
  });
}

describe('GET /v1/student/stats', () => {
  it('gives the student their own week with XP per day, accuracy and personal bests', async () => {
    ctx = await createTestContext();
    const { studentId, headers } = await ctx.familyStudent('stats_kid');
    await seedStudy(ctx, studentId);

    const res = await ctx.app.request('/v1/student/stats?period=week', { headers });
    expect(res.status).toBe(200);
    const body = StudentStatsSchema.parse(await res.json());
    expect(body.range).toMatchObject({ start: '2026-11-23', end: '2026-11-30' });
    expect(body.chart.buckets.map((b) => b.value)).toEqual([35, 5, 0, 0, 0, 0, 0]);
    expect(body.chart.goal).toBe(50);
    expect(body.tiles.xp).toEqual({ value: 40, previous: 20 });
    // 6 answered, 5 marked: (1 + 1 + 0.5 + 0 + 1) / 5 = 70%.
    expect(body.tiles.answered).toEqual({ value: 6, correct: 3, previous: 2 });
    expect(body.tiles.accuracy).toEqual({ value: 70, previous: 100 });
    expect(body.tiles.streak).toEqual({ current: 2 });
    expect(body.personalBests).toEqual({
      longestStreak: 6,
      longestCorrectRun: 5,
      bestWeek: { weekStart: '2026-11-23', xp: 40 },
    });
    expect(body.mastery.map((m) => [m.subjectId, m.name])).toEqual([
      ['gcse-maths', 'Maths'],
      ['gcse-physics', 'Physics'],
    ]);
    expect(body.level).toMatchObject({ level: 1, xpIntoLevel: 40 });
  });

  it('uses the weekly goal for the term and no goal for the year', async () => {
    ctx = await createTestContext();
    const { headers } = await ctx.familyStudent('stats_kid');
    const term = StudentStatsSchema.parse(
      await (await ctx.app.request('/v1/student/stats?period=term', { headers })).json(),
    );
    expect(term.chart.goal).toBe(250);
    expect(term.tiles.accuracy.value).toBeNull();
    const year = StudentStatsSchema.parse(
      await (await ctx.app.request('/v1/student/stats?period=year', { headers })).json(),
    );
    expect(year.chart.goal).toBeNull();
    expect(year.chart.buckets).toHaveLength(12);
  });

  it('rejects an unknown period and needs a student session', async () => {
    ctx = await createTestContext();
    const { headers } = await ctx.familyStudent('stats_kid');
    expect((await ctx.app.request('/v1/student/stats?period=decade', { headers })).status).toBe(
      400,
    );
    expect((await ctx.app.request('/v1/student/stats')).status).toBe(401);
  });
});

describe('GET /v1/students/:id/stats and /dashboard (parent)', () => {
  it('lets a parent read their own child', async () => {
    ctx = await createTestContext();
    const { studentId, parent } = await ctx.familyStudent('stats_kid');
    await seedStudy(ctx, studentId);
    const res = await ctx.app.request(`/v1/students/${studentId}/stats?period=week`, {
      headers: parent.headers,
    });
    expect(res.status).toBe(200);
    expect(StudentStatsSchema.parse(await res.json()).tiles.xp.value).toBe(40);
  });

  it('builds the parent dashboard for this week', async () => {
    ctx = await createTestContext();
    const { studentId, parent } = await ctx.familyStudent('stats_kid');
    await seedStudy(ctx, studentId);
    await ctx.db.insert(aiUsage).values({
      studentId,
      job: 'short_answer_marking',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      inputTokens: 1,
      outputTokens: 1,
      costMicroUsd: 4200,
      createdAt: new Date(NOW),
    });

    const res = await ctx.app.request(`/v1/students/${studentId}/dashboard`, {
      headers: parent.headers,
    });
    expect(res.status).toBe(200);
    const body = ParentDashboardSchema.parse(await res.json());
    expect(body.student).toEqual({ id: studentId, nickname: 'stats_kid' });
    expect(body.timeZone).toBe('Europe/London');
    // This week: 2 + 2 + 2 minutes, then (after the 30-minute gap) 1 minute = 7 minutes.
    // Last week: 3 minutes.
    expect(body.tiles.activeMinutes).toEqual({ value: 7, previous: 3 });
    expect(body.tiles.planKept).toBeNull();
    expect(body.tiles.accuracy).toEqual({ value: 70, previous: 100 });
    expect(body.tiles.streak).toEqual({ current: 2, best: 6 });
    expect(body.studyTime.weeks).toHaveLength(8);
    expect(body.studyTime.weeks.at(-1)).toMatchObject({ start: '2026-11-23', value: 7 });
    expect(body.studyTime.weeks.at(-2)).toMatchObject({ start: '2026-11-16', value: 3 });
    expect(body.studyTime.planMinutes).toBeNull();
    expect(body.subjects.map((s) => s.subjectId)).toEqual(['gcse-maths', 'gcse-physics']);
    expect(body.subjects[0]).toMatchObject({ predictedGrade: null, targetGrade: null });
    expect(body.weakSpots).toHaveLength(3);
    expect(body.weakSpots[0]!.title).toMatch(/^Demo topic/);
    const topicC = topicMastery([{ score: 1, at: Date.parse('2026-11-23T16:37:00Z') }], NOW);
    expect(body.weakSpots.find((w) => w.topicId === 'stats-topic-c')).toMatchObject({
      then: 0,
      now: topicC,
    });
    expect(body.effortScores).toBeNull();
    expect(body.rewards).toEqual([]);
    // Monday 16:00 is outside quiet hours; rest days so far this week: none (Monday studied).
    expect(body.healthyHabits).toEqual({
      quietHourSessions: 0,
      daysOverCap: 0,
      restDays: 0,
      dailyCapMinutes: 120,
    });
    expect(body.aiSpend).toEqual({ month: '2026-11', spentMicroUsd: 4200, capMicroUsd: 2_500_000 });
    expect(body.recentActivity[0]).toMatchObject({ kind: 'flashcards', count: 1 });
    expect(body.recentActivity[1]).toMatchObject({ kind: 'lesson', subjectId: 'gcse-physics' });
    expect(JSON.stringify(body)).not.toContain('Own card');
  });

  it('counts quiet-hour sessions in the family time zone', async () => {
    ctx = await createTestContext();
    const { studentId, parent } = await ctx.familyStudent('stats_kid');
    const item = await seedContent(ctx.db);
    // Tuesday 24 Nov, 09:00 UTC: school hours in London.
    await ctx.db.insert(attempts).values(
      [0, 1].map((i) => ({
        studentId,
        itemId: item['stats-topic-a']!,
        correct: true,
        score: 1,
        mode: 'learn',
        createdAt: new Date(Date.parse('2026-11-24T09:00:00Z') + i * MIN),
      })),
    );
    const dashboard = async () =>
      ParentDashboardSchema.parse(
        await (
          await ctx.app.request(`/v1/students/${studentId}/dashboard`, { headers: parent.headers })
        ).json(),
      );
    expect((await dashboard()).healthyHabits.quietHourSessions).toBe(1);
    expect((await dashboard()).healthyHabits.restDays).toBe(1);
    // In a time zone where 09:00 UTC is the evening, it is not quiet time.
    await ctx.db
      .insert(reminderSettings)
      .values({ studentId, timeZone: 'Asia/Tokyo', quietStart: '23:00', quietEnd: '06:00' });
    const tokyo = await dashboard();
    expect(tokyo.timeZone).toBe('Asia/Tokyo');
    expect(tokyo.healthyHabits.quietHourSessions).toBe(0);
  });

  it("never lets a parent read another family's child", async () => {
    ctx = await createTestContext();
    const { studentId } = await ctx.familyStudent('stats_kid');
    const other = await ctx.signInParent();
    for (const path of [`/v1/students/${studentId}/stats`, `/v1/students/${studentId}/dashboard`]) {
      expect((await ctx.app.request(path, { headers: other.headers })).status).toBe(404);
      expect((await ctx.app.request(path)).status).toBe(401);
    }
  });

  it('does not let a student device use the parent dashboard', async () => {
    ctx = await createTestContext();
    const { studentId, headers } = await ctx.familyStudent('stats_kid');
    const res = await ctx.app.request(`/v1/students/${studentId}/dashboard`, { headers });
    expect(res.status).toBe(401);
  });
});

describe('panels from the rewards progression (workstream R)', () => {
  it("shows the parent's rewards on the dashboard and the level in My stats", async () => {
    ctx = await createTestContext();
    const { studentId, parent, headers } = await ctx.familyStudent('stats_kid');
    await seedStudy(ctx, studentId);
    const created = await ctx.app.request(
      `/v1/students/${studentId}/parent-rewards`,
      jsonRequest(
        'POST',
        {
          title: 'Cinema trip',
          note: 'You pick the film',
          target: { kind: 'date', on: '2027-01-01' },
        },
        parent.headers,
      ),
    );
    expect(created.status).toBe(201);

    const dashboard = ParentDashboardSchema.parse(
      await (
        await ctx.app.request(`/v1/students/${studentId}/dashboard`, { headers: parent.headers })
      ).json(),
    );
    expect(dashboard.rewards).toHaveLength(1);
    expect(dashboard.rewards[0]).toMatchObject({
      title: 'Cinema trip',
      reached: false,
      given: false,
    });
    expect(JSON.stringify(dashboard)).not.toContain('You pick the film');

    const stats = StudentStatsSchema.parse(
      await (await ctx.app.request('/v1/student/stats', { headers })).json(),
    );
    expect(stats.level).toMatchObject({ level: 1 });
    expect(stats.level!.xpForNextLevel).toBeGreaterThan(0);
  });
});
