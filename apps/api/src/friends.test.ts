import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import {
  attempts,
  familyEvents,
  friendCodeTries,
  friendCodes,
  friendReports,
  friendRequests,
  friendships,
  items,
  leagueWeeks,
  students,
  topics,
} from '@revisionden/db';
import {
  FriendCodeResponseSchema,
  LeagueResponseSchema,
  ParentFriendsResponseSchema,
  RedeemFriendCodeResponseSchema,
  StudentFriendsResponseSchema,
  localDate,
  previousLeagueWeeks,
} from '@revisionden/core';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { approveRequest, deleteExpiredFriendRecords, finaliseRequest } from './routes/friends';

type H = Record<string, string>;
let t: TestContext;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

beforeAll(async () => {
  t = await createTestContext({ config: { friendsEnabled: true } });
});

afterAll(async () => {
  await t.close();
});

const send = (method: string, path: string, headers: H, body: unknown = {}) =>
  t.app.request(path, jsonRequest(method, body, headers));
const get = (path: string, headers: H) => t.app.request(path, { headers });

interface Kid {
  studentId: string;
  parent: { headers: H };
  headers: H;
  nickname: string;
}

let kidCount = 0;
/** A child in their own family, with friends turned on by their parent (unless `off`). */
async function kid(name?: string, { off = false } = {}): Promise<Kid> {
  kidCount += 1;
  const nickname = name ?? `Kid_${kidCount}`;
  const k = await t.familyStudent(nickname);
  if (!off) await allow(k, true);
  return { ...k, nickname };
}

async function allow(k: { studentId: string; parent: { headers: H } }, allowed: boolean) {
  const res = await send('PUT', `/v1/students/${k.studentId}/friends/allowed`, k.parent.headers, {
    allowed,
  });
  expect(res.status).toBe(200);
}

async function makeCode(k: Kid) {
  const res = await send('POST', '/v1/student/friends/codes', k.headers);
  expect(res.status).toBe(201);
  return (await res.json()) as { code: string; expiresAt: string };
}

async function redeem(k: Kid, code: string) {
  return send('POST', '/v1/student/friends/redeem', k.headers, { code });
}

/** A makes a code, B enters it and confirms: waiting for both families' parents. */
async function request(a: Kid, b: Kid) {
  const { code } = await makeCode(a);
  const res = await redeem(b, code);
  expect(res.status).toBe(201);
  const { requestId } = (await res.json()) as { requestId: string };
  expect(
    (await send('POST', `/v1/student/friends/requests/${requestId}/confirm`, b.headers)).status,
  ).toBe(200);
  return requestId;
}

async function approve(k: Kid, requestId: string) {
  return send(
    'POST',
    `/v1/students/${k.studentId}/friends/requests/${requestId}/approve`,
    k.parent.headers,
  );
}

async function befriend(a: Kid, b: Kid) {
  const id = await request(a, b);
  expect((await approve(a, id)).status).toBe(200);
  expect((await approve(b, id)).status).toBe(200);
}

async function friendsOf(k: Kid) {
  const res = await get('/v1/student/friends', k.headers);
  expect(res.status).toBe(200);
  return (await res.json()) as {
    allowed: boolean;
    hidden: boolean;
    friends: {
      id: string;
      nickname: string;
      avatarCode: string;
      title: string | null;
      sibling: boolean;
    }[];
    waiting: { requestId: string; nickname: string; status: string }[];
  };
}

async function parentView(k: Kid) {
  const res = await get(`/v1/students/${k.studentId}/friends`, k.parent.headers);
  expect(res.status).toBe(200);
  return (await res.json()) as {
    allowed: boolean;
    friends: { id: string; nickname: string; label: string | null; sibling: boolean }[];
    waitingForYou: { requestId: string; nickname: string }[];
    waitingForOther: { requestId: string; nickname: string }[];
    blocked: { id: string; nickname: string }[];
    reports: { direction: 'made' | 'about'; reason: string; reporter: string; reported: string }[];
  };
}

describe('turning friends on', () => {
  it('is off by default, and then a child sees nothing and cannot make a code', async () => {
    const k = await kid(undefined, { off: true });
    expect(await friendsOf(k)).toMatchObject({ allowed: false, friends: [], waiting: [] });
    const res = await send('POST', '/v1/student/friends/codes', k.headers);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('friends_off');
  });

  it('is a parent setting, logged in the family activity log', async () => {
    const k = await kid(undefined, { off: true });
    await allow(k, true);
    expect((await friendsOf(k)).allowed).toBe(true);
    const rows = await t.db
      .select()
      .from(familyEvents)
      .where(eq(familyEvents.studentId, k.studentId));
    expect(rows.map((r) => r.kind)).toContain('friends_allowed');
  });

  it("only works for the parent's own child", async () => {
    const k = await kid();
    const other = await t.signInParent();
    const res = await send('PUT', `/v1/students/${k.studentId}/friends/allowed`, other.headers, {
      allowed: false,
    });
    expect(res.status).toBe(404);
  });
});

