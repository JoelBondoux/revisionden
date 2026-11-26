/**
 * Friends league (docs/FRIENDS_LEAGUE.md). Friends see each other's nickname, avatar, title and
 * weekly league XP only: no chat, no free text, no profiles.
 *
 * Student (/v1/student):
 * - GET /friends: friends (siblings join automatically), waiting requests, and the settings.
 * - POST /friends/codes: a one-time code to share in person (8 characters, 48 hours, 3 a day).
 * - POST /friends/redeem: type a friend's code; shows who it is. Wrong tries are limited.
 * - POST /friends/requests/:id/confirm | cancel: "Yes, this is my friend" or cancel.
 * - DELETE /friends/:id, POST /friends/:id/block, POST /friends/:id/report (fixed reasons).
 * - GET /league, PUT /league/hidden.
 *
 * Parent (/v1/students/:id/friends): the view, "Allow friends", approve or decline a request,
 * remove, block, unblock and a private label. One parent from each family must approve.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { and, count, eq, gt, inArray, isNotNull, isNull, lt, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  FAMILY_CODE_TRIES_PER_DAY,
  FRIEND_CODES_PER_DAY,
  FRIEND_CODE_TTL_MS,
  FRIEND_REQUEST_TTL_MS,
  MAX_FRIENDS,
  MAX_WAITING_REQUESTS,
  REPORT_REASONS,
  WRONG_CODE_TRIES_PER_HOUR,
  LEAGUE_WEEKS_KEPT,
  formatFriendCode,
  previousLeagueWeeks,
  formatTitle,
  newFriendCode,
  normaliseFriendCode,
  validFriendLabel,
} from '@revisionden/core';
import {
  friendBlocks,
  friendCodeTries,
  friendCodes,
  friendReports,
  friendRequests,
  friendships,
  leagueWeeks,
  students,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { requireFamilyStudent } from '../families';
import { recordFamilyEvent, type EventKind } from '../family-events';
import { containsPersonalData, personalDetails } from '../feedback/routes';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import { hashToken } from '../tokens';
import { isId } from '../validation';
import { leagueFor, settleLeagueWeeks } from './friends-league';

const HOUR_MS = 60 * 60 * 1000;
/** 12 months after a report is closed. */
const REPORT_KEPT_DAYS = 366;
const DAY_MS = 24 * HOUR_MS;

export interface FriendDeps {
  db: Database;
  clock: Clock;
  config?: { friendsEnabled?: boolean };
  /** Injected in tests; defaults to crypto randomness. */
  randomBytes?: (n: number) => Uint8Array;
}

const notAvailable = () =>
  new ApiError(404, 'friends_not_available', "Friends aren't available yet.");

/** Refuses every friends route while the friends flag is off (dev only for now). */
function requireFriendsOn(deps: FriendDeps): MiddlewareHandler<AppEnv> {
  return async (_c, next) => {
    if (!deps.config?.friendsEnabled) throw notAvailable();
    await next();
  };
}

type StudentRow = typeof students.$inferSelect;
type RequestRow = typeof friendRequests.$inferSelect;

const friendsOff = () => new ApiError(403, 'friends_off', 'Ask a parent to turn on friends first.');
const codeNotValid = () =>
  new ApiError(404, 'code_not_valid', "That code isn't valid. Check it, or ask for a new one.");
const tooManyTries = () => new ApiError(429, 'too_many_tries', 'Too many tries. Try again later.');
const notAFriend = () => notFound('Friend not found');
const siblingFriend = () =>
  new ApiError(409, 'sibling', 'Brothers and sisters are in your league while friends is on.');
const requestClosed = () =>
  new ApiError(409, 'request_closed', "This friend request didn't go ahead.");

/** What other children see: nickname, avatar and title only. */
export const card = (s: StudentRow) => ({
  nickname: s.nickname,
  avatarCode: s.avatarCode,
  title: formatTitle({ first: s.titleFirst, last: s.titleLast }),
});

const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]) as [string, string];

async function loadStudent(db: Database, id: string) {
  const [row] = await db.select().from(students).where(eq(students.id, id));
  return row;
}

