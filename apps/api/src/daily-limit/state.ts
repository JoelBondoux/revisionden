/**
 * Daily limit state for one student (workstream K7). The rules live in packages/core
 * (`daily-limit.ts`); this file loads and saves. Time is passed in.
 */
import { and, asc, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm';
import {
  DAILY_LIMIT_CEILINGS,
  DAILY_LIMIT_DEFAULTS,
  activeStudy,
  addDays,
  dailyLimitFor,
  levelForYear,
  limitStatus,
  localDate,
  restDays,
  studySessions,
  weeklySuggestion,
  zonedDayStart,
  type DailyLimitSettings,
  type DailyLimitToday,
  type Level,
  type LimitSuggestion,
  type ParentDailyLimit,
} from '@revisionden/core';
import {
  attempts,
  dailyLimits,
  exams,
  flashcards,
  startingTests,
  students,
  type Database,
} from '@revisionden/db';
import { loadReminderSettings } from '../notifications/runner';

const LOOK_BACK_DAYS = 14;
/** A starting test left unfinished this long counts as stopped part-way. */
const ABANDONED_AFTER_MS = 60 * 60_000;

type LimitRow = typeof dailyLimits.$inferSelect;

export interface LimitContext {
  level: Level;
  timeZone: string;
  settings: DailyLimitSettings;
  examDates: string[];
  row: LimitRow | undefined;
}

export async function loadLimitContext(db: Database, studentId: string): Promise<LimitContext> {
  const [student] = await db
    .select({ yearGroup: students.yearGroup })
    .from(students)
    .where(eq(students.id, studentId));
  const [row] = await db.select().from(dailyLimits).where(eq(dailyLimits.studentId, studentId));
  const examRows = await db
    .select({ date: exams.date })
    .from(exams)
    .where(and(eq(exams.studentId, studentId), eq(exams.kind, 'exam')));
  const { timeZone } = await loadReminderSettings(db, studentId);
  return {
    // Years below 9 are not offered yet; they get the GCSE limits.
    level: levelForYear(student?.yearGroup ?? 10) ?? 'gcse',
    timeZone,
    settings: {
      schoolDayMinutes: row?.schoolDayMinutes ?? null,
      otherDayMinutes: row?.otherDayMinutes ?? null,
      examSeasonExtra: row?.examSeasonExtra ?? false,
    },
    examDates: examRows.map((e) => e.date),
    row,
  };
}

/** The limit in minutes on a local date. */
export const limitOn = (ctx: LimitContext, date: string) =>
  dailyLimitFor({ level: ctx.level, settings: ctx.settings, date, examDates: ctx.examDates });

async function answerTimesSince(db: Database, studentId: string, since: Date) {
  const rows = await db
    .select({ at: attempts.createdAt })
    .from(attempts)
    .where(and(eq(attempts.studentId, studentId), gte(attempts.createdAt, since)))
    .orderBy(asc(attempts.createdAt));
  return rows.map((r) => r.at.getTime());
}

/**
 * Today's limit, minutes used and left. `answeringAt` counts an answer being given now (so the
 * time since the last answer counts); a plain look at the page does not.
 */
export async function dailyLimitToday(
  db: Database,
  studentId: string,
  now: Date,
  options: { answeringAt?: Date; ctx?: LimitContext } = {},
): Promise<DailyLimitToday> {
  const ctx = options.ctx ?? (await loadLimitContext(db, studentId));
  const today = localDate(now, ctx.timeZone);
  const times = await answerTimesSince(db, studentId, new Date(zonedDayStart(today, ctx.timeZone)));
  if (options.answeringAt) times.push(options.answeringAt.getTime());
  const used = activeStudy(times, ctx.timeZone, Number.MAX_SAFE_INTEGER).days.find(
    (d) => d.day === today,
  );
  const limit = limitOn(ctx, today);
  return {
    ...limitStatus(used?.ms ?? 0, limit.minutes),
    dayType: limit.dayType,
    examSeason: limit.examSeason,
  };
}

/**
 * XP an answer or review given now may earn: none once today's limit is reached, so there is no
 * XP, reward or streak credit past it (only a timed paper may finish past the limit).
 */
export async function creditableXp(db: Database, studentId: string, xp: number, now: Date) {
  if (xp <= 0) return xp;
  const status = await dailyLimitToday(db, studentId, now, { answeringAt: now });
  return status.reached ? 0 : xp;
}

// ---------------------------------------------------------------------------------------------
// Weekly suggestion
// ---------------------------------------------------------------------------------------------

async function suggestionFor(
  db: Database,
  studentId: string,
  now: Date,
  ctx: LimitContext,
): Promise<LimitSuggestion | null> {
  const today = localDate(now, ctx.timeZone);
  const from = addDays(today, -LOOK_BACK_DAYS);
  const since = new Date(zonedDayStart(from, ctx.timeZone));
  const until = new Date(zonedDayStart(today, ctx.timeZone));
  const answers = await db
    .select({ at: attempts.createdAt, score: attempts.score })
    .from(attempts)
    .where(
      and(
        eq(attempts.studentId, studentId),
        gte(attempts.createdAt, since),
        lt(attempts.createdAt, until),
      ),
    )
    .orderBy(asc(attempts.createdAt));
  const reviews = await db
    .select({ at: flashcards.lastReviewedAt })
    .from(flashcards)
    .where(and(eq(flashcards.studentId, studentId), isNotNull(flashcards.lastReviewedAt)));
  const abandoned = await db
    .select({ id: startingTests.id })
    .from(startingTests)
    .where(
      and(
        eq(startingTests.studentId, studentId),
        isNull(startingTests.finishedAt),
        gte(startingTests.startedAt, since),
        lt(startingTests.startedAt, new Date(now.getTime() - ABANDONED_AFTER_MS)),
      ),
    );

  const times = answers.map((a) => a.at.getTime());
  const used = new Map(
    activeStudy(times, ctx.timeZone, Number.MAX_SAFE_INTEGER).days.map((d) => [d.day, d.ms]),
  );
  const days = Array.from({ length: LOOK_BACK_DAYS }, (_, i) => addDays(from, i)).map((day) => ({
    day,
    usedMinutes: Math.floor((used.get(day) ?? 0) / 60_000),
    limitMinutes: limitOn(ctx, day).minutes,
  }));
  const sessions = studySessions(times).map((s) => ({
    ...s,
    answers: answers
      .filter((a) => a.at.getTime() >= s.start && a.at.getTime() <= s.end)
      .map((a) => ({ at: a.at.getTime(), score: a.score })),
  }));
  const active = new Set([
    ...times.map((t) => localDate(new Date(t), ctx.timeZone)),
    ...reviews.map((r) => localDate(r.at!, ctx.timeZone)),
  ]);

  return weeklySuggestion({
    today,
    level: ctx.level,
    current: currentLimits(ctx),
    days,
    sessions,
    restDays: restDays(active, { start: from, end: today }, today),
    abandonedSessions: abandoned.length,
    lastSuggestedOn: ctx.row?.lastSuggestedOn ?? null,
    lastRaiseOn: ctx.row?.lastRaiseOn ?? null,
  });
}

const currentLimits = (ctx: LimitContext) => ({
  school: ctx.settings.schoolDayMinutes ?? DAILY_LIMIT_DEFAULTS[ctx.level].school,
  other: ctx.settings.otherDayMinutes ?? DAILY_LIMIT_DEFAULTS[ctx.level].other,
});

/** The suggestion waiting for the parent, working out a new one at most once a week. */
async function pendingSuggestion(db: Database, studentId: string, now: Date, ctx: LimitContext) {
  if (ctx.row?.pendingSuggestion) return ctx.row.pendingSuggestion;
  const today = localDate(now, ctx.timeZone);
  const last = ctx.row?.lastSuggestedOn;
  if (last && addDays(last, 7) > today) return null;
  const suggestion = await suggestionFor(db, studentId, now, ctx);
  const values = {
    lastSuggestedOn: today,
    pendingSuggestion: suggestion,
    ...(suggestion?.kind === 'raise' ? { lastRaiseOn: today } : {}),
  };
  await db
    .insert(dailyLimits)
    .values({ studentId, ...values })
    .onConflictDoUpdate({ target: dailyLimits.studentId, set: values });
  return suggestion;
}

export async function parentView(
  db: Database,
  studentId: string,
  now: Date,
): Promise<ParentDailyLimit> {
  const ctx = await loadLimitContext(db, studentId);
  const suggestion = await pendingSuggestion(db, studentId, now, ctx);
  const current = currentLimits(ctx);
  return {
    settings: {
      schoolDayMinutes: current.school,
      otherDayMinutes: current.other,
      examSeasonExtra: ctx.settings.examSeasonExtra,
    },
    custom: {
      school: ctx.settings.schoolDayMinutes !== null,
      other: ctx.settings.otherDayMinutes !== null,
    },
    defaults: DAILY_LIMIT_DEFAULTS[ctx.level],
    ceilings: DAILY_LIMIT_CEILINGS[ctx.level],
    today: await dailyLimitToday(db, studentId, now, { ctx }),
    suggestion,
  };
}

/** Saves a parent's change; the student is told about it once. */
export async function saveLimits(
  db: Database,
  studentId: string,
  change: Partial<DailyLimitSettings>,
  now: Date,
  options: { clearSuggestion?: boolean } = {},
) {
  const values = {
    ...change,
    changedAt: now,
    updatedAt: now,
    ...(options.clearSuggestion ? { pendingSuggestion: null } : {}),
  };
  await db
    .insert(dailyLimits)
    .values({ studentId, ...values })
    .onConflictDoUpdate({ target: dailyLimits.studentId, set: values });
}

export async function dismissSuggestion(db: Database, studentId: string, now: Date) {
  await db
    .update(dailyLimits)
    .set({ pendingSuggestion: null, updatedAt: now })
    .where(eq(dailyLimits.studentId, studentId));
}

export async function studentView(db: Database, studentId: string, now: Date) {
  const ctx = await loadLimitContext(db, studentId);
  const row = ctx.row;
  const unseen =
    row?.changedAt && (!row.studentSeenAt || row.changedAt.getTime() > row.studentSeenAt.getTime());
  const current = currentLimits(ctx);
  return {
    ...(await dailyLimitToday(db, studentId, now, { ctx })),
    changed: unseen ? { schoolDayMinutes: current.school, otherDayMinutes: current.other } : null,
  };
}

export async function markSeen(db: Database, studentId: string, now: Date) {
  await db
    .update(dailyLimits)
    .set({ studentSeenAt: now })
    .where(eq(dailyLimits.studentId, studentId));
}
