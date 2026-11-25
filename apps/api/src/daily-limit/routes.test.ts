import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  LearnAttemptResponseSchema,
  ParentDailyLimitSchema,
  StudentDailyLimitSchema,
} from '@revisionden/core';
import { attempts, dailyXp, exams, items, streaks, students } from '@revisionden/db';
import { syncContent } from '../learning/content-sync';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';
import { testItems, testTopicTree } from '../test/learning-fixtures';

let ctx: TestContext;
afterEach(async () => ctx?.close());

const MIN = 60_000;
const DAY = 86_400_000;
// The test clock starts at Tuesday 2026-11-24 10:00 UTC (10:00 in London): a school day.
const NOW = Date.parse('2026-11-24T10:00:00Z');

async function setUp() {
  ctx = await createTestContext();
  await syncContent(ctx.db, { topicTrees: [testTopicTree], items: testItems });
  const family = await ctx.familyStudent('limit_kid');
  const [item] = await ctx.db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.contentId, 'test-mc-0001'));
  return { ...family, itemId: item!.id };
}

/** Answers a minute apart, ending just before now. */
async function studied(studentId: string, itemId: string, minutes: number, endsAt = NOW - MIN) {
  await ctx.db.insert(attempts).values(
    Array.from({ length: minutes + 1 }, (_, i) => ({
      studentId,
      itemId,
      correct: true,
      score: 1,
      mode: 'learn',
      xpEarned: 10,
      createdAt: new Date(endsAt - (minutes - i) * MIN),
    })),
  );
}

const studentView = async (headers: Record<string, string>) => {
  const res = await ctx.app.request('/v1/student/daily-limit', { headers });
  expect(res.status).toBe(200);
  return StudentDailyLimitSchema.parse(await res.json());
};

const parentView = async (studentId: string, headers: Record<string, string>) => {
  const res = await ctx.app.request(`/v1/students/${studentId}/daily-limit`, { headers });
  expect(res.status).toBe(200);
  return ParentDailyLimitSchema.parse(await res.json());
};

describe('the student sees their limit and minutes left', () => {
  it('uses the GCSE school-day default and counts active minutes today', async () => {
    const { studentId, headers, itemId } = await setUp();
    expect(await studentView(headers)).toEqual({
      limitMinutes: 60,
      usedMinutes: 0,
      leftMinutes: 60,
      reached: false,
      dayType: 'school',
      examSeason: false,
      changed: null,
    });
    await studied(studentId, itemId, 20);
    // Yesterday's study does not count today.
    await studied(studentId, itemId, 30, NOW - DAY);
    expect(await studentView(headers)).toMatchObject({ usedMinutes: 20, leftMinutes: 40 });
  });

  it('uses the A-Level default for a Year 12 student', async () => {
    const { studentId, headers } = await setUp();
    await ctx.db.update(students).set({ yearGroup: 12 }).where(eq(students.id, studentId));
    expect((await studentView(headers)).limitMinutes).toBe(90);
  });
});

describe('parents set the limit', () => {
  it('lets a parent change it, and tells the student once', async () => {
    const { studentId, parent, headers } = await setUp();
    expect(await parentView(studentId, parent.headers)).toMatchObject({
      settings: { schoolDayMinutes: 60, otherDayMinutes: 90, examSeasonExtra: false },
      custom: { school: false, other: false },
      defaults: { school: 60, other: 90 },
      ceilings: { school: 120, other: 180 },
      suggestion: null,
    });

    const res = await ctx.app.request(
      `/v1/students/${studentId}/daily-limit`,
      jsonRequest('PUT', { schoolDayMinutes: 45 }, parent.headers),
    );
    expect(res.status).toBe(200);
    expect(ParentDailyLimitSchema.parse(await res.json())).toMatchObject({
      settings: { schoolDayMinutes: 45, otherDayMinutes: 90 },
      custom: { school: true, other: false },
      today: { limitMinutes: 45 },
    });

    expect((await studentView(headers)).changed).toEqual({
      schoolDayMinutes: 45,
      otherDayMinutes: 90,
    });
    const seen = await ctx.app.request('/v1/student/daily-limit/seen', {
      method: 'POST',
      headers,
    });
    expect(seen.status).toBe(204);
    expect((await studentView(headers)).changed).toBeNull();

    // Back to the default.
    await ctx.app.request(
      `/v1/students/${studentId}/daily-limit`,
      jsonRequest('PUT', { schoolDayMinutes: null }, parent.headers),
    );
    expect((await parentView(studentId, parent.headers)).custom.school).toBe(false);
  });

  it('adds the exam-season extra only when the parent agrees', async () => {
    const { studentId, parent, headers } = await setUp();
    await ctx.db
      .insert(exams)
      .values({ studentId, kind: 'exam', subjectId: 'gcse-maths', date: '2026-12-20' });
    expect(await studentView(headers)).toMatchObject({ limitMinutes: 60, examSeason: true });
    await ctx.app.request(
      `/v1/students/${studentId}/daily-limit`,
      jsonRequest('PUT', { examSeasonExtra: true }, parent.headers),
    );
    expect((await studentView(headers)).limitMinutes).toBe(90);
  });

  it('refuses limits out of range and keeps other families out', async () => {
    const { studentId, parent, headers } = await setUp();
    const bad = await ctx.app.request(
      `/v1/students/${studentId}/daily-limit`,
      jsonRequest('PUT', { schoolDayMinutes: 5 }, parent.headers),
    );
    expect(bad.status).toBe(400);
    const other = await ctx.signInParent();
    for (const init of [
      { headers: other.headers },
      jsonRequest('PUT', { schoolDayMinutes: 30 }, other.headers),
    ]) {
      const res = await ctx.app.request(`/v1/students/${studentId}/daily-limit`, init);
      expect(res.status).toBe(404);
    }
    const fromDevice = await ctx.app.request(`/v1/students/${studentId}/daily-limit`, { headers });
    expect(fromDevice.status).toBe(401);
    expect((await ctx.app.request('/v1/student/daily-limit')).status).toBe(401);
  });
});