describe('friend codes', () => {
  it('are 8 characters, last 48 hours and are stored only as a hash', async () => {
    const k = await kid();
    const { code, expiresAt } = await makeCode(k);
    expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
    expect(new Date(expiresAt).getTime() - t.clock.now().getTime()).toBe(48 * HOUR);
    const rows = await t.db
      .select()
      .from(friendCodes)
      .where(eq(friendCodes.studentId, k.studentId));
    expect(JSON.stringify(rows)).not.toContain(code.replace('-', ''));
  });

  it('can be made 3 times a day', async () => {
    const k = await kid();
    for (let i = 0; i < 3; i++) await makeCode(k);
    const res = await send('POST', '/v1/student/friends/codes', k.headers);
    expect(res.status).toBe(429);
  });
});

describe('adding a friend from another family', () => {
  it('shows the other child and waits for the child, then both families', async () => {
    const a = await kid('Nova_7');
    const b = await kid('Quill_2');
    const { code } = await makeCode(a);
    const res = await redeem(b, code.toLowerCase());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { requestId: string; friend: Record<string, unknown> };
    expect(body.friend).toEqual({
      nickname: 'Nova_7',
      avatarCode: expect.any(String),
      title: null,
    });

    await send('POST', `/v1/student/friends/requests/${body.requestId}/confirm`, b.headers);
    expect((await friendsOf(a)).waiting).toEqual([
      {
        requestId: body.requestId,
        nickname: 'Quill_2',
        avatarCode: expect.any(String),
        status: 'parents',
      },
    ]);
    expect((await parentView(a)).waitingForYou.map((w) => w.nickname)).toEqual(['Quill_2']);
    expect((await parentView(b)).waitingForYou.map((w) => w.nickname)).toEqual(['Nova_7']);

    expect((await approve(a, body.requestId)).status).toBe(200);
    expect((await friendsOf(a)).friends).toEqual([]);
    expect((await parentView(a)).waitingForOther.map((w) => w.nickname)).toEqual(['Quill_2']);

    expect((await approve(b, body.requestId)).status).toBe(200);
    expect((await friendsOf(a)).friends).toEqual([
      {
        id: b.studentId,
        nickname: 'Quill_2',
        avatarCode: expect.any(String),
        title: null,
        sibling: false,
      },
    ]);
    expect((await friendsOf(b)).friends.map((f) => f.nickname)).toEqual(['Nova_7']);
  });

  it('shows friends nothing but nickname, avatar and title', async () => {
    const a = await kid();
    const b = await kid();
    await befriend(a, b);
    const res = await get('/v1/student/friends', a.headers);
    const text = await res.text();
    for (const hidden of ['yearGroup', 'familyId', 'year_group', 'streak', 'createdAt']) {
      expect(text).not.toContain(hidden);
    }
  });

  it('a parent can decline, and the children only hear it did not go ahead', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    const res = await send(
      'POST',
      `/v1/students/${b.studentId}/friends/requests/${id}/decline`,
      b.parent.headers,
    );
    expect(res.status).toBe(200);
    expect((await friendsOf(a)).waiting).toEqual([
      expect.objectContaining({ requestId: id, status: 'not_going_ahead' }),
    ]);
    expect((await approve(a, id)).status).toBe(409);
  });

  it('runs out after 7 days without both approvals', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    await approve(a, id);
    t.clock.advance(7 * DAY + 1);
    expect((await approve(b, id)).status).toBe(409);
    // Student sessions last 12 hours: sign in again after a week.
    a.headers = await t.signInStudent(a.studentId);
    expect((await friendsOf(a)).friends).toEqual([]);
  });

  it('gives the same answer for a wrong, used, expired or own code', async () => {
    const a = await kid();
    const b = await kid();
    const c = await kid();
    const { code } = await makeCode(a);
    expect((await redeem(b, code)).status).toBe(201);
    const used = await redeem(c, code);
    const wrong = await redeem(c, 'ABCD-EFGH');
    const own = await redeem(a, (await makeCode(a)).code);
    const expiring = await makeCode(a);
    t.clock.advance(48 * HOUR + 1);
    c.headers = await t.signInStudent(c.studentId);
    const expired = await redeem(c, expiring.code);
    for (const res of [used, wrong, own, expired]) {
      expect(res.status).toBe(404);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('code_not_valid');
    }
  });

  it('stops after 5 wrong codes in an hour', async () => {
    const b = await kid();
    for (let i = 0; i < 5; i++) expect((await redeem(b, 'WXYZ-2345')).status).toBe(404);
    const a = await kid();
    const { code } = await makeCode(a);
    expect((await redeem(b, code)).status).toBe(429);
    t.clock.advance(HOUR + 1);
    expect((await redeem(b, code)).status).toBe(201);
  });

  it('needs friends turned on for the child who made the code too', async () => {
    const a = await kid();
    const b = await kid();
    const { code } = await makeCode(a);
    await allow(a, false);
    expect((await redeem(b, code)).status).toBe(404);
  });

  it('cannot go over 10 friends', async () => {
    const a = await kid();
    for (let i = 0; i < 10; i++) await befriend(await kid(), a);
    const extra = await kid();
    const { code } = await makeCode(extra);
    expect((await redeem(a, code)).status).toBe(404);
  });
});

