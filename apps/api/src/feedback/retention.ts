import { and, isNotNull, lt } from 'drizzle-orm';
import { feedback, type Database } from '@revisionden/db';

/** The date 12 months before `now` (same day and time, a year earlier). */
export function twelveMonthsBefore(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return cutoff;
}

/** Deletes feedback closed more than 12 months ago; returns how many rows went. */
export async function deleteExpiredFeedback(db: Database, now: Date): Promise<number> {
  const deleted = await db
    .delete(feedback)
    .where(and(isNotNull(feedback.closedAt), lt(feedback.closedAt, twelveMonthsBefore(now))))
    .returning({ id: feedback.id });
  return deleted.length;
}