/** Friend ids from friendships (not siblings). */
async function friendshipIds(db: Database, studentId: string): Promise<string[]> {
  const rows = await db
    .select({ a: friendships.studentA, b: friendships.studentB })
    .from(friendships)
    .where(or(eq(friendships.studentA, studentId), eq(friendships.studentB, studentId)));
  return rows.map((r) => (r.a === studentId ? r.b : r.a));
}

/** Brothers and sisters with friends on; none when friends is off for this child. */
export async function siblings(db: Database, me: StudentRow): Promise<StudentRow[]> {
  if (!me.friendsAllowed) return [];
  return db
    .select()
    .from(students)
    .where(
      and(
        eq(students.familyId, me.familyId),
        ne(students.id, me.id),
        eq(students.friendsAllowed, true),
      ),
    );
}

/** Friends who also have friends on (a child whose parent turned it off is paused). */
export async function friendsOf(db: Database, me: StudentRow) {
  if (!me.friendsAllowed) return { friends: [] as StudentRow[], siblings: [] as StudentRow[] };
  const ids = await friendshipIds(db, me.id);
  const friends =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(students)
          .where(and(inArray(students.id, ids), eq(students.friendsAllowed, true)));
  return { friends, siblings: await siblings(db, me) };
}

async function friendCount(db: Database, me: StudentRow) {
  const ids = await friendshipIds(db, me.id);
  return ids.length + (await siblings(db, me)).length;
}

async function blockedEitherWay(db: Database, x: string, y: string) {
  const rows = await db
    .select({ x: friendBlocks.blockerId })
    .from(friendBlocks)
    .where(
      or(
        and(eq(friendBlocks.blockerId, x), eq(friendBlocks.blockedId, y)),
        and(eq(friendBlocks.blockerId, y), eq(friendBlocks.blockedId, x)),
      ),
    );
  return rows.length > 0;
}

const openStatus = inArray(friendRequests.status, ['child_confirm', 'parents']);

async function openRequests(db: Database, studentId: string, now: Date) {
  return db
    .select()
    .from(friendRequests)
    .where(
      and(
        or(eq(friendRequests.fromStudentId, studentId), eq(friendRequests.toStudentId, studentId)),
        openStatus,
        gt(friendRequests.expiresAt, now),
      ),
    );
}

async function areFriends(db: Database, x: string, y: string) {
  const [a, b] = pair(x, y);
  const [row] = await db
    .select({ a: friendships.studentA })
    .from(friendships)
    .where(and(eq(friendships.studentA, a), eq(friendships.studentB, b)));
  return !!row;
}

/** Whether `me` and `other` may become friends now. */
async function canBefriend(
  db: Database,
  me: StudentRow,
  other: StudentRow,
  now: Date,
  /** The request being approved, which does not count as one already open. */
  approving?: string,
) {
  if (me.id === other.id || me.familyId === other.familyId) return false;
  if (!me.friendsAllowed || !other.friendsAllowed) return false;
  if (await blockedEitherWay(db, me.id, other.id)) return false;
  if (await areFriends(db, me.id, other.id)) return false;
  const open = await openRequests(db, me.id, now);
  const between = (r: RequestRow) =>
    r.id !== approving && (r.fromStudentId === other.id || r.toStudentId === other.id);
  if (open.some(between)) return false;
  return (await friendCount(db, me)) < MAX_FRIENDS && (await friendCount(db, other)) < MAX_FRIENDS;
}

/**
 * One family's approval. Only that family's column is written, so two approvals at once cannot
 * overwrite each other (FL4-fix). Once both are set, the friendship is saved first and the request
 * is marked started after (FL4b): if the save fails, the request stays open with both approvals and
 * approving again finishes it. Saving twice is harmless (the pair is the primary key).
 */