describe('brothers and sisters', () => {
  it("are in each other's league automatically once friends is on for both", async () => {
    const first = await kid('Comet_1');
    const [row] = await t.db.select().from(students).where(eq(students.id, first.studentId));
    const res = await send('POST', '/v1/students', first.parent.headers, {
      nickname: 'Comet_2',
      avatarCode: row!.avatarCode,
      yearGroup: 12,
    });
    const siblingId = ((await res.json()) as { id: string }).id;
    const sibling = { studentId: siblingId, parent: first.parent };
    expect((await friendsOf(first)).friends).toEqual([]);
    await allow(sibling, true);
    expect((await friendsOf(first)).friends).toEqual([
      expect.objectContaining({ id: siblingId, nickname: 'Comet_2', sibling: true }),
    ]);
    // A sibling cannot be removed, blocked or reported as a friend.
    const paths = [
      ['DELETE', `/v1/student/friends/${siblingId}`],
      ['POST', `/v1/student/friends/${siblingId}/block`],
      ['POST', `/v1/student/friends/${siblingId}/report`],
    ] as const;
    for (const [method, path] of paths) {
      const r = await send(method, path, first.headers, { reason: 'other' });
      expect(r.status, path).toBe(409);
    }
  });
});

describe('leaving, blocking and reporting', () => {
  it('a child can remove a friend, for both of them', async () => {
    const a = await kid();
    const b = await kid();
    await befriend(a, b);
    expect((await send('DELETE', `/v1/student/friends/${b.studentId}`, a.headers)).status).toBe(
      204,
    );
    expect((await friendsOf(a)).friends).toEqual([]);
    expect((await friendsOf(b)).friends).toEqual([]);
  });

  it('either parent can remove a friend', async () => {
    const a = await kid();
    const b = await kid();
    await befriend(a, b);
    const res = await send(
      'DELETE',
      `/v1/students/${b.studentId}/friends/${a.studentId}`,
      b.parent.headers,
    );
    expect(res.status).toBe(204);
    expect((await friendsOf(a)).friends).toEqual([]);
  });

  it('a block stops the other child using any code from the blocker, without saying so', async () => {
    const a = await kid();
    const b = await kid();
    await befriend(a, b);
    expect((await send('POST', `/v1/student/friends/${b.studentId}/block`, a.headers)).status).toBe(
      204,
    );
    expect((await friendsOf(a)).friends).toEqual([]);
    const fromA = await makeCode(a);
    const res = await redeem(b, fromA.code);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('code_not_valid');
    const fromB = await makeCode(b);
    expect((await redeem(a, fromB.code)).status).toBe(404);
    expect((await parentView(a)).blocked.map((x) => x.nickname)).toEqual([b.nickname]);
  });

  it('a parent can lift a block', async () => {
    const a = await kid();
    const b = await kid();
    await befriend(a, b);
    await send('POST', `/v1/student/friends/${b.studentId}/block`, a.headers);
    const res = await send(
      'DELETE',
      `/v1/students/${a.studentId}/friends/blocks/${b.studentId}`,
      a.parent.headers,
    );
    expect(res.status).toBe(204);
    const { code } = await makeCode(a);
    expect((await redeem(b, code)).status).toBe(201);
  });

  it('a report uses a fixed reason, removes and blocks, and both families see it', async () => {
    const a = await kid('Pixel_4');
    const b = await kid('Ember_8');
    await befriend(a, b);
    const bad = await send('POST', `/v1/student/friends/${b.studentId}/report`, a.headers, {
      reason: 'they said hi',
    });
    expect(bad.status).toBe(400);
    const res = await send('POST', `/v1/student/friends/${b.studentId}/report`, a.headers, {
      reason: 'pressured',
    });
    expect(res.status).toBe(201);
    expect((await friendsOf(a)).friends).toEqual([]);
    expect((await parentView(a)).reports).toEqual([
      expect.objectContaining({
        direction: 'made',
        reason: 'pressured',
        reporter: 'Pixel_4',
        reported: 'Ember_8',
      }),
    ]);
    expect((await parentView(b)).reports).toEqual([
      expect.objectContaining({
        direction: 'about',
        reason: 'pressured',
        reporter: 'Pixel_4',
        reported: 'Ember_8',
      }),
    ]);
    const { code } = await makeCode(a);
    expect((await redeem(b, code)).status).toBe(404);
  });

  it('only acts on real friends', async () => {
    const a = await kid();
    const stranger = await kid();
    expect(
      (await send('DELETE', `/v1/student/friends/${stranger.studentId}`, a.headers)).status,
    ).toBe(404);
    expect(
      (await send('POST', `/v1/student/friends/${stranger.studentId}/block`, a.headers)).status,
    ).toBe(404);
  });
});

describe('a private parent label', () => {
  it("is seen only by this family's parents", async () => {
    const a = await kid();
    const b = await kid();
    await befriend(a, b);
    const res = await send(
      'PUT',
      `/v1/students/${a.studentId}/friends/${b.studentId}/label`,
      a.parent.headers,
      {
        label: 'from football',
      },
    );
    expect(res.status).toBe(200);
    expect((await parentView(a)).friends[0]!.label).toBe('from football');
    expect((await parentView(b)).friends[0]!.label).toBeNull();
    expect(await (await get('/v1/student/friends', a.headers)).text()).not.toContain('football');
    expect(await (await get('/v1/student/friends', b.headers)).text()).not.toContain('football');
  });

  it('refuses an email address or phone number', async () => {
    const a = await kid();
    const b = await kid();
    await befriend(a, b);
    for (const label of ['someone@example.com', '07700 900123', 'x'.repeat(31)]) {
      const res = await send(
        'PUT',
        `/v1/students/${a.studentId}/friends/${b.studentId}/label`,
        a.parent.headers,
        { label },
      );
      expect(res.status, label).toBe(400);
    }
  });
});

