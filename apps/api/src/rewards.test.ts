import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  CHAPTER_STEP_XP,
  ParentRewardSchema,
  StudentRewardsResponseSchema,
  encodeAvatar,
  DEFAULT_AVATAR,
  AVATAR_CATALOGUE,
} from '@revisionden/core';
import { attempts, items, rewards, streaks, topics } from '@revisionden/db';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;
let itemId: string;

beforeAll(async () => {
  t = await createTestContext();
  await t.db
    .insert(topics)
    .values({ id: 'r-topic', subjectId: 'gcse-maths', board: 'aqa', title: 'T' });
  const [item] = await t.db
    .insert(items)
    .values({ topicId: 'r-topic', type: 'multiple_choice', body: {}, answer: {} })
    .returning();
  itemId = item!.id;
});

afterAll(async () => {
  await t.close();
});

/** Records answers at the given times (UTC), each with the given XP. */
async function answers(studentId: string, times: string[], xp = 10, correct = true) {
  await t.db
    .insert(attempts)
    .values(
      times.map((at) => ({ studentId, itemId, correct, xpEarned: xp, createdAt: new Date(at) })),
    );
}

async function studentRewards(headers: Record<string, string>) {
  const res = await t.app.request('/v1/student/rewards', { headers });
  expect(res.status).toBe(200);
  return StudentRewardsResponseSchema.parse(await res.json());
}

describe('student rewards screen', () => {
  it('needs a signed-in student device', async () => {
    expect((await t.app.request('/v1/student/rewards')).status).toBe(401);
  });

  it("starts at level 1 in the chapter for the student's year", async () => {
    const { headers } = await t.familyStudent('r_new_kid');
    const view = await studentRewards(headers);
    expect(view.overview.level).toMatchObject({ level: 1, prestigeStars: 0, totalXp: 0 });
    expect(view.overview.chapter).toMatchObject({ number: 3, name: 'Exam Year', earned: 0 });
    expect(view.overview.nextMilestones).toHaveLength(3);
    expect(view.overview.collections.length).toBeGreaterThanOrEqual(6);
    expect(view.overview.seasons.map((s) => s.id)).toEqual(['autumn-2-2026']);
    expect(view.newlyEarned).toEqual([]);
  });

  it('earns level, chapter, milestone and seasonal rewards from answers, once', async () => {
    const { studentId, headers } = await t.familyStudent('r_busy_kid');
    // 30 days of 30 XP in this school year (chapter 3), all in daytime, all this term.
    const days = Array.from(
      { length: 21 },
      (_, i) => `2026-11-${String(i + 3).padStart(2, '0')}T12:00:00Z`,
    );
    await answers(studentId, days, 30);
    await answers(studentId, Array(80).fill('2026-11-23T15:00:00Z'), 0);

    const first = await studentRewards(headers);
    const ids = first.newlyEarned.map((r) => r.id);
    expect(first.overview.level.totalXp).toBe(630);
    expect(ids).toEqual(
      expect.arrayContaining([
        'level-2',
        'chapter-3-1',
        'correct-100',
        'autumn-2-2026-1',
        'autumn-2-2026-2',
      ]),
    );
    expect(first.overview.chapter!.next).toMatchObject({
      id: 'chapter-3-2',
      current: 630 - CHAPTER_STEP_XP,
    });

    const again = await studentRewards(headers);
    expect(again.newlyEarned).toEqual([]);
    const stored = await t.db.select().from(rewards).where(eq(rewards.studentId, studentId));
    expect(stored.map((r) => r.rewardId).sort()).toEqual([...ids].sort());
  });

  it('gives no reward progress for late-night answers', async () => {
    const { headers, studentId } = await t.familyStudent('r_owl_kid');
    await answers(studentId, ['2026-11-20T23:30:00Z', '2026-11-21T02:00:00Z'], 400);
    const view = await studentRewards(headers);
    expect(view.overview.level.totalXp).toBe(0);
    expect(view.newlyEarned.map((r) => r.id)).not.toContain('level-2');
  });

  it('credits gift days that come with streak rewards, once', async () => {
    const { headers, studentId } = await t.familyStudent('r_streak_kid');
    await t.db.insert(streaks).values({ studentId, current: 8, best: 8 });
    const view = await studentRewards(headers);
    expect(view.newlyEarned.map((r) => r.id)).toContain('streak-7');
    await studentRewards(headers);
    const [row] = await t.db.select().from(streaks).where(eq(streaks.studentId, studentId));
    expect(row!.giftDays).toBe(1);
  });

  it('lets an earned avatar item be saved, and not before', async () => {
    const { headers, studentId, parent } = await t.familyStudent('r_avatar_kid');
    const hat = AVATAR_CATALOGUE.headwear.findIndex((i) => i.id === 'bobble-hat');
    const code = encodeAvatar({ ...DEFAULT_AVATAR, headwear: hat });
    const put = () =>
      t.app.request(
        `/v1/students/${studentId}/avatar`,
        jsonRequest('PUT', { avatarCode: code }, parent.headers),
      );
    expect((await put()).status).toBe(400);
    await answers(studentId, Array(50).fill('2026-11-10T12:00:00Z'), 0);
    await studentRewards(headers);
    expect((await put()).status).toBe(200);
  });
});

