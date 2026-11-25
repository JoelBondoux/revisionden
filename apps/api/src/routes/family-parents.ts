/**
 * Two parents (docs/PRODUCT_RULES.md "Two parents (shared parent control)"), under /v1/family
 * (parent session checked by the caller):
 *
 * - POST /invites: a one-time code and link for a second parent (7 days, 5 a day, hash only).
 * - POST /join: the signed-in parent joins the family as Parent 2 (or the free number).
 * - GET /parents, DELETE /parents/:position: who the parents are; remove the other parent.
 * - POST, DELETE /deletion: ask to delete (or confirm) the whole family; cancel.
 * - GET /events, POST /events/seen: the family activity log.
 *
 * Both parents have equal control: every parent route works from `c.var.parent.familyId`.
 */
import { Hono } from 'hono';
import { and, count, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  families,
  parentInvites,
  parentRemovalNotices,
  parents,
  students,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import { ApiError, notFound } from '../errors';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import { hashToken } from '../tokens';
import { deleteFamilies } from '../cleanup';
import { listFamilyEvents, parentLabel, recordFamilyEvent } from '../family-events';

export const MAX_PARENTS = 2;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITES_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
// No 0/O, 1/I/L, so a code read aloud or typed is hard to get wrong.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;

export interface FamilyParentDeps {
  db: Database;
  config: AppConfig;
  clock: Clock;
  /** Injected in tests; defaults to crypto randomness. */
  randomBytes?: (n: number) => Uint8Array<ArrayBuffer>;
}

const joinSchema = z.object({ code: z.string().trim().min(1).max(40) }).strict();

const normalise = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function newInviteCode(
  randomBytes: (n: number) => Uint8Array<ArrayBuffer> = (n) =>
    crypto.getRandomValues(new Uint8Array(n)),
) {
  return Array.from(randomBytes(CODE_LENGTH), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    '',
  );
}

async function familyParents(db: Database, familyId: string) {
  return db
    .select({ id: parents.id, position: parents.position, createdAt: parents.createdAt })
    .from(parents)
    .where(eq(parents.familyId, familyId))
    .orderBy(parents.position);
}

const inviteNotFound = () =>
  new ApiError(
    404,
    'invite_not_found',
    'That code is not valid or has expired. Ask for a new one.',
  );
const familyFull = () => new ApiError(409, 'family_full', 'This family already has two parents.');

export function familyParentRoutes(deps: FamilyParentDeps) {
  const { db, config, clock } = deps;
  const app = new Hono<AppEnv>();

  app.post('/invites', async (c) => {
    const { familyId, parentId, position } = c.var.parent;
    const now = clock.now();
    if ((await familyParents(db, familyId)).length >= MAX_PARENTS) throw familyFull();
    const [made] = await db
      .select({ n: count() })
      .from(parentInvites)
      .where(
        and(
          eq(parentInvites.familyId, familyId),
          gt(parentInvites.createdAt, new Date(now.getTime() - DAY_MS)),
        ),
      );
    if ((made?.n ?? 0) >= INVITES_PER_DAY) {
      throw new ApiError(429, 'invite_limit', 'You can make 5 invites a day. Try again tomorrow.');
    }
    const code = newInviteCode(deps.randomBytes);
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
    await db.insert(parentInvites).values({
      familyId,
      codeHash: await hashToken(code),
      createdByParentId: parentId,
      expiresAt,
      createdAt: now,
    });
    await recordFamilyEvent(db, { familyId, actorPosition: position, kind: 'parent_invited', now });
    const link = new URL('/join', config.webOrigin);
    link.searchParams.set('code', code);
    return c.json({ code, link: link.toString(), expiresAt: expiresAt.toISOString() }, 201);
  });

  app.post('/join', async (c) => {
    const { code } = await readJson(c, joinSchema);
    const me = c.var.parent;
    const now = clock.now();
    const [invite] = await db
      .select()
      .from(parentInvites)
      .where(
        and(
          eq(parentInvites.codeHash, await hashToken(normalise(code))),
          isNull(parentInvites.usedAt),
          gt(parentInvites.expiresAt, now),
        ),
      );
    if (!invite) throw inviteNotFound();
    if (invite.familyId === me.familyId) {
      throw new ApiError(
        409,
        'own_family',
        'This code is for your own family. Send it to the other parent.',
      );
    }
    // The joining parent's own family (made on first sign-in) must be empty: no children and
    // no other parent. Then it is dropped and they move to the inviting family.
    const [kids] = await db
      .select({ n: count() })
      .from(students)
      .where(eq(students.familyId, me.familyId));
    const others = (await familyParents(db, me.familyId)).filter((p) => p.id !== me.parentId);
    if ((kids?.n ?? 0) > 0 || others.length > 0) {
      throw new ApiError(
        409,
        'already_in_family',
        'This account already has its own family. Delete it first to join another one.',
      );
    }
    const taken = new Set((await familyParents(db, invite.familyId)).map((p) => p.position));
    const free = [1, 2].find((p) => !taken.has(p));
    if (free === undefined) throw familyFull();
    // Use the invite first, so two people with the same code cannot both join.
    const used = await db
      .update(parentInvites)
      .set({ usedAt: now })
      .where(and(eq(parentInvites.id, invite.id), isNull(parentInvites.usedAt)))
      .returning({ id: parentInvites.id });
    if (used.length === 0) throw inviteNotFound();
    const moved = await db
      .update(parents)
      .set({ familyId: invite.familyId, position: free, eventsSeenAt: now })
      .where(eq(parents.id, me.parentId))
      .returning({ id: parents.id })
      .catch(() => []);
    if (moved.length === 0) throw familyFull();
    await db.delete(families).where(eq(families.id, me.familyId));
    await recordFamilyEvent(db, {
      familyId: invite.familyId,
      actorPosition: free,
      kind: 'parent_joined',
      now,
    });
    return c.json({ familyId: invite.familyId, position: free });
  });

  app.get('/parents', async (c) => {
    const me = c.var.parent;
    const list = await familyParents(db, me.familyId);
    const [family] = await db.select().from(families).where(eq(families.id, me.familyId));
    return c.json({
      parents: list.map((p) => ({
        position: p.position,
        label: parentLabel(p.position),
        you: p.id === me.parentId,
        joinedAt: p.createdAt.toISOString(),
      })),
      canInvite: list.length < MAX_PARENTS,
      deletionRequest:
        family?.deletionRequestedBy != null && family.deletionRequestedAt
          ? {
              by: parentLabel(family.deletionRequestedBy),
              byYou: family.deletionRequestedBy === me.position,
              at: family.deletionRequestedAt.toISOString(),
            }
          : null,
    });
  });

  app.delete('/parents/:position', async (c) => {
    const me = c.var.parent;
    const position = Number(c.req.param('position'));
    if (position === me.position) {
      throw new ApiError(400, 'cannot_remove_self', 'You cannot remove yourself.');
    }
    const [other] = await db
      .select({ id: parents.id, authUserId: parents.authUserId })
      .from(parents)
      .where(and(eq(parents.familyId, me.familyId), eq(parents.position, position)));
    if (!other) throw notFound('No such parent');
    const now = clock.now();
    await db
      .insert(parentRemovalNotices)
      .values({ authUserId: other.authUserId, removedAt: now })
      .onConflictDoUpdate({ target: parentRemovalNotices.authUserId, set: { removedAt: now } });
    // Their access ends here: the parent guard refuses anyone with a removal notice.
    await db.delete(parents).where(eq(parents.id, other.id));
    // A deletion request by the removed parent goes with them.
    await db
      .update(families)
      .set({ deletionRequestedBy: null, deletionRequestedAt: null })
      .where(and(eq(families.id, me.familyId), eq(families.deletionRequestedBy, position)));
    await recordFamilyEvent(db, {
      familyId: me.familyId,
      actorPosition: me.position,
      kind: 'parent_removed',
      now,
    });
    return c.body(null, 204);
  });

  app.post('/deletion', async (c) => {
    const me = c.var.parent;
    const now = clock.now();
    const list = await familyParents(db, me.familyId);
    const [family] = await db.select().from(families).where(eq(families.id, me.familyId));
    const otherAsked =
      family?.deletionRequestedBy != null && family.deletionRequestedBy !== me.position;
    if (list.length < MAX_PARENTS || otherAsked) {
      await deleteFamilies(db, [me.familyId]);
      return c.json({ deleted: true });
    }
    if (family?.deletionRequestedBy !== me.position) {
      await db
        .update(families)
        .set({ deletionRequestedBy: me.position, deletionRequestedAt: now })
        .where(eq(families.id, me.familyId));
      await recordFamilyEvent(db, {
        familyId: me.familyId,
        actorPosition: me.position,
        kind: 'deletion_requested',
        now,
      });
    }
    const other = list.find((p) => p.position !== me.position)!;
    return c.json({ deleted: false, waitingFor: parentLabel(other.position) }, 202);
  });

  app.delete('/deletion', async (c) => {
    const me = c.var.parent;
    const cancelled = await db
      .update(families)
      .set({ deletionRequestedBy: null, deletionRequestedAt: null })
      .where(and(eq(families.id, me.familyId), isNotNull(families.deletionRequestedBy)))
      .returning({ id: families.id });
    if (cancelled.length > 0) {
      await recordFamilyEvent(db, {
        familyId: me.familyId,
        actorPosition: me.position,
        kind: 'deletion_cancelled',
        now: clock.now(),
      });
    }
    return c.body(null, 204);
  });

  app.get('/events', async (c) => {
    const me = c.var.parent;
    const [row] = await db
      .select({ seen: parents.eventsSeenAt })
      .from(parents)
      .where(eq(parents.id, me.parentId));
    const since = row?.seen ?? new Date(0);
    return c.json(await listFamilyEvents(db, { ...me, since }));
  });

  app.post('/events/seen', async (c) => {
    await db
      .update(parents)
      .set({ eventsSeenAt: clock.now() })
      .where(eq(parents.id, c.var.parent.parentId));
    return c.body(null, 204);
  });

  return app;
}

/** Thrown by the parent guard for a parent the other parent removed. */
export const removedFromFamily = (removedAt: Date) =>
  new ApiError(
    403,
    'removed_from_family',
    `The other parent removed you from the family on ${removedAt.toISOString().slice(0, 10)}.`,
  );

export async function removalNotice(db: Database, authUserId: string) {
  const [row] = await db
    .select()
    .from(parentRemovalNotices)
    .where(eq(parentRemovalNotices.authUserId, authUserId));
  return row;
}