describe('the league', () => {
  let itemId: string | undefined;
  async function earn(k: Kid, xp: number, at: Date) {
    if (!itemId) {
      await t.db
        .insert(topics)
        .values({ id: 'fl-topic', subjectId: 'gcse-maths', board: 'aqa', title: 'T' });
      const [item] = await t.db
        .insert(items)
        .values({ topicId: 'fl-topic', type: 'multiple_choice', body: {}, answer: {} })
        .returning();
      itemId = item!.id;
    }
    await t.db
      .insert(attempts)
      .values({ studentId: k.studentId, itemId, correct: true, xpEarned: xp, createdAt: at });
  }

  it("ranks you and your friends by this week's XP, showing friends only finished days", async () => {
    const a = await kid('Lark_1');
    const b = await kid('Wren_2');
    await befriend(a, b);
    const now = t.clock.now();
    const yesterday = new Date(now.getTime() - DAY);
    await earn(a, 60, now);
    await earn(b, 90, yesterday);
    await earn(b, 40, now);
    const res = await get('/v1/student/league', a.headers);
    expect(res.status).toBe(200);
    const league = (await res.json()) as {
      week: { start: string; end: string };
      entries: { nickname: string; xp: number; place: number | null; you: boolean }[];
    };
    expect(league.entries.find((e) => e.you)).toMatchObject({ nickname: 'Lark_1', xp: 60 });
    // Today's 40 is never shown to a friend; yesterday's 90 is, if it was this week.
    const sameWeek = localDate(yesterday) >= league.week.start;
    expect(league.entries.find((e) => !e.you)).toMatchObject({
      nickname: 'Wren_2',
      xp: sameWeek ? 90 : 0,
    });
  });

  it('leaves out a friend who hid from the league', async () => {
    const a = await kid();
    const b = await kid();
    await befriend(a, b);
    expect(
      (await send('PUT', '/v1/student/league/hidden', b.headers, { hidden: true })).status,
    ).toBe(200);
    const league = (await (await get('/v1/student/league', a.headers)).json()) as {
      entries: unknown[];
    };
    expect(league.entries).toHaveLength(1);
    const own = (await (await get('/v1/student/league', b.headers)).json()) as {
      hidden: boolean;
      entries: unknown[];
    };
    expect(own).toMatchObject({ hidden: true, entries: [] });
  });
});

describe('the family data export', () => {
  it("includes the child's friends, requests, blocks and reports, without the other family's ids", async () => {
    const a = await kid('Sable_3');
    const b = await kid('Tango_5');
    const c = await kid('Umbra_6');
    await befriend(a, b);
    await send(
      'PUT',
      `/v1/students/${a.studentId}/friends/${b.studentId}/label`,
      a.parent.headers,
      {
        label: 'from chess club',
      },
    );
    await befriend(a, c);
    await send('POST', `/v1/student/friends/${c.studentId}/report`, a.headers, { reason: 'other' });
    const res = await get('/v1/export', a.parent.headers);
    expect(res.status).toBe(200);
    const text = await res.text();
    const data = JSON.parse(text) as {
      students: { profile: Record<string, unknown>; friends: Record<string, unknown> }[];
    };
    const mine = data.students[0]!;
    expect(mine.profile).toMatchObject({ friendsAllowed: true, leagueHidden: false });
    expect(mine.friends).toEqual({
      friendships: [{ nickname: 'Tango_5', since: expect.any(String), label: 'from chess club' }],
      requests: [],
      blocked: [{ nickname: 'Umbra_6', since: expect.any(String) }],
      reports: [
        {
          direction: 'made',
          reason: 'other',
          reporter: 'Sable_3',
          reported: 'Umbra_6',
          at: expect.any(String),
        },
      ],
    });
    expect(text).not.toContain(b.studentId);
    expect(text).not.toContain(c.studentId);
  });
});

describe('the daily clean-up', () => {
  it('deletes used and expired codes, old tries, and requests a day after they end', async () => {
    const a = await kid();
    const b = await kid();
    const { code } = await makeCode(a);
    await makeCode(a); // unused, still valid
    await redeem(b, 'WXYZ-2345'); // a wrong try
    const res = await redeem(b, code);
    const { requestId } = (await res.json()) as { requestId: string };
    await send('POST', `/v1/student/friends/requests/${requestId}/cancel`, b.headers);

    const codesOf = () =>
      t.db.select().from(friendCodes).where(eq(friendCodes.studentId, a.studentId));
    const requestsOf = () =>
      t.db.select().from(friendRequests).where(eq(friendRequests.toStudentId, b.studentId));
    const triesOf = () =>
      t.db.select().from(friendCodeTries).where(eq(friendCodeTries.studentId, b.studentId));

    const now = t.clock.now();
    await deleteExpiredFriendRecords(t.db, now);
    expect(await codesOf()).toHaveLength(1); // the used code is gone at once
    expect(await requestsOf()).toHaveLength(1); // "didn't go ahead" shows for a day
    expect(await triesOf()).toHaveLength(2);

    await deleteExpiredFriendRecords(t.db, new Date(now.getTime() + DAY + 1));
    expect(await requestsOf()).toHaveLength(0);
    expect(await triesOf()).toHaveLength(0);
    expect(await codesOf()).toHaveLength(1); // the unused one is still valid for 48 hours
  });
});

