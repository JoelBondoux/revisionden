/**
 * Family activity log (docs/PRODUCT_RULES.md "Two parents"): what changed and which parent did
 * it, named only "Parent 1" or "Parent 2". Important changes are shown as new to the other parent
 * in the parent home, and pushed to them if they turned parent push on (the push is empty; the
 * service worker fetches the text from GET /v1/parent/notifications/latest).
 */
import type { MiddlewareHandler } from 'hono';
import { and, desc, eq, gt, inArray, isNull, ne, or } from 'drizzle-orm';
import {
  familyEvents,
  parentPushSubscriptions,
  parents,
  students,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from './context';
import type { Clock } from './rate-limit';
import {
  DEFAULT_REMINDER_SETTINGS,
  isNightlyQuietTime,
  localClock,
} from './notifications/schedule';
import type { PushSender } from './notifications/web-push';

interface Kind {
  /** What the parent did, after "Parent 1" or "You". `{nickname}` is the child, if any. */
  what: string;
  /** Important changes are shown as new to the other parent and pushed to them. */
  important: boolean;
  /** Noticed by RevisionDen, not done by a parent: shown and pushed to both parents. */
  system?: true;
}

export const EVENT_KINDS = {
  child_added: { what: 'added {nickname}', important: true },
  child_removed: { what: 'removed a child', important: true },
  child_changed: { what: "changed {nickname}'s profile", important: false },
  subjects_changed: { what: "changed {nickname}'s subjects", important: false },
  avatar_changed: { what: "changed {nickname}'s avatar", important: false },
  device_link_started: { what: 'started linking a device for {nickname}', important: false },
  device_unlinked: { what: 'unlinked a device from {nickname}', important: false },
  reminders_changed: { what: "changed {nickname}'s reminders", important: false },
  limit_changed: { what: "changed {nickname}'s daily limit", important: true },
  reward_set: { what: 'set a reward for {nickname}', important: false },
  reward_changed: { what: 'changed a reward for {nickname}', important: false },
  reward_removed: { what: 'removed a reward for {nickname}', important: false },
  reward_given: { what: 'gave {nickname} a reward', important: true },
  data_exported: { what: "downloaded the family's data", important: true },
  deletion_requested: { what: 'asked to delete the family account', important: true },
  deletion_cancelled: { what: 'cancelled deleting the family account', important: true },
  parent_invited: { what: 'invited a second parent', important: false },
  parent_joined: { what: 'joined as a parent', important: true },
  parent_removed: { what: 'removed the other parent', important: true },
  // Synced passkeys (I5b): the child's passkey unlocked a device RevisionDen had not seen.
  passkey_new_device: {
    what: "noticed {nickname}'s passkey being used on a new device",
    important: true,
    system: true,
  },
} satisfies Record<string, Kind>;

export type EventKind = keyof typeof EVENT_KINDS;

export const parentLabel = (position: number | null) =>
  position === null ? null : `Parent ${position}`;

const isSystemKind = (kind: string) => (EVENT_KINDS as Record<string, Kind>)[kind]?.system === true;

/** Who the log names for a change: Parent 1, Parent 2, or RevisionDen for what it noticed. */
const actorLabel = (kind: string, position: number | null) =>
  parentLabel(position) ?? (isSystemKind(kind) ? 'RevisionDen' : null);

export function describeEvent(kind: string, nickname: string | null): string {
  const known = (EVENT_KINDS as Record<string, Kind>)[kind];
  if (!known) return 'made a change';
  return known.what.replace('{nickname}', nickname ?? 'a child');
}

export async function recordFamilyEvent(
  db: Database,
  event: {
    familyId: string;
    actorPosition: number | null;
    kind: EventKind;
    studentId?: string | null;
    now: Date;
  },
): Promise<void> {
  await db.insert(familyEvents).values({
    familyId: event.familyId,
    actorPosition: event.actorPosition,
    kind: event.kind,
    studentId: event.studentId ?? null,
    important: EVENT_KINDS[event.kind].important,
    createdAt: event.now,
  });
}

/** Parent routes that change family data, and the log entry each one makes when it works. */
const LOGGED_CHANGES: [method: string, pattern: RegExp, kind: EventKind][] = [
  ['POST', /^\/v1\/students$/, 'child_added'],
  ['POST', /^\/v1\/onboarding\/children$/, 'child_added'],
  ['DELETE', /^\/v1\/students\/([^/]+)$/, 'child_removed'],
  ['PATCH', /^\/v1\/students\/([^/]+)$/, 'child_changed'],
  ['POST', /^\/v1\/students\/([^/]+)\/enrolments$/, 'subjects_changed'],
  ['DELETE', /^\/v1\/students\/([^/]+)\/enrolments\/[^/]+$/, 'subjects_changed'],
  ['PUT', /^\/v1\/students\/([^/]+)\/avatar$/, 'avatar_changed'],
  ['POST', /^\/v1\/students\/([^/]+)\/link-tokens$/, 'device_link_started'],
  ['DELETE', /^\/v1\/students\/([^/]+)\/devices\/[^/]+$/, 'device_unlinked'],
  ['PUT', /^\/v1\/students\/([^/]+)\/reminder-settings$/, 'reminders_changed'],
  ['PUT', /^\/v1\/students\/([^/]+)\/daily-limit$/, 'limit_changed'],
  ['POST', /^\/v1\/students\/([^/]+)\/parent-rewards$/, 'reward_set'],
  ['PATCH', /^\/v1\/students\/([^/]+)\/parent-rewards\/[^/]+$/, 'reward_changed'],
  ['DELETE', /^\/v1\/students\/([^/]+)\/parent-rewards\/[^/]+$/, 'reward_removed'],
  ['POST', /^\/v1\/students\/([^/]+)\/parent-rewards\/[^/]+\/given$/, 'reward_given'],
];

function matchChange(method: string, path: string) {
  for (const [m, pattern, kind] of LOGGED_CHANGES) {
    if (m !== method) continue;
    const hit = pattern.exec(path);
    if (hit) return { kind, studentId: hit[1] ?? null };
  }
  return undefined;
}

/** The id of the child a successful "add a child" response names. */
async function addedStudentId(res: Response): Promise<string | null> {
  try {
    const body = (await res.clone().json()) as { id?: string; student?: { id?: string } };
    return body.student?.id ?? body.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Runs after the parent guard on every parent route: logs the change once the route has worked.
 * Routes that log for themselves (family, export) are not in the table.
 */
export function logFamilyChanges({
  db,
  clock,
}: {
  db: Database;
  clock: Clock;
}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const change = matchChange(c.req.method, c.req.path);
    await next();
    const parent = c.get('parent');
    if (!change || !parent || c.res.status >= 300) return;
    let studentId = change.studentId;
    if (change.kind === 'child_added') studentId = await addedStudentId(c.res);
    // A removed child is not named: their earlier rows go with them.
    if (change.kind === 'child_removed') studentId = null;
    if (studentId) {
      const [own] = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.id, studentId), eq(students.familyId, parent.familyId)));
      if (!own) studentId = null;
    }
    await recordFamilyEvent(db, {
      familyId: parent.familyId,
      actorPosition: parent.position,
      kind: change.kind,
      studentId,
      now: clock.now(),
    });
  };
}