describe('parent-set rewards', () => {
  async function addReward(headers: Record<string, string>, studentId: string, body: unknown) {
    return t.app.request(
      `/v1/students/${studentId}/parent-rewards`,
      jsonRequest('POST', body, headers),
    );
  }

  it('needs the parent of the student', async () => {
    const { studentId } = await t.familyStudent('r_parent_kid_a');
    const other = await t.signInParent();
    const res = await addReward(other.headers, studentId, {
      title: 'Cinema trip',
      target: { kind: 'reward', rewardId: 'streak-100' },
    });
    expect(res.status).toBe(404);
    expect(
      (await t.app.request(`/v1/students/${studentId}/parent-rewards`, { method: 'POST' })).status,
    ).toBe(401);
  });

  it('adds a real-world reward tied to any target and shows it on both screens', async () => {
    const { studentId, parent, headers } = await t.familyStudent('r_parent_kid_b');
    const res = await addReward(parent.headers, studentId, {
      title: 'Cinema trip',
      target: { kind: 'reward', rewardId: 'streak-100' },
    });
    expect(res.status).toBe(201);
    const created = ParentRewardSchema.parse(await res.json());
    expect(created).toMatchObject({
      title: 'Cinema trip',
      targetLabel: '100-day streak',
      reached: false,
      givenAt: null,
    });
    await addReward(parent.headers, studentId, {
      title: 'New game',
      target: { kind: 'stat', stat: 'level', atLeast: 1 },
    });

    const parentView = await t.app.request(`/v1/students/${studentId}/rewards`, {
      headers: parent.headers,
    });
    expect(parentView.status).toBe(200);
    const body = StudentRewardsResponseSchema.parse(await parentView.json());
    expect(body.parentRewards.map((r) => [r.title, r.reached])).toEqual([
      ['Cinema trip', false],
      ['New game', true],
    ]);
    const studentView = await studentRewards(headers);
    expect(studentView.parentRewards).toHaveLength(2);
  });

  it('rejects bad targets', async () => {
    const { studentId, parent } = await t.familyStudent('r_parent_kid_c');
    const res = await addReward(parent.headers, studentId, {
      title: 'x',
      target: { kind: 'stat', stat: 'minutesSpent', atLeast: 10 },
    });
    expect(res.status).toBe(400);
  });

  it('is marked as given by the parent and then kept', async () => {
    const { studentId, parent, headers } = await t.familyStudent('r_parent_kid_d');
    const created = ParentRewardSchema.parse(
      await (
        await addReward(parent.headers, studentId, {
          title: 'Pizza night',
          target: { kind: 'stat', stat: 'level', atLeast: 1 },
        })
      ).json(),
    );
    const given = await t.app.request(
      `/v1/students/${studentId}/parent-rewards/${created.id}/given`,
      { method: 'POST', headers: parent.headers },
    );
    expect(given.status).toBe(200);
    expect(ParentRewardSchema.parse(await given.json()).givenAt).toBe(t.clock.now().toISOString());
    expect((await studentRewards(headers)).parentRewards[0]!.givenAt).not.toBeNull();

    // Once given it is history: it stays on the student's screen and cannot be removed.
    const del = await t.app.request(`/v1/students/${studentId}/parent-rewards/${created.id}`, {
      method: 'DELETE',
      headers: parent.headers,
    });
    expect(del.status).toBe(409);
    expect((await studentRewards(headers)).parentRewards).toHaveLength(1);
  });

  it('keeps a note and supports a custom date target', async () => {
    const { studentId, parent } = await t.familyStudent('r_parent_kid_f');
    const res = await addReward(parent.headers, studentId, {
      title: 'Day out',
      note: 'You pick where',
      target: { kind: 'date', on: '2026-11-24' },
    });
    expect(res.status).toBe(201);
    expect(ParentRewardSchema.parse(await res.json())).toMatchObject({
      note: 'You pick where',
      targetLabel: 'On 24 November 2026',
      reached: true,
    });
  });

  it('can be edited until it is given, then is kept as history', async () => {
    const { studentId, parent } = await t.familyStudent('r_parent_kid_g');
    const created = ParentRewardSchema.parse(
      await (
        await addReward(parent.headers, studentId, {
          title: 'Pizza',
          target: { kind: 'stat', stat: 'level', atLeast: 5 },
        })
      ).json(),
    );
    const url = `/v1/students/${studentId}/parent-rewards/${created.id}`;
    const edit = await t.app.request(
      url,
      jsonRequest(
        'PATCH',
        {
          title: 'Pizza night',
          note: 'Any toppings',
          target: { kind: 'stat', stat: 'level', atLeast: 1 },
        },
        parent.headers,
      ),
    );
    expect(edit.status).toBe(200);
    expect(ParentRewardSchema.parse(await edit.json())).toMatchObject({
      title: 'Pizza night',
      note: 'Any toppings',
      targetLabel: 'Level 1',
      reached: true,
    });
    const clear = await t.app.request(url, jsonRequest('PATCH', { note: null }, parent.headers));
    expect(ParentRewardSchema.parse(await clear.json()).note).toBeNull();

    await t.app.request(`${url}/given`, { method: 'POST', headers: parent.headers });
    const late = await t.app.request(
      url,
      jsonRequest('PATCH', { title: 'Changed' }, parent.headers),
    );
    expect(late.status).toBe(409);
    const del = await t.app.request(url, { method: 'DELETE', headers: parent.headers });
    expect(del.status).toBe(409);
    const again = await t.app.request(`${url}/given`, { method: 'POST', headers: parent.headers });
    expect(again.status).toBe(200);
  });

  it('rejects an empty edit and an edit of a missing reward', async () => {
    const { studentId, parent } = await t.familyStudent('r_parent_kid_h');
    const created = ParentRewardSchema.parse(
      await (
        await addReward(parent.headers, studentId, {
          title: 'Pizza',
          target: { kind: 'reward', rewardId: 'streak-7' },
        })
      ).json(),
    );
    const base = `/v1/students/${studentId}/parent-rewards`;
    expect(
      (await t.app.request(`${base}/${created.id}`, jsonRequest('PATCH', {}, parent.headers)))
        .status,
    ).toBe(400);
    expect(
      (
        await t.app.request(
          `${base}/00000000-0000-4000-8000-000000000000`,
          jsonRequest('PATCH', { title: 'x' }, parent.headers),
        )
      ).status,
    ).toBe(404);
    const del = await t.app.request(`${base}/${created.id}`, {
      method: 'DELETE',
      headers: parent.headers,
    });
    expect(del.status).toBe(204);
  });

  it("answers 404 for a reward that is not this student's", async () => {
    const { studentId, parent } = await t.familyStudent('r_parent_kid_e');
    for (const id of ['not-a-uuid', '00000000-0000-4000-8000-000000000000']) {
      const res = await t.app.request(`/v1/students/${studentId}/parent-rewards/${id}/given`, {
        method: 'POST',
        headers: parent.headers,
      });
      expect(res.status).toBe(404);
      const del = await t.app.request(`/v1/students/${studentId}/parent-rewards/${id}`, {
        method: 'DELETE',
        headers: parent.headers,
      });
      expect(del.status).toBe(404);
    }
  });
});