describe('response shapes', () => {
  it('match the shared core schemas the web app reads', async () => {
    const a = await kid();
    const b = await kid();
    const code = await makeCode(a);
    expect(FriendCodeResponseSchema.safeParse(code).success).toBe(true);
    const redeemed = await (await redeem(b, code.code)).json();
    expect(RedeemFriendCodeResponseSchema.parse(redeemed)).toBeTruthy();
    expect(StudentFriendsResponseSchema.strict().safeParse(await friendsOf(a)).success).toBe(true);
    expect(ParentFriendsResponseSchema.strict().safeParse(await parentView(a)).success).toBe(true);
    const league = await (await get('/v1/student/league', a.headers)).json();
    expect(LeagueResponseSchema.strict().safeParse(league).success).toBe(true);
  });
});

describe('the friends flag (dev only until the notices are updated)', () => {
  it('refuses every friends and league route with "not available yet" when off', async () => {
    const off = await createTestContext();
    try {
      const k = await off.familyStudent('Flag_Off');
      const studentPaths: [string, string][] = [
        ['GET', '/v1/student/friends'],
        ['POST', '/v1/student/friends/codes'],
        ['GET', '/v1/student/league'],
        ['PUT', '/v1/student/league/hidden'],
      ];
      for (const [method, path] of studentPaths) {
        const init = method === 'GET' ? { headers: k.headers } : jsonRequest(method, {}, k.headers);
        const res = await off.app.request(path, init);
        expect(res.status, path).toBe(404);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code, path).toBe('friends_not_available');
      }
      const parent = await off.app.request(`/v1/students/${k.studentId}/friends`, {
        headers: k.parent.headers,
      });
      expect(parent.status).toBe(404);
      const allow = await off.app.request(
        `/v1/students/${k.studentId}/friends/allowed`,
        jsonRequest('PUT', { allowed: true }, k.parent.headers),
      );
      expect(allow.status).toBe(404);
      // Other student routes still work.
      expect((await off.app.request('/v1/student/rewards', { headers: k.headers })).status).toBe(
        200,
      );
    } finally {
      await off.close();
    }
  });
});

describe('weekly results and league wins (PR 3)', () => {
  let topicDone = false;
  let itemIdForWins = '';
  async function earnAt(k: Kid, xp: number, at: Date) {
    if (!topicDone) {
      await t.db
        .insert(topics)
        .values({ id: 'fl-wins', subjectId: 'gcse-maths', board: 'aqa', title: 'W' })
        .onConflictDoNothing();
      const [item] = await t.db
        .insert(items)
        .values({ topicId: 'fl-wins', type: 'multiple_choice', body: {}, answer: {} })
        .returning();
      itemIdForWins = item!.id;
      topicDone = true;
    }
    await t.db.insert(attempts).values({
      studentId: k.studentId,
      itemId: itemIdForWins,
      correct: true,
      xpEarned: xp,
      createdAt: at,
    });
  }
  /** Friends since well before last week, and both children created then too. */
  async function oldFriends(a: Kid, b: Kid) {
    await befriend(a, b);
    const long = new Date(t.clock.now().getTime() - 30 * DAY);
    await t.db
      .update(friendships)
      .set({ createdAt: long })
      .where(
        or(
          and(eq(friendships.studentA, a.studentId), eq(friendships.studentB, b.studentId)),
          and(eq(friendships.studentA, b.studentId), eq(friendships.studentB, a.studentId)),
        ),
      );
    await t.db
      .update(students)
      .set({ createdAt: long })
      .where(inArray(students.id, [a.studentId, b.studentId]));
  }
  const tuesdayOf = () => {
    const [week] = previousLeagueWeeks(t.clock.now(), 1);
    return new Date(new Date(`${week!.start}T12:00:00Z`).getTime() + DAY);
  };
  async function leagueOf(k: Kid) {
    return (await (await get('/v1/student/league', k.headers)).json()) as {
      lastWeek: { xp: number; place: number | null; won: boolean } | null;
    };
  }
  const winsOf = async (k: Kid) =>
    (await t.db.select().from(students).where(eq(students.id, k.studentId)))[0]!.leagueWins;

  it('settles last week when the league opens: the top child wins, once', async () => {
    const a = await kid('Victor_1');
    const b = await kid('Second_2');
    await oldFriends(a, b);
    await earnAt(a, 120, tuesdayOf());
    await earnAt(b, 60, tuesdayOf());
    expect((await leagueOf(a)).lastWeek).toEqual({ xp: 120, place: 1, won: true });
    expect((await leagueOf(b)).lastWeek).toEqual({ xp: 60, place: 2, won: false });
    await leagueOf(a);
    expect(await winsOf(a)).toBe(1);
    expect(await winsOf(b)).toBe(0);
  });

  it('counts only friends who were friends by the end of the week', async () => {
    const a = await kid();
    const b = await kid();
    await befriend(a, b); // friends only from now
    await t.db
      .update(students)
      .set({ createdAt: new Date(t.clock.now().getTime() - 30 * DAY) })
      .where(inArray(students.id, [a.studentId, b.studentId]));
    await earnAt(a, 120, tuesdayOf());
    await earnAt(b, 60, tuesdayOf());
    expect((await leagueOf(a)).lastWeek).toMatchObject({ won: false });
  });

  it('gives no win to a child hidden from the league', async () => {
    const a = await kid();
    const b = await kid();
    await oldFriends(a, b);
    await earnAt(a, 120, tuesdayOf());
    await earnAt(b, 60, tuesdayOf());
    await send('PUT', '/v1/student/league/hidden', a.headers, { hidden: true });
    await leagueOf(a);
    expect(await winsOf(a)).toBe(0);
  });

  it('turns a win into the "Top of the friends league" reward', async () => {
    const a = await kid();
    const b = await kid();
    await oldFriends(a, b);
    await earnAt(a, 150, tuesdayOf());
    await earnAt(b, 70, tuesdayOf());
    const res = await get('/v1/student/rewards', a.headers);
    expect(res.status).toBe(200);
    const view = (await res.json()) as { newlyEarned: { id: string }[] };
    expect(view.newlyEarned.map((r) => r.id)).toContain('league-top');
  });

  it('keeps 8 weeks of results, but the win count stays', async () => {
    const a = await kid();
    const b = await kid();
    await oldFriends(a, b);
    await earnAt(a, 150, tuesdayOf());
    await earnAt(b, 70, tuesdayOf());
    await leagueOf(a);
    await deleteExpiredFriendRecords(t.db, new Date(t.clock.now().getTime() + 9 * 7 * DAY));
    const rows = await t.db
      .select()
      .from(leagueWeeks)
      .where(eq(leagueWeeks.studentId, a.studentId));
    expect(rows).toHaveLength(0);
    expect(await winsOf(a)).toBe(1);
  });
});