/** The log as the given parent sees it: newest first, at most 100 rows. */
export async function listFamilyEvents(
  db: Database,
  viewer: { familyId: string; position: number; since: Date },
) {
  const rows = await db
    .select({
      id: familyEvents.id,
      kind: familyEvents.kind,
      actorPosition: familyEvents.actorPosition,
      important: familyEvents.important,
      createdAt: familyEvents.createdAt,
      nickname: students.nickname,
    })
    .from(familyEvents)
    .leftJoin(students, eq(students.id, familyEvents.studentId))
    .where(eq(familyEvents.familyId, viewer.familyId))
    .orderBy(desc(familyEvents.seq))
    .limit(100);
  const events = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    by: actorLabel(r.kind, r.actorPosition),
    you: r.actorPosition === viewer.position,
    what: describeEvent(r.kind, r.nickname),
    important: r.important,
    createdAt: r.createdAt.toISOString(),
    isNew: r.important && r.actorPosition !== viewer.position && r.createdAt > viewer.since,
  }));
  return { events, newFromOtherParent: events.filter((e) => e.isNew).length };
}

/** How long after a change a push is still worth sending. */
const PUSH_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The text shown for the latest important change by the other parent, if pushed recently. */
export async function latestFamilyEventMessage(
  db: Database,
  viewer: { familyId: string; position: number },
  since: Date,
): Promise<{ message: string; at: Date } | null> {
  const [row] = await db
    .select({
      kind: familyEvents.kind,
      actorPosition: familyEvents.actorPosition,
      pushedAt: familyEvents.pushedAt,
      nickname: students.nickname,
    })
    .from(familyEvents)
    .leftJoin(students, eq(students.id, familyEvents.studentId))
    .where(
      and(
        eq(familyEvents.familyId, viewer.familyId),
        eq(familyEvents.important, true),
        gt(familyEvents.pushedAt, since),
        or(isNull(familyEvents.actorPosition), ne(familyEvents.actorPosition, viewer.position)),
      ),
    )
    .orderBy(desc(familyEvents.pushedAt), desc(familyEvents.seq))
    .limit(1);
  if (!row?.pushedAt) return null;
  const who = parentLabel(row.actorPosition) ?? 'RevisionDen';
  return { message: `${who} ${describeEvent(row.kind, row.nickname)}`, at: row.pushedAt };
}