export async function approveRequest(
  db: Database,
  r: RequestRow,
  side: 'from' | 'to',
  position: number,
  now: Date,
): Promise<'waiting_for_other_family' | 'started' | 'closed'> {
  const open = and(
    eq(friendRequests.id, r.id),
    eq(friendRequests.status, 'parents'),
    gt(friendRequests.expiresAt, now),
  );
  const [marked] = await db
    .update(friendRequests)
    .set(side === 'from' ? { fromApprovedBy: position } : { toApprovedBy: position })
    .where(open)
    .returning();
  if (!marked) return 'closed';
  if (marked.fromApprovedBy === null || marked.toApprovedBy === null) {
    return 'waiting_for_other_family';
  }
  const start = () =>
    db.update(friendRequests).set({ status: 'started', endedAt: now }).where(open);
  // Both families said yes. Already friends means an earlier try saved the friendship.
  if (await areFriends(db, r.fromStudentId, r.toStudentId)) {
    await start();
    return 'started';
  }
  // Check again (a block or a full list since), then save the friendship, then mark it started.
  const from = await loadStudent(db, r.fromStudentId);
  const to = await loadStudent(db, r.toStudentId);
  if (!from || !to || !(await canBefriend(db, from, to, now, r.id))) {
    await db
      .update(friendRequests)
      .set({ status: 'declined', endedAt: now })
      .where(eq(friendRequests.id, r.id));
    return 'closed';
  }
  const [a, b] = pair(from.id, to.id);
  await db
    .insert(friendships)
    .values({ studentA: a, studentB: b, createdAt: now })
    .onConflictDoNothing();
  await start();
  return 'started';
}

/**
 * Ends a friendship, if any. Finished weeks are settled first for both children (review fix,
 * FL4-fix), so leaving after Sunday cannot change last week's result. Returns whether there was one.
 */
async function unfriend(db: Database, x: string, y: string, now: Date) {
  for (const id of [x, y]) {
    const s = await loadStudent(db, id);
    if (s) await settleLeagueWeeks(db, s, now);
  }
  const [a, b] = pair(x, y);
  const gone = await db
    .delete(friendships)
    .where(and(eq(friendships.studentA, a), eq(friendships.studentB, b)))
    .returning({ a: friendships.studentA });
  return gone.length > 0;
}

async function block(db: Database, blockerId: string, blockedId: string, now: Date) {
  await unfriend(db, blockerId, blockedId, now);
  await db
    .insert(friendBlocks)
    .values({ blockerId, blockedId, createdAt: now })
    .onConflictDoNothing();
}

async function logFor(
  db: Database,
  s: StudentRow,
  kind: EventKind,
  now: Date,
  actorPosition: number | null = null,
) {
  await recordFamilyEvent(db, { familyId: s.familyId, actorPosition, kind, studentId: s.id, now });
}

/** A friend the student may act on: a real friendship, not a sibling. */
async function requireFriend(db: Database, me: StudentRow, otherId: string) {
  if (!isId(otherId)) throw notAFriend();
  const other = await loadStudent(db, otherId);
  if (!other) throw notAFriend();
  if (other.familyId === me.familyId) throw siblingFriend();
  if (!(await areFriends(db, me.id, other.id))) throw notAFriend();
  return other;
}

const codeSchema = z.object({ code: z.string().trim().min(1).max(20) }).strict();
const reportSchema = z.object({ reason: z.enum(REPORT_REASONS) }).strict();
const hiddenSchema = z.object({ hidden: z.boolean() }).strict();
const allowedSchema = z.object({ allowed: z.boolean() }).strict();
const labelSchema = z.object({ label: z.string().max(100).nullable() }).strict();

/** How a request looks to one of the children. */
function waitingStatus(r: RequestRow, now: Date, studentId: string) {
  if (r.status === 'declined' || r.expiresAt <= now) return 'not_going_ahead';
  if (r.status !== 'child_confirm') return 'parents';
  // Only the child who typed the code confirms; the other waits for them.
  return r.toStudentId === studentId ? 'confirm' : 'friend_checking';
}