describe('closing a report', () => {
  async function reported() {
    const a = await kid();
    const b = await kid();
    await befriend(a, b);
    await send('POST', `/v1/student/friends/${b.studentId}/report`, a.headers, { reason: 'other' });
    const [report] = (await parentView(a)).reports as unknown as { id: string; closed: boolean }[];
    return { a, b, report: report! };
  }

  it("lets the reporting child's parent mark it as dealt with", async () => {
    const { a, b, report } = await reported();
    expect(report.closed).toBe(false);
    const res = await send(
      'POST',
      `/v1/students/${a.studentId}/friends/reports/${report.id}/close`,
      a.parent.headers,
    );
    expect(res.status).toBe(200);
    expect((await parentView(a)).reports[0]).toMatchObject({ closed: true });
    expect((await parentView(b)).reports[0]).toMatchObject({ closed: true });
  });

  it('does not let the other family close it', async () => {
    const { b, report } = await reported();
    const res = await send(
      'POST',
      `/v1/students/${b.studentId}/friends/reports/${report.id}/close`,
      b.parent.headers,
    );
    expect(res.status).toBe(404);
  });

  it('is deleted 12 months after it was closed, not before', async () => {
    const { a, report } = await reported();
    await send(
      'POST',
      `/v1/students/${a.studentId}/friends/reports/${report.id}/close`,
      a.parent.headers,
    );
    const now = t.clock.now();
    const left = () => t.db.select().from(friendReports).where(eq(friendReports.id, report.id));
    await deleteExpiredFriendRecords(t.db, new Date(now.getTime() + 300 * DAY));
    expect(await left()).toHaveLength(1);
    await deleteExpiredFriendRecords(t.db, new Date(now.getTime() + 367 * DAY));
    expect(await left()).toHaveLength(0);
  });
});