describe('at the limit', () => {
  it('gives no XP or streak credit for practice past the limit', async () => {
    const { studentId, headers, itemId } = await setUp();
    await studied(studentId, itemId, 60);
    const res = await ctx.app.request(
      '/v1/student/learn/attempts',
      jsonRequest('POST', { itemId, mode: 'learn', answer: 1, timeMs: 4000 }, headers),
    );
    expect(res.status).toBe(200);
    const answer = LearnAttemptResponseSchema.parse(await res.json());
    expect(answer.correct).toBe(true);
    expect(answer.xpEarned).toBe(0);
    expect(answer.progress.dailyLimit).toMatchObject({ reached: true, leftMinutes: 0 });
    const [xp] = await ctx.db.select().from(dailyXp).where(eq(dailyXp.studentId, studentId));
    expect(xp?.xp ?? 0).toBe(0);
    const [streak] = await ctx.db.select().from(streaks).where(eq(streaks.studentId, studentId));
    expect(streak).toBeUndefined();
  });

  it('still gives XP before the limit, and says how much is left', async () => {
    const { studentId, headers, itemId } = await setUp();
    await studied(studentId, itemId, 10);
    const res = await ctx.app.request(
      '/v1/student/learn/attempts',
      jsonRequest('POST', { itemId, mode: 'learn', answer: 1, timeMs: 4000 }, headers),
    );
    const answer = LearnAttemptResponseSchema.parse(await res.json());
    expect(answer.xpEarned).toBeGreaterThan(0);
    expect(answer.progress.dailyLimit).toMatchObject({ reached: false, leftMinutes: 49 });
  });
});

describe('weekly suggestions', () => {
  /** A short session on each of the last 14 days, so there were no rest days. */
  async function everyDay(studentId: string, itemId: string) {
    for (let d = 1; d <= 14; d++) await studied(studentId, itemId, 5, NOW - d * DAY);
  }

  it('suggests easing off when rest days are skipped; the parent accepts it', async () => {
    const { studentId, parent, headers, itemId } = await setUp();
    await everyDay(studentId, itemId);
    const view = await parentView(studentId, parent.headers);
    expect(view.suggestion).toEqual({
      kind: 'ease',
      change: -10,
      schoolDayMinutes: 50,
      otherDayMinutes: 80,
      reason: 'No rest days in the last two weeks.',
    });
    // The same suggestion stays until the parent acts on it.
    expect((await parentView(studentId, parent.headers)).suggestion?.kind).toBe('ease');

    const res = await ctx.app.request(
      `/v1/students/${studentId}/daily-limit/suggestion`,
      jsonRequest('POST', { action: 'accept' }, parent.headers),
    );
    expect(res.status).toBe(200);
    expect(ParentDailyLimitSchema.parse(await res.json())).toMatchObject({
      settings: { schoolDayMinutes: 50, otherDayMinutes: 80 },
      suggestion: null,
    });
    expect((await studentView(headers)).changed).toEqual({
      schoolDayMinutes: 50,
      otherDayMinutes: 80,
    });
    // At most one suggestion a week.
    expect((await parentView(studentId, parent.headers)).suggestion).toBeNull();
  });

  it('lets the parent dismiss a suggestion, which leaves the limit alone', async () => {
    const { studentId, parent, headers, itemId } = await setUp();
    await everyDay(studentId, itemId);
    await parentView(studentId, parent.headers);
    const res = await ctx.app.request(
      `/v1/students/${studentId}/daily-limit/suggestion`,
      jsonRequest('POST', { action: 'dismiss' }, parent.headers),
    );
    expect(ParentDailyLimitSchema.parse(await res.json())).toMatchObject({
      settings: { schoolDayMinutes: 60 },
      suggestion: null,
    });
    expect((await studentView(headers)).changed).toBeNull();
    const none = await ctx.app.request(
      `/v1/students/${studentId}/daily-limit/suggestion`,
      jsonRequest('POST', { action: 'accept' }, parent.headers),
    );
    expect(none.status).toBe(409);
  });
});