export function studentFriendRoutes(deps: FriendDeps) {
  const { db, clock } = deps;
  const app = new Hono<AppEnv>();
  // Only these paths: this app is mounted on /v1/student with the other student routes.
  for (const path of ['/friends', '/friends/*', '/league', '/league/*']) {
    app.use(path, requireFriendsOn(deps));
  }

  const me = async (studentId: string) => (await loadStudent(db, studentId))!;

  app.get('/friends', async (c) => {
    const now = clock.now();
    const self = await me(c.var.student.studentId);
    if (!self.friendsAllowed) {
      return c.json({ allowed: false, hidden: self.leagueHidden, friends: [], waiting: [] });
    }
    const { friends, siblings: sibs } = await friendsOf(db, self);
    const requests = await db
      .select()
      .from(friendRequests)
      .where(
        and(
          or(eq(friendRequests.fromStudentId, self.id), eq(friendRequests.toStudentId, self.id)),
          ne(friendRequests.status, 'started'),
        ),
      );
    const waiting = [];
    for (const r of requests) {
      const other = await loadStudent(
        db,
        r.fromStudentId === self.id ? r.toStudentId : r.fromStudentId,
      );
      if (!other) continue;
      waiting.push({
        requestId: r.id,
        nickname: other.nickname,
        avatarCode: other.avatarCode,
        status: waitingStatus(r, now, self.id),
      });
    }
    return c.json({
      allowed: true,
      hidden: self.leagueHidden,
      friends: [
        ...sibs.map((s) => ({ id: s.id, ...card(s), sibling: true })),
        ...friends.map((s) => ({ id: s.id, ...card(s), sibling: false })),
      ],
      waiting,
    });
  });

  app.post('/friends/codes', async (c) => {
    const now = clock.now();
    const self = await me(c.var.student.studentId);
    if (!self.friendsAllowed) throw friendsOff();
    const [made] = await db
      .select({ n: count() })
      .from(friendCodes)
      .where(
        and(
          eq(friendCodes.studentId, self.id),
          gt(friendCodes.createdAt, new Date(now.getTime() - DAY_MS)),
        ),
      );
    if ((made?.n ?? 0) >= FRIEND_CODES_PER_DAY) {
      throw new ApiError(429, 'code_limit', 'You can make 3 codes a day. Try again tomorrow.');
    }
    if ((await openRequests(db, self.id, now)).length >= MAX_WAITING_REQUESTS) {
      throw new ApiError(
        409,
        'waiting_limit',
        'You have 3 friend requests waiting. Wait for those first.',
      );
    }
    if ((await friendCount(db, self)) >= MAX_FRIENDS) {
      throw new ApiError(409, 'friends_full', 'You already have 10 friends.');
    }
    const code = newFriendCode(deps.randomBytes);
    const expiresAt = new Date(now.getTime() + FRIEND_CODE_TTL_MS);
    await db.insert(friendCodes).values({
      studentId: self.id,
      codeHash: await hashToken(code),
      expiresAt,
      createdAt: now,
    });
    return c.json({ code: formatFriendCode(code), expiresAt: expiresAt.toISOString() }, 201);
  });

  app.post('/friends/redeem', async (c) => {
    const { code } = await readJson(c, codeSchema);
    const now = clock.now();
    const self = await me(c.var.student.studentId);
    if (!self.friendsAllowed) throw friendsOff();
    const wrong = (
      since: number,
      col: typeof friendCodeTries.studentId | typeof friendCodeTries.familyId,
      id: string,
    ) =>
      db
        .select({ n: count() })
        .from(friendCodeTries)
        .where(
          and(
            eq(col, id),
            eq(friendCodeTries.ok, false),
            gt(friendCodeTries.createdAt, new Date(now.getTime() - since)),
          ),
        );
    const [mine] = await wrong(HOUR_MS, friendCodeTries.studentId, self.id);
    const [family] = await wrong(DAY_MS, friendCodeTries.familyId, self.familyId);
    if (
      (mine?.n ?? 0) >= WRONG_CODE_TRIES_PER_HOUR ||
      (family?.n ?? 0) >= FAMILY_CODE_TRIES_PER_DAY
    ) {
      throw tooManyTries();
    }
    const tried = (ok: boolean) =>
      db
        .insert(friendCodeTries)
        .values({ studentId: self.id, familyId: self.familyId, ok, createdAt: now });

    const [found] = await db
      .select()
      .from(friendCodes)
      .where(
        and(
          eq(friendCodes.codeHash, await hashToken(normaliseFriendCode(code))),
          isNull(friendCodes.usedAt),
          gt(friendCodes.expiresAt, now),
        ),
      );
    // Waiting-request limit for this child (review fix, FL4-fix): checked before the code is
    // used, so the code still works for someone else. Not counted as a wrong try.
    if ((await openRequests(db, self.id, now)).length >= MAX_WAITING_REQUESTS) {
      throw new ApiError(
        409,
        'waiting_limit',
        'You have 3 friend requests waiting. Wait for those first.',
      );
    }
    const owner = found ? await loadStudent(db, found.studentId) : undefined;
    const ownerFull =
      owner && (await openRequests(db, owner.id, now)).length >= MAX_WAITING_REQUESTS;
    if (!found || !owner || ownerFull || !(await canBefriend(db, self, owner, now))) {
      await tried(false);
      throw codeNotValid();
    }
    // Use the code first, so two children cannot both use it.
    const used = await db
      .update(friendCodes)
      .set({ usedAt: now })
      .where(and(eq(friendCodes.id, found.id), isNull(friendCodes.usedAt)))
      .returning({ id: friendCodes.id });
    if (used.length === 0) {
      await tried(false);
      throw codeNotValid();
    }
    await tried(true);
    const [request] = await db
      .insert(friendRequests)
      .values({
        fromStudentId: owner.id,
        toStudentId: self.id,
        expiresAt: new Date(now.getTime() + FRIEND_REQUEST_TTL_MS),
        createdAt: now,
      })
      .returning({ id: friendRequests.id });
    return c.json({ requestId: request!.id, friend: card(owner) }, 201);
  });

  const ownRequest = async (studentId: string, id: string) => {
    if (!isId(id)) throw notFound('Request not found');
    const [r] = await db.select().from(friendRequests).where(eq(friendRequests.id, id));
    if (!r || (r.fromStudentId !== studentId && r.toStudentId !== studentId)) {
      throw notFound('Request not found');
    }
    return r;
  };

  app.post('/friends/requests/:id/confirm', async (c) => {
    const now = clock.now();
    const self = await me(c.var.student.studentId);
    const r = await ownRequest(self.id, c.req.param('id'));
    if (r.toStudentId !== self.id || r.status !== 'child_confirm' || r.expiresAt <= now) {
      throw requestClosed();
    }
    await db.update(friendRequests).set({ status: 'parents' }).where(eq(friendRequests.id, r.id));
    // Both families' parents are asked to approve.
    const from = await loadStudent(db, r.fromStudentId);
    if (from) await logFor(db, from, 'friend_requested', now);
    await logFor(db, self, 'friend_requested', now);
    return c.json({ status: 'parents' });
  });

  app.post('/friends/requests/:id/cancel', async (c) => {
    const now = clock.now();
    const self = await me(c.var.student.studentId);
    const r = await ownRequest(self.id, c.req.param('id'));
    if (r.status === 'started' || r.status === 'declined') throw requestClosed();
    await db
      .update(friendRequests)
      .set({ status: 'declined', endedAt: now })
      .where(eq(friendRequests.id, r.id));
    return c.json({ status: 'not_going_ahead' });
  });

  app.delete('/friends/:id', async (c) => {
    const now = clock.now();
    const self = await me(c.var.student.studentId);
    const other = await requireFriend(db, self, c.req.param('id'));
    await unfriend(db, self.id, other.id, now);
    await logFor(db, self, 'friend_ended', now);
    await logFor(db, other, 'friend_ended', now);
    return c.body(null, 204);
  });

  app.post('/friends/:id/block', async (c) => {
    const now = clock.now();
    const self = await me(c.var.student.studentId);
    const other = await requireFriend(db, self, c.req.param('id'));
    await block(db, self.id, other.id, now);
    await logFor(db, self, 'friend_blocked_by_child', now);
    await logFor(db, other, 'friend_ended', now);
    return c.body(null, 204);
  });

  app.post('/friends/:id/report', async (c) => {
    const now = clock.now();
    const self = await me(c.var.student.studentId);
    const other = await requireFriend(db, self, c.req.param('id'));
    const { reason } = await readJson(c, reportSchema);
    await block(db, self.id, other.id, now);
    await db
      .insert(friendReports)
      .values({ reporterId: self.id, reportedId: other.id, reason, createdAt: now });
    await logFor(db, self, 'friend_reported', now);
    await logFor(db, other, 'friend_reported_about', now);
    return c.json({ reported: true }, 201);
  });

  app.get('/league', async (c) => {
    const self = await me(c.var.student.studentId);
    return c.json(await leagueFor(db, self, clock.now()));
  });

  app.put('/league/hidden', async (c) => {
    const { hidden } = await readJson(c, hiddenSchema);
    await db
      .update(students)
      .set({ leagueHidden: hidden })
      .where(eq(students.id, c.var.student.studentId));
    return c.json({ hidden });
  });

  return app;
}