describe('review fixes (FL4-fix)', () => {
  it('starts the friendship when both families approve at the same moment', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    const [ra, rb] = await Promise.all([approve(a, id), approve(b, id)]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    expect((await friendsOf(a)).friends.map((f) => f.id)).toEqual([b.studentId]);
  });

  it('starts the friendship even when each family approved from an old copy of the request', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    const [stale] = await t.db.select().from(friendRequests).where(eq(friendRequests.id, id));
    // Both reads happened before either write: the race the review found.
    await approveRequest(t.db, stale!, 'from', 1, t.clock.now());
    const result = await approveRequest(t.db, stale!, 'to', 1, t.clock.now());
    expect(result).toBe('started');
    expect((await friendsOf(a)).friends.map((f) => f.id)).toEqual([b.studentId]);
  });

  it('stops a child with 3 waiting requests from entering another code', async () => {
    const b = await kid();
    for (let i = 0; i < 3; i++) {
      const other = await kid();
      const { code } = await makeCode(other);
      expect((await redeem(b, code)).status).toBe(201);
    }
    const fourth = await kid();
    const { code } = await makeCode(fourth);
    const res = await redeem(b, code);
    expect(res.status).toBe(409);
    // The code was not used up, so the friend can still give it to someone else.
    const c = await kid();
    expect((await redeem(c, code)).status).toBe(201);
  });

  it('refuses a code whose owner already has 3 waiting requests, without saying why', async () => {
    const a = await kid();
    const { code } = await makeCode(a);
    for (let i = 0; i < 3; i++) {
      const other = await kid();
      const theirs = await makeCode(other);
      expect((await redeem(a, theirs.code)).status).toBe(201);
    }
    const b = await kid();
    const res = await redeem(b, code);
    expect(res.status).toBe(404);
  });

  it('settles finished weeks before a friendship ends, so leaving cannot turn a loss into a win', async () => {
    const a = await kid();
    const b = await kid();
    const c = await kid();
    const long = new Date(t.clock.now().getTime() - 30 * DAY);
    for (const other of [b, c]) {
      await befriend(a, other);
      await t.db
        .update(friendships)
        .set({ createdAt: long })
        .where(
          or(
            and(eq(friendships.studentA, a.studentId), eq(friendships.studentB, other.studentId)),
            and(eq(friendships.studentA, other.studentId), eq(friendships.studentB, a.studentId)),
          ),
        );
    }
    await t.db
      .update(students)
      .set({ createdAt: long })
      .where(inArray(students.id, [a.studentId, b.studentId, c.studentId]));
    const [week] = previousLeagueWeeks(t.clock.now(), 1);
    const tuesday = new Date(new Date(`${week!.start}T12:00:00Z`).getTime() + DAY);
    const [topic] = await t.db.select().from(topics).limit(1);
    const [item] = await t.db.select().from(items).where(eq(items.topicId, topic!.id)).limit(1);
    for (const [k, xp] of [
      [a, 60],
      [b, 120],
      [c, 10],
    ] as const) {
      await t.db.insert(attempts).values({
        studentId: k.studentId,
        itemId: item!.id,
        correct: true,
        xpEarned: xp,
        createdAt: tuesday,
      });
    }
    // a leaves b before anyone has opened the league this week.
    expect((await send('DELETE', `/v1/student/friends/${b.studentId}`, a.headers)).status).toBe(
      204,
    );
    const league = (await (await get('/v1/student/league', a.headers)).json()) as {
      lastWeek: { place: number | null; won: boolean } | null;
    };
    expect(league.lastWeek).toMatchObject({ place: 2, won: false });
  });

  it('tells only the child who typed the code that they need to confirm', async () => {
    const a = await kid();
    const b = await kid();
    const { code } = await makeCode(a);
    await redeem(b, code);
    expect((await friendsOf(b)).waiting[0]!.status).toBe('confirm');
    expect((await friendsOf(a)).waiting[0]!.status).toBe('friend_checking');
  });
});

describe('review fixes, part 2 (FL4b)', () => {
  it('keeps the request open, so it can be tried again, if saving the friendship fails', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    expect((await approve(a, id)).status).toBe(200);
    // Make the friendship save fail once, as a dropped database connection would.
    await t.db.execute(sql`
      create or replace function fl4b_fail() returns trigger as $$
      begin raise exception 'fl4b: save failed'; end $$ language plpgsql`);
    await t.db.execute(
      sql`create trigger fl4b_fail before insert on friendships for each row execute function fl4b_fail()`,
    );
    try {
      expect((await approve(b, id)).status).toBe(500);
    } finally {
      await t.db.execute(sql`drop trigger fl4b_fail on friendships`);
    }
    const [row] = await t.db.select().from(friendRequests).where(eq(friendRequests.id, id));
    expect(row!.status).toBe('parents');
    expect((await approve(b, id)).status).toBe(200);
    expect((await friendsOf(a)).friends.map((f) => f.id)).toEqual([b.studentId]);
  });

  it('finishes the start when the friendship was saved but the request was not marked', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    await t.db
      .update(friendRequests)
      .set({ fromApprovedBy: 1, toApprovedBy: 1 })
      .where(eq(friendRequests.id, id));
    const [x, y] =
      a.studentId < b.studentId ? [a.studentId, b.studentId] : [b.studentId, a.studentId];
    await t.db.insert(friendships).values({ studentA: x, studentB: y });
    const res = await approve(b, id);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe('started');
    const [row] = await t.db.select().from(friendRequests).where(eq(friendRequests.id, id));
    expect(row!.status).toBe('started');
  });
});