describe('two parents (docs/PRODUCT_RULES.md "Two parents")', () => {
  /** setUp, plus a second parent who joins the family by invite. */
  async function withSecondParent() {
    const family = await setUp();
    const invite = await ctx.app.request(
      '/v1/family/invites',
      jsonRequest('POST', {}, family.parent.headers),
    );
    const { code } = (await invite.json()) as { code: string };
    const second = await ctx.signInParent();
    const joined = await ctx.app.request(
      '/v1/family/join',
      jsonRequest('POST', { code }, second.headers),
    );
    expect(joined.status).toBe(200);
    return { ...family, second };
  }

  const limitEvents = async (headers: Record<string, string>) => {
    const res = await ctx.app.request('/v1/family/events', { headers });
    const { events } = (await res.json()) as { events: { kind: string; by: string }[] };
    return events.filter((e) => e.kind === 'limit_changed').map((e) => e.by);
  };

  it('lets either parent change the limit; the latest change wins and is logged', async () => {
    const { studentId, parent, second } = await withSecondParent();
    const put = (headers: Record<string, string>, minutes: number) =>
      ctx.app.request(
        `/v1/students/${studentId}/daily-limit`,
        jsonRequest('PUT', { schoolDayMinutes: minutes }, headers),
      );
    expect((await put(parent.headers, 50)).status).toBe(200);
    expect((await put(second.headers, 70)).status).toBe(200);
    expect((await parentView(studentId, parent.headers)).settings.schoolDayMinutes).toBe(70);
    expect(await limitEvents(parent.headers)).toEqual(['Parent 2', 'Parent 1']);
  });

  const answer = (studentId: string, action: string, headers: Record<string, string>) =>
    ctx.app.request(
      `/v1/students/${studentId}/daily-limit/suggestion`,
      jsonRequest('POST', { action }, headers),
    );

  it('logs a suggestion accepted by either parent as a limit change', async () => {
    const { studentId, parent, second, itemId } = await withSecondParent();
    for (let d = 1; d <= 14; d++) await studied(studentId, itemId, 5, NOW - d * DAY);
    expect((await parentView(studentId, second.headers)).suggestion?.kind).toBe('ease');
    expect((await answer(studentId, 'accept', second.headers)).status).toBe(200);
    expect((await parentView(studentId, parent.headers)).settings.schoolDayMinutes).toBe(50);
    expect(await limitEvents(parent.headers)).toEqual(['Parent 2']);
  });

  it('does not log a dismissed suggestion', async () => {
    const { studentId, parent, second, itemId } = await withSecondParent();
    for (let d = 1; d <= 14; d++) await studied(studentId, itemId, 5, NOW - d * DAY);
    await parentView(studentId, parent.headers);
    expect((await answer(studentId, 'dismiss', second.headers)).status).toBe(200);
    expect(await limitEvents(parent.headers)).toEqual([]);
  });
});

describe('flashcard sessions at the limit', () => {
  it('pays no session XP past the limit and keeps the reward slot', async () => {
    const { studentId, headers, itemId } = await setUp();
    await studied(studentId, itemId, 60);
    for (let i = 1; i <= 5; i++) {
      await ctx.app.request(
        '/v1/student/flashcards',
        jsonRequest('POST', { topicId: 'test-topic-b', front: `Card ${i}`, back: 'Back' }, headers),
      );
    }
    const started = await ctx.app.request('/v1/student/flashcards/sessions', {
      method: 'POST',
      headers,
    });
    const { id: sessionId } = (await started.json()) as { id: string };
    const overview = await ctx.app.request('/v1/student/flashcards', { headers });
    const { due } = (await overview.json()) as { due: { id: string }[] };
    expect(due.length).toBeGreaterThanOrEqual(5);
    for (const card of due) {
      await ctx.app.request(
        `/v1/student/flashcards/${card.id}/review`,
        jsonRequest('POST', { rating: 'good', sessionId }, headers),
      );
    }
    const res = await ctx.app.request(`/v1/student/flashcards/sessions/${sessionId}/finish`, {
      method: 'POST',
      headers,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      completed: true,
      xpEarned: 0,
      reason: 'daily_limit',
      rewardedLeftToday: 2,
    });
  });
});