export function parentFriendRoutes(deps: FriendDeps) {
  const { db, clock } = deps;
  const app = new Hono<AppEnv>();
  for (const path of ['/:id/friends', '/:id/friends/*']) app.use(path, requireFriendsOn(deps));

  const child = async (familyId: string, id: string) => {
    await requireFamilyStudent(db, familyId, id);
    return (await loadStudent(db, id))!;
  };

  app.get('/:id/friends', async (c) => {
    const now = clock.now();
    const self = await child(c.var.parent.familyId, c.req.param('id'));
    const { friends, siblings: sibs } = await friendsOf(db, self);
    const links = await db
      .select()
      .from(friendships)
      .where(or(eq(friendships.studentA, self.id), eq(friendships.studentB, self.id)));
    const linkOf = (otherId: string) =>
      links.find((l) => l.studentA === otherId || l.studentB === otherId);
    const requests = await db
      .select()
      .from(friendRequests)
      .where(
        and(
          or(eq(friendRequests.fromStudentId, self.id), eq(friendRequests.toStudentId, self.id)),
          eq(friendRequests.status, 'parents'),
          gt(friendRequests.expiresAt, now),
        ),
      );
    type Waiting = { requestId: string } & ReturnType<typeof card>;
    const waitingForYou: Waiting[] = [];
    const waitingForOther: Waiting[] = [];
    for (const r of requests) {
      const mine = r.fromStudentId === self.id;
      const other = await loadStudent(db, mine ? r.toStudentId : r.fromStudentId);
      if (!other) continue;
      const entry = { requestId: r.id, ...card(other) };
      const approved = mine ? r.fromApprovedBy : r.toApprovedBy;
      (approved === null ? waitingForYou : waitingForOther).push(entry);
    }
    const blocks = await db
      .select({ id: students.id, nickname: students.nickname })
      .from(friendBlocks)
      .innerJoin(students, eq(students.id, friendBlocks.blockedId))
      .where(eq(friendBlocks.blockerId, self.id));
    const reportRows = await db
      .select()
      .from(friendReports)
      .where(or(eq(friendReports.reporterId, self.id), eq(friendReports.reportedId, self.id)));
    const reports = [];
    for (const r of reportRows) {
      const reporter = await loadStudent(db, r.reporterId);
      const reported = await loadStudent(db, r.reportedId);
      reports.push({
        id: r.id,
        direction: r.reporterId === self.id ? 'made' : 'about',
        reason: r.reason,
        reporter: reporter?.nickname ?? null,
        reported: reported?.nickname ?? null,
        at: r.createdAt.toISOString(),
        closed: r.closedAt !== null,
      });
    }
    return c.json({
      allowed: self.friendsAllowed,
      hidden: self.leagueHidden,
      friends: [
        ...sibs.map((s) => ({ id: s.id, ...card(s), sibling: true, since: null, label: null })),
        ...friends.map((s) => {
          const link = linkOf(s.id)!;
          return {
            id: s.id,
            ...card(s),
            sibling: false,
            since: link.createdAt.toISOString(),
            label: (link.studentA === self.id ? link.labelA : link.labelB) ?? null,
          };
        }),
      ],
      waitingForYou,
      waitingForOther,
      blocked: blocks,
      reports,
    });
  });

  app.put('/:id/friends/allowed', async (c) => {
    const { allowed } = await readJson(c, allowedSchema);
    const self = await child(c.var.parent.familyId, c.req.param('id'));
    // Settle finished weeks while the child's friends still count (FL4-fix).
    if (!allowed) await settleLeagueWeeks(db, self, clock.now());
    await db.update(students).set({ friendsAllowed: allowed }).where(eq(students.id, self.id));
    await logFor(
      db,
      self,
      allowed ? 'friends_allowed' : 'friends_turned_off',
      clock.now(),
      c.var.parent.position,
    );
    return c.json({ allowed });
  });

  const parentRequest = async (familyId: string, studentId: string, id: string) => {
    const self = await child(familyId, studentId);
    if (!isId(id)) throw notFound('Request not found');
    const [r] = await db.select().from(friendRequests).where(eq(friendRequests.id, id));
    if (!r || (r.fromStudentId !== self.id && r.toStudentId !== self.id)) {
      throw notFound('Request not found');
    }
    return { self, r };
  };

  app.post('/:id/friends/requests/:rid/approve', async (c) => {
    const now = clock.now();
    const { position, familyId } = c.var.parent;
    const { self, r } = await parentRequest(familyId, c.req.param('id'), c.req.param('rid'));
    if (r.status !== 'parents' || r.expiresAt <= now) throw requestClosed();
    const side = r.fromStudentId === self.id ? 'from' : 'to';
    const status = await approveRequest(db, r, side, position, now);
    await logFor(db, self, 'friend_approved', now, position);
    if (status === 'closed') throw requestClosed();
    return c.json({ status });
  });

  app.post('/:id/friends/requests/:rid/decline', async (c) => {
    const now = clock.now();
    const { self, r } = await parentRequest(
      c.var.parent.familyId,
      c.req.param('id'),
      c.req.param('rid'),
    );
    if (r.status === 'started' || r.status === 'declined') throw requestClosed();
    await db
      .update(friendRequests)
      .set({ status: 'declined', endedAt: now })
      .where(eq(friendRequests.id, r.id));
    await logFor(db, self, 'friend_declined', now, c.var.parent.position);
    return c.json({ status: 'declined' });
  });

  // The reporting child's parents mark a report as dealt with; it is then kept 12 months.
  app.post('/:id/friends/reports/:reportId/close', async (c) => {
    const self = await child(c.var.parent.familyId, c.req.param('id'));
    const reportId = c.req.param('reportId');
    if (!isId(reportId)) throw notFound('Report not found');
    const closed = await db
      .update(friendReports)
      .set({ closedAt: clock.now() })
      .where(and(eq(friendReports.id, reportId), eq(friendReports.reporterId, self.id)))
      .returning({ id: friendReports.id });
    if (closed.length === 0) throw notFound('Report not found');
    return c.json({ closed: true });
  });

  app.delete('/:id/friends/blocks/:otherId', async (c) => {
    const self = await child(c.var.parent.familyId, c.req.param('id'));
    const otherId = c.req.param('otherId');
    if (!isId(otherId)) throw notFound('Block not found');
    const gone = await db
      .delete(friendBlocks)
      .where(and(eq(friendBlocks.blockerId, self.id), eq(friendBlocks.blockedId, otherId)))
      .returning({ id: friendBlocks.blockedId });
    if (gone.length === 0) throw notFound('Block not found');
    await logFor(db, self, 'friend_unblocked', clock.now(), c.var.parent.position);
    return c.body(null, 204);
  });

  app.delete('/:id/friends/:otherId', async (c) => {
    const now = clock.now();
    const self = await child(c.var.parent.familyId, c.req.param('id'));
    const other = await requireFriend(db, self, c.req.param('otherId'));
    await unfriend(db, self.id, other.id, now);
    await logFor(db, self, 'friend_removed', now, c.var.parent.position);
    await logFor(db, other, 'friend_ended', now);
    return c.body(null, 204);
  });

  app.post('/:id/friends/:otherId/block', async (c) => {
    const now = clock.now();
    const self = await child(c.var.parent.familyId, c.req.param('id'));
    const other = await requireFriend(db, self, c.req.param('otherId'));
    await block(db, self.id, other.id, now);
    await logFor(db, self, 'friend_blocked', now, c.var.parent.position);
    await logFor(db, other, 'friend_ended', now);
    return c.body(null, 204);
  });

  app.put('/:id/friends/:otherId/label', async (c) => {
    const { label } = await readJson(c, labelSchema);
    const self = await child(c.var.parent.familyId, c.req.param('id'));
    const other = await requireFriend(db, self, c.req.param('otherId'));
    const text = label === null ? null : label.trim();
    if (text !== null) {
      if (!validFriendLabel(text)) {
        throw new ApiError(400, 'invalid_label', 'Use 1 to 30 characters on one line.');
      }
      // Like feedback text: no email address or phone number (no profile needed for that).
      if (containsPersonalData(text, [])) throw personalDetails();
    }
    const [a, b] = pair(self.id, other.id);
    await db
      .update(friendships)
      .set(self.id === a ? { labelA: text } : { labelB: text })
      .where(and(eq(friendships.studentA, a), eq(friendships.studentB, b)));
    return c.json({ label: text });
  });

  return app;
}