describe('review fixes, part 3 (FL4c)', () => {
  const failFriendshipSaves = async () => {
    await t.db.execute(sql`
      create or replace function fl4c_fail() returns trigger as $$
      begin raise exception 'fl4c: save failed'; end $$ language plpgsql`);
    await t.db.execute(
      sql`create trigger fl4c_fail before insert on friendships for each row execute function fl4c_fail()`,
    );
  };
  const allowSaves = () => t.db.execute(sql`drop trigger fl4c_fail on friendships`);
  const statusOf = async (id: string) =>
    (await t.db.select().from(friendRequests).where(eq(friendRequests.id, id)))[0]!.status;

  it('finishes a request left with both approvals when a parent next opens Friends', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    expect((await approve(a, id)).status).toBe(200);
    await failFriendshipSaves();
    try {
      expect((await approve(b, id)).status).toBe(500);
    } finally {
      await allowSaves();
    }
    const view = await parentView(a);
    expect(view.waitingForOther).toEqual([]);
    expect(view.waitingForYou).toEqual([]);
    expect(await statusOf(id)).toBe('started');
    expect((await friendsOf(a)).friends.map((f) => f.id)).toEqual([b.studentId]);
  });

  it('finishes it when the child next opens Friends too', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    await t.db
      .update(friendRequests)
      .set({ fromApprovedBy: 1, toApprovedBy: 1 })
      .where(eq(friendRequests.id, id));
    const list = await friendsOf(b);
    expect(list.friends.map((f) => f.id)).toEqual([a.studentId]);
    expect(list.waiting).toEqual([]);
    expect(await statusOf(id)).toBe('started');
  });

  it('never declines a request whose pair is already friends', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    expect((await approve(a, id)).status).toBe(200);
    const [x, y] =
      a.studentId < b.studentId ? [a.studentId, b.studentId] : [b.studentId, a.studentId];
    await t.db.insert(friendships).values({ studentA: x, studentB: y });
    // The rules would now say no (friends turned off), but the friendship was already saved.
    await t.db.update(students).set({ friendsAllowed: false }).where(eq(students.id, a.studentId));
    expect((await approve(b, id)).status).toBe(200);
    expect(await statusOf(id)).toBe('started');
  });

  it('starts the friendship once when both finish at the same time', async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    await t.db
      .update(friendRequests)
      .set({ fromApprovedBy: 1, toApprovedBy: 1 })
      .where(eq(friendRequests.id, id));
    const [r] = await t.db.select().from(friendRequests).where(eq(friendRequests.id, id));
    const now = new Date(t.clock.now());
    const results = await Promise.all([
      finaliseRequest(t.db, r!, now),
      finaliseRequest(t.db, r!, now),
    ]);
    expect(results).toEqual(['started', 'started']);
    expect(await statusOf(id)).toBe('started');
    expect((await friendsOf(a)).friends.map((f) => f.id)).toEqual([b.studentId]);
  });
});

describe('review fixes, part 4 (FL4d): a removal is never undone', () => {
  const failStarts = async () => {
    await t.db.execute(sql`
      create or replace function fl4d_fail() returns trigger as $$
      begin
        if new.status = 'started' then raise exception 'fl4d: mark failed'; end if;
        return new;
      end $$ language plpgsql`);
    await t.db.execute(
      sql`create trigger fl4d_fail before update on friend_requests for each row execute function fl4d_fail()`,
    );
  };
  const allowStarts = () => t.db.execute(sql`drop trigger fl4d_fail on friend_requests`);
  const statusOf = async (id: string) =>
    (await t.db.select().from(friendRequests).where(eq(friendRequests.id, id)))[0]!.status;

  /** Both families approve; the friendship is saved but the request is never marked started. */
  async function halfStarted(a: Kid, b: Kid) {
    const id = await request(a, b);
    expect((await approve(a, id)).status).toBe(200);
    await failStarts();
    try {
      expect((await approve(b, id)).status).toBe(500);
    } finally {
      await allowStarts();
    }
    expect(await statusOf(id)).toBe('parents');
    expect((await friendsOf(a)).friends.map((f) => f.id)).toEqual([b.studentId]);
    return id;
  }

  it('does not bring back a friendship a parent removed', async () => {
    const a = await kid();
    const b = await kid();
    const id = await halfStarted(a, b);
    // friendsOf above healed it; leave it half-started again for the real case.
    await t.db.update(friendRequests).set({ status: 'parents' }).where(eq(friendRequests.id, id));
    const res = await send(
      'DELETE',
      `/v1/students/${a.studentId}/friends/${b.studentId}`,
      a.parent.headers,
    );
    expect(res.status).toBe(204);
    expect(await statusOf(id)).toBe('declined');
    expect((await friendsOf(a)).friends).toEqual([]);
    expect((await friendsOf(b)).friends).toEqual([]);
    expect((await parentView(b)).waitingForOther).toEqual([]);
  });

  it('does not bring back a friendship the child removed', async () => {
    const a = await kid();
    const b = await kid();
    const id = await halfStarted(a, b);
    await t.db.update(friendRequests).set({ status: 'parents' }).where(eq(friendRequests.id, id));
    expect((await send('DELETE', `/v1/student/friends/${a.studentId}`, b.headers)).status).toBe(
      204,
    );
    expect(await statusOf(id)).toBe('declined');
    expect((await friendsOf(a)).friends).toEqual([]);
  });

  it('does not bring back a friendship after a block', async () => {
    const a = await kid();
    const b = await kid();
    const id = await halfStarted(a, b);
    await t.db.update(friendRequests).set({ status: 'parents' }).where(eq(friendRequests.id, id));
    const res = await send('POST', `/v1/student/friends/${a.studentId}/block`, b.headers);
    expect(res.status).toBeLessThan(300);
    expect(await statusOf(id)).toBe('declined');
    expect((await friendsOf(a)).friends).toEqual([]);
  });

  it("closes the child's open requests when a parent turns friends off", async () => {
    const a = await kid();
    const b = await kid();
    const id = await request(a, b);
    expect((await approve(a, id)).status).toBe(200);
    await allow(a, false);
    expect(await statusOf(id)).toBe('declined');
    await allow(a, true);
    expect((await friendsOf(a)).friends).toEqual([]);
  });
});
