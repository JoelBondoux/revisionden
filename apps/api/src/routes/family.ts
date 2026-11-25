/**
 * Family account activity, under /v1/family (parent session checked by the caller).
 *
 * Every parent or student request records that the family is in use (at most once an hour).
 * Families nobody uses for 12 months are deleted by the scheduled clean-up (cleanup.ts). A
 * parent who comes back after 11 months or more without use is shown a warning.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { and, eq, lt, sql } from 'drizzle-orm';
import { families, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import type { Clock } from '../rate-limit';
import {
  INACTIVE_DELETE_AFTER_MONTHS,
  INACTIVE_WARNING_AFTER_MONTHS,
  monthsBefore,
} from '../cleanup';

const HOUR_MS = 60 * 60 * 1000;

const monthsAfter = (date: Date, months: number) => monthsBefore(date, -months);

/** Marks the family as used now, unless that was already done in the last hour. */
export async function recordActivity(db: Database, familyId: string, now: Date): Promise<void> {
  await db
    .update(families)
    .set({ previousActiveAt: sql`${families.lastActiveAt}`, lastActiveAt: now })
    .where(
      and(eq(families.id, familyId), lt(families.lastActiveAt, new Date(now.getTime() - HOUR_MS))),
    );
}

/** Middleware for student routes: runs after the student session check. */
export function studentActivity({
  db,
  clock,
}: {
  db: Database;
  clock: Clock;
}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await recordActivity(db, c.var.student.familyId, clock.now());
    await next();
  };
}

/** What the parent area shows about automatic deletion of unused accounts. */
export function inactivityView(row: { lastActiveAt: Date; previousActiveAt: Date | null }) {
  const gapWarns =
    row.previousActiveAt !== null &&
    row.previousActiveAt < monthsBefore(row.lastActiveAt, INACTIVE_WARNING_AFTER_MONTHS);
  return {
    lastUsedAt: row.lastActiveAt.toISOString(),
    deletedIfUnusedAfter: monthsAfter(row.lastActiveAt, INACTIVE_DELETE_AFTER_MONTHS).toISOString(),
    warning:
      gapWarns && row.previousActiveAt
        ? {
            unusedSince: row.previousActiveAt.toISOString(),
            wouldHaveBeenDeletedOn: monthsAfter(
              row.previousActiveAt,
              INACTIVE_DELETE_AFTER_MONTHS,
            ).toISOString(),
          }
        : null,
  };
}

export function familyRoutes({ db }: { db: Database }) {
  const app = new Hono<AppEnv>();

  app.get('/activity', async (c) => {
    const [row] = await db
      .select({ lastActiveAt: families.lastActiveAt, previousActiveAt: families.previousActiveAt })
      .from(families)
      .where(eq(families.id, c.var.parent.familyId));
    return c.json(inactivityView(row!));
  });

  return app;
}