/**
 * A child's friends data for the family export: nicknames only for the other children (what
 * this family's parents already see), never their ids or anything about their family.
 */
export async function friendsExport(db: Database, studentId: string) {
  const links = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.studentA, studentId), eq(friendships.studentB, studentId)));
  const nick = async (id: string) => (await loadStudent(db, id))?.nickname ?? null;
  const friendshipsOut = [];
  for (const l of links) {
    const mine = l.studentA === studentId;
    friendshipsOut.push({
      nickname: await nick(mine ? l.studentB : l.studentA),
      since: l.createdAt.toISOString(),
      label: (mine ? l.labelA : l.labelB) ?? null,
    });
  }
  const requests = await db
    .select()
    .from(friendRequests)
    .where(
      and(
        or(eq(friendRequests.fromStudentId, studentId), eq(friendRequests.toStudentId, studentId)),
        openStatus,
      ),
    );
  const requestsOut = [];
  for (const r of requests) {
    const mine = r.fromStudentId === studentId;
    requestsOut.push({
      nickname: await nick(mine ? r.toStudentId : r.fromStudentId),
      madeTheCode: mine,
      status: r.status,
      expiresAt: r.expiresAt.toISOString(),
    });
  }
  const blocks = await db
    .select({ id: friendBlocks.blockedId, at: friendBlocks.createdAt })
    .from(friendBlocks)
    .where(eq(friendBlocks.blockerId, studentId));
  const blocked = [];
  for (const b of blocks) blocked.push({ nickname: await nick(b.id), since: b.at.toISOString() });
  const reportRows = await db
    .select()
    .from(friendReports)
    .where(or(eq(friendReports.reporterId, studentId), eq(friendReports.reportedId, studentId)));
  const reports = [];
  for (const r of reportRows) {
    reports.push({
      direction: r.reporterId === studentId ? 'made' : 'about',
      reason: r.reason,
      reporter: await nick(r.reporterId),
      reported: await nick(r.reportedId),
      at: r.createdAt.toISOString(),
    });
  }
  return { friendships: friendshipsOut, requests: requestsOut, blocked, reports };
}