export interface FamilyEventPushSummary {
  events: number;
  pushes: number;
  removed: number;
}

/**
 * Cron step: pushes each new important change to the other parent's devices, once. Waits out
 * the default nightly quiet hours (UK time); changes older than a day are not pushed.
 */
export async function runFamilyEventNotifications(deps: {
  db: Database;
  now: Date;
  sender: PushSender;
}): Promise<FamilyEventPushSummary> {
  const { db, now, sender } = deps;
  const summary: FamilyEventPushSummary = { events: 0, pushes: 0, removed: 0 };
  const settings = DEFAULT_REMINDER_SETTINGS;
  if (isNightlyQuietTime(localClock(now, settings.timeZone).time, settings)) return summary;

  const due = await db
    .select({
      id: familyEvents.id,
      familyId: familyEvents.familyId,
      actorPosition: familyEvents.actorPosition,
    })
    .from(familyEvents)
    .where(
      and(
        eq(familyEvents.important, true),
        isNull(familyEvents.pushedAt),
        gt(familyEvents.createdAt, new Date(now.getTime() - PUSH_WINDOW_MS)),
      ),
    );
  for (const event of due) {
    const claimed = await db
      .update(familyEvents)
      .set({ pushedAt: now })
      .where(and(eq(familyEvents.id, event.id), isNull(familyEvents.pushedAt)))
      .returning({ id: familyEvents.id });
    if (claimed.length === 0) continue;
    summary.events += 1;
    const targets = await db
      .select({
        id: parentPushSubscriptions.id,
        endpoint: parentPushSubscriptions.endpoint,
        p256dh: parentPushSubscriptions.p256dh,
        auth: parentPushSubscriptions.auth,
      })
      .from(parentPushSubscriptions)
      .innerJoin(parents, eq(parents.id, parentPushSubscriptions.parentId))
      .where(
        and(
          eq(parents.familyId, event.familyId),
          event.actorPosition === null ? undefined : ne(parents.position, event.actorPosition),
        ),
      );
    const gone: string[] = [];
    for (const target of targets) {
      const result = await sender.send(target);
      if (result === 'sent') summary.pushes += 1;
      if (result === 'gone') gone.push(target.id);
    }
    if (gone.length > 0) {
      await db.delete(parentPushSubscriptions).where(inArray(parentPushSubscriptions.id, gone));
      summary.removed += gone.length;
    }
  }
  return summary;
}
