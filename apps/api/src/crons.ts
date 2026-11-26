/**
 * The Worker's cron schedules (UTC). apps/api/wrangler.toml must list exactly these for
 * production; wrangler-config.test.ts checks that they match.
 *
 * Neon suspends an idle database after 5 minutes, so every tick that opens it wakes it. The
 * clean-up therefore runs once a day, and reminders only in UK waking hours.
 */

/** Deletes data past its retention period (cleanup.ts). 03:17 UTC, off the busy :00 mark. */
export const CLEANUP_CRON = '17 3 * * *';

/**
 * Reminders, parent reward news and family-change pushes, every 30 minutes from 06:30 to 20:30
 * UTC. Default quiet hours are 21:00 to 07:30 UK time, so reminders can only go out from 06:30
 * UTC (07:30 BST) to 20:59 UTC (20:59 GMT). The default reminder times (16:30, 19:00) land on a
 * tick; a time a parent sets goes at the next tick after it, up to 30 minutes late, or, when no
 * later tick that day is outside quiet hours, at the day's last tick (notifications/ticks.ts).
 * notifications/ticks.ts reads these strings, so keep them in its simple daily form.
 */
export const REMINDER_CRONS = ['30 6 * * *', '*/30 7-20 * * *'] as const;