/**
 * For the daily clean-up (cleanup.ts): codes once used or expired; code tries after a day;
 * requests a day after they started, were declined or ran out (so "didn't go ahead" shows).
 */
export async function deleteExpiredFriendRecords(db: Database, now: Date) {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const codes = await db
    .delete(friendCodes)
    .where(or(isNotNull(friendCodes.usedAt), lt(friendCodes.expiresAt, now)))
    .returning({ id: friendCodes.id });
  const tries = await db
    .delete(friendCodeTries)
    .where(lt(friendCodeTries.createdAt, dayAgo))
    .returning({ id: friendCodeTries.id });
  const requests = await db
    .delete(friendRequests)
    .where(or(lt(friendRequests.endedAt, dayAgo), lt(friendRequests.expiresAt, dayAgo)))
    .returning({ id: friendRequests.id });
  // League results are kept for the last 8 finished weeks; the win count stays on the student.
  const oldest = previousLeagueWeeks(now, LEAGUE_WEEKS_KEPT).at(-1)!.start;
  const weeks = await db
    .delete(leagueWeeks)
    .where(lt(leagueWeeks.weekStart, oldest))
    .returning({ id: leagueWeeks.studentId });
  // Reports are kept 12 months after they are closed (docs/FRIENDS_LEAGUE.md section 8).
  const reports = await db
    .delete(friendReports)
    .where(lt(friendReports.closedAt, new Date(now.getTime() - REPORT_KEPT_DAYS * DAY_MS)))
    .returning({ id: friendReports.id });
  return {
    friendReportsDeleted: reports.length,
    leagueWeeksDeleted: weeks.length,
    friendCodesDeleted: codes.length,
    friendCodeTriesDeleted: tries.length,
    friendRequestsDeleted: requests.length,
  };
}
