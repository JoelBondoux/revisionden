/**
 * RevisionDen database schema (Drizzle, Postgres).
 *
 * Privacy rule: no table stores a student's real name, date of birth, email, photo or school
 * name. Students have only a nickname, an avatar code and a year group. The schema guard test
 * (`schema-guard.test.ts`) fails if a column like that appears.
 *
 * The parent's identity lives in the `auth_*` tables owned by Better Auth. Only the sign-in
 * email is kept: the API blanks the provider's display name and never stores the picture.
 */
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------------------------
// Better Auth tables (parent sign-in). Column names follow Better Auth's core schema.
// ---------------------------------------------------------------------------------------------

export const authUsers = pgTable('auth_users', {
  id: text('id').primaryKey(),
  // Required by Better Auth; always stored as an empty string (see apps/api auth config).
  name: text('name').notNull().default(''),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  // Required by Better Auth's schema; always null (we never store the provider's picture).
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
  },
  (t) => [index('auth_sessions_user_id_idx').on(t.userId)],
);

export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    // Better Auth's schema has a password column; it stays null (no passwords anywhere).
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('auth_accounts_user_id_idx').on(t.userId)],
);

export const authVerifications = pgTable('auth_verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------------------------
// Families, parents and students
// ---------------------------------------------------------------------------------------------

export const families = pgTable('families', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: createdAt(),
});

export const parents = pgTable(
  'parents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    authUserId: text('auth_user_id')
      .notNull()
      .unique()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [index('parents_family_id_idx').on(t.familyId)],
);

export const students = pgTable(
  'students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull(),
    avatarCode: text('avatar_code').notNull(),
    yearGroup: integer('year_group').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('students_family_nickname_unique').on(t.familyId, t.nickname),
    check('students_nickname_format', sql`${t.nickname} ~ '^[A-Za-z0-9_]{2,16}$'`),
    check('students_year_group_range', sql`${t.yearGroup} between 7 and 13`),
  ],
);

export const enrolments = pgTable(
  'enrolments',
  {
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id').notNull(),
    // Exam board as in core's BoardSchema (for example 'AQA'), or 'not_sure'.
    board: text('board').notNull().default('not_sure'),
    // As in core's TierSchema: 'none' when the subject has no tiers.
    tier: text('tier').notNull().default('not_sure'),
    specVersion: text('spec_version'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.subjectId] }),
    check('enrolments_tier_values', sql`${t.tier} in ('foundation', 'higher', 'none', 'not_sure')`),
  ],
);

// ---------------------------------------------------------------------------------------------
// Devices and device linking
// ---------------------------------------------------------------------------------------------

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    // WebAuthn passkey credential (public part only).
    credentialId: text('credential_id').notNull().unique(),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    transports: jsonb('transports').$type<string[]>(),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [index('devices_student_id_idx').on(t.studentId)],
);

/** One-time tokens a parent shows as a QR code to link a student device. */
export const deviceLinkTokens = pgTable(
  'device_link_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // SHA-256 of the token; the token itself is never stored.
    tokenHash: text('token_hash').notNull().unique(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('device_link_tokens_student_id_idx').on(t.studentId)],
);

/** WebAuthn challenges waiting for a device's response (registration or unlock). */
export const passkeyChallenges = pgTable('passkey_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['register', 'unlock'] }).notNull(),
  challenge: text('challenge').notNull(),
  // Set for registration (the student being linked); null for unlock.
  studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
});

/** Sessions for a linked, unlocked student device. */
export const studentSessions = pgTable(
  'student_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull().unique(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('student_sessions_student_id_idx').on(t.studentId)],
);

// ---------------------------------------------------------------------------------------------
// Content (topic trees and items come from content/ via workstream D)
// ---------------------------------------------------------------------------------------------

export const topics = pgTable(
  'topics',
  {
    id: text('id').primaryKey(),
    subjectId: text('subject_id').notNull(),
    board: text('board').notNull(),
    specRef: text('spec_ref'),
    title: text('title').notNull(),
    parentTopicId: text('parent_topic_id').references((): AnyPgColumn => topics.id, {
      onDelete: 'cascade',
    }),
  },
  (t) => [index('topics_subject_board_idx').on(t.subjectId, t.board)],
);

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    body: jsonb('body').notNull(),
    answer: jsonb('answer').notNull(),
    sourceRef: text('source_ref'),
    checkedBy: text('checked_by'),
    // Added by workstream F. The item's id in content/ (for example gcse-maths-h-n7-0001).
    contentId: text('content_id').unique(),
    version: integer('version').notNull().default(1),
    // Verification status from content/ (docs/VERIFICATION.md). Only 'verified' is served to
    // students, unless the development flag serves drafts too.
    status: text('status').notNull().default('draft'),
    difficulty: integer('difficulty'),
    tags: jsonb('tags').$type<string[]>(),
  },
  (t) => [
    index('items_topic_id_idx').on(t.topicId),
    check(
      'items_status_values',
      sql`${t.status} in ('draft', 'verified', 'quarantined', 'retired')`,
    ),
  ],
);

// ---------------------------------------------------------------------------------------------
// Learning records
// ---------------------------------------------------------------------------------------------

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    correct: boolean('correct').notNull(),
    score: real('score'),
    timeMs: integer('time_ms'),
    createdAt: createdAt(),
    // Added by workstream F: the item version the student saw (docs/VERIFICATION.md), the
    // mode, the XP earned and, for starting test answers, which test.
    itemVersion: integer('item_version'),
    mode: text('mode'),
    xpEarned: integer('xp_earned').notNull().default(0),
    startingTestId: uuid('starting_test_id').references((): AnyPgColumn => startingTests.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [index('attempts_student_created_idx').on(t.studentId, t.createdAt)],
);

export const mastery = pgTable(
  'mastery',
  {
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    value: real('value').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.topicId] }),
    check('mastery_value_range', sql`${t.value} between 0 and 1`),
  ],
);

export const exams = pgTable(
  'exams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['exam', 'mock', 'assessment'] }).notNull(),
    subjectId: text('subject_id').notNull(),
    date: date('date').notNull(),
    result: text('result'),
  },
  (t) => [index('exams_student_id_idx').on(t.studentId)],
);

export const schoolReports = pgTable(
  'school_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    // Extracted grades only, never the school's name or the report image.
    values: jsonb('values').notNull(),
  },
  (t) => [index('school_reports_student_id_idx').on(t.studentId)],
);

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(),
    sessions: jsonb('sessions').notNull(),
    editedBy: text('edited_by', { enum: ['auto', 'parent', 'student'] })
      .notNull()
      .default('auto'),
  },
  (t) => [unique('plans_student_week_unique').on(t.studentId, t.weekStart)],
);

export const rewards = pgTable(
  'rewards',
  {
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    rewardId: text('reward_id').notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.rewardId] })],
);

export const streaks = pgTable('streaks', {
  studentId: uuid('student_id')
    .primaryKey()
    .references(() => students.id, { onDelete: 'cascade' }),
  current: integer('current').notNull().default(0),
  best: integer('best').notNull().default(0),
  skipDays: integer('skip_days').notNull().default(0),
  giftDays: integer('gift_days').notNull().default(0),
  // Added by workstream F so the streak rules in packages/core can carry on between days.
  skipsInARow: integer('skips_in_a_row').notNull().default(0),
  lastDate: date('last_date'),
  lastSettledWeek: date('last_settled_week'),
});

// ---------------------------------------------------------------------------------------------
// Learning loop (workstream F)
// ---------------------------------------------------------------------------------------------

/** XP earned per student per calendar day (UK time), for the daily goal and streak. */
export const dailyXp = pgTable(
  'daily_xp',
  {
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    xp: integer('xp').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.day] })],
);

/** A student's starting test for one subject (about 5 minutes; sets first mastery). */
export const startingTests = pgTable(
  'starting_tests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id').notNull(),
    itemIds: jsonb('item_ids').$type<string[]>().notNull(),
    startedAt: createdAt(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('starting_tests_student_id_idx').on(t.studentId)],
);

/**
 * A student's flashcards with their SM-2 state. Deck and wrong-answer cards point at an item
 * (their text comes from the content); a student's own cards keep their own front and back.
 */
export const flashcards = pgTable(
  'flashcards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    origin: text('origin', { enum: ['deck', 'wrong_answer', 'own'] }).notNull(),
    front: text('front'),
    back: text('back'),
    repetitions: integer('repetitions').notNull().default(0),
    intervalDays: integer('interval_days').notNull().default(0),
    ease: real('ease').notNull().default(2.5),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('flashcards_student_item_unique').on(t.studentId, t.itemId),
    index('flashcards_student_due_idx').on(t.studentId, t.dueAt),
    check('flashcards_origin_values', sql`${t.origin} in ('deck', 'wrong_answer', 'own')`),
  ],
);

// ---------------------------------------------------------------------------------------------
// Reminders (web push) and AI usage (workstream H)
// ---------------------------------------------------------------------------------------------

const hhmm = (column: unknown) => sql`${column} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`;

/** Web push subscriptions, one per linked device (the push service's endpoint and keys). */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('push_subscriptions_student_id_idx').on(t.studentId)],
);

/**
 * Reminder settings per student, set by the parent. Times are local "HH:MM" in `time_zone`.
 * Quiet hours (no reminders): every night, and on weekdays during the daytime window (school
 * hours by default). At most two reminders a day (fixed in apps/api).
 */
export const reminderSettings = pgTable(
  'reminder_settings',
  {
    studentId: uuid('student_id')
      .primaryKey()
      .references(() => students.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
    streakReminders: boolean('streak_reminders').notNull().default(true),
    sessionReminders: boolean('session_reminders').notNull().default(true),
    quietStart: text('quiet_start').notNull().default('21:00'),
    quietEnd: text('quiet_end').notNull().default('07:30'),
    weekdayQuietStart: text('weekday_quiet_start').notNull().default('08:30'),
    weekdayQuietEnd: text('weekday_quiet_end').notNull().default('15:30'),
    sessionReminderTime: text('session_reminder_time').notNull().default('16:30'),
    streakReminderTime: text('streak_reminder_time').notNull().default('19:00'),
    timeZone: text('time_zone').notNull().default('Europe/London'),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('reminder_settings_quiet_start_format', hhmm(t.quietStart)),
    check('reminder_settings_quiet_end_format', hhmm(t.quietEnd)),
    check('reminder_settings_weekday_quiet_start_format', hhmm(t.weekdayQuietStart)),
    check('reminder_settings_weekday_quiet_end_format', hhmm(t.weekdayQuietEnd)),
    check('reminder_settings_session_time_format', hhmm(t.sessionReminderTime)),
    check('reminder_settings_streak_time_format', hhmm(t.streakReminderTime)),
  ],
);

/** Reminders sent, used for the daily limit and so each kind is sent once a day at most. */
export const reminderLog = pgTable(
  'reminder_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['streak', 'session'] }).notNull(),
    localDate: date('local_date').notNull(),
    // Our own reminder wording (no personal data), shown by the service worker.
    message: text('message').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('reminder_log_student_kind_day_unique').on(t.studentId, t.kind, t.localDate),
    index('reminder_log_student_day_idx').on(t.studentId, t.localDate),
  ],
);

/** AI calls per child: tokens and cost only. Prompts and answers are never stored. */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    job: text('job').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    // Cost in millionths of a US dollar (providers bill in USD).
    costMicroUsd: integer('cost_micro_usd').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('ai_usage_student_created_idx').on(t.studentId, t.createdAt)],
);

// ---------------------------------------------------------------------------------------------
// Verification: reports, quarantine, review queue and re-checks (workstream V,
// docs/VERIFICATION.md sections 3 and 6). Content ids are the text ids from content/.
// Reviewers are recorded by role only, never by name.
// ---------------------------------------------------------------------------------------------

export const REVIEWER_ROLES = ['subject-specialist', 'content-lead', 'parent-reviewer'] as const;
export const REPORT_REASONS = [
  'wrong_answer',
  'wrong_explanation',
  'unclear',
  'typo',
  'not_on_my_course',
  'other',
] as const;

/** Signed-in parent accounts allowed to use the review queue, and their role. */
export const reviewerRoles = pgTable(
  'reviewer_roles',
  {
    authUserId: text('auth_user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    role: text('role', { enum: REVIEWER_ROLES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'reviewer_roles_role_values',
      sql`${t.role} in ('subject-specialist', 'content-lead', 'parent-reviewer')`,
    ),
  ],
);

/** "Report a problem". Only the reason is stored: no free text, so no personal data. */
export const itemReports = pgTable(
  'item_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: text('item_id').notNull(),
    itemVersion: integer('item_version').notNull(),
    reason: text('reason', { enum: REPORT_REASONS }).notNull(),
    reportedBy: text('reported_by', { enum: ['student', 'parent'] }).notNull(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['open', 'no_error', 'confirmed_error'] })
      .notNull()
      .default('open'),
    decidedByRole: text('decided_by_role', { enum: REVIEWER_ROLES }),
    decisionNotes: text('decision_notes'),
    createdAt: createdAt(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    index('item_reports_item_idx').on(t.itemId, t.status),
    check('item_reports_version_positive', sql`${t.itemVersion} >= 1`),
  ],
);

/**
 * Items hidden from every student until a reviewer decides. While a row is here the item's
 * status in items is 'quarantined' (the learning loop's content gate never serves it), and
 * every content sync puts that status back (reapplyQuarantine in apps/api).
 */
export const quarantinedItems = pgTable('quarantined_items', {
  itemId: text('item_id').primaryKey(),
  itemVersion: integer('item_version').notNull(),
  cause: text('cause', { enum: ['report', 'confirmed_error', 'batch_failed'] }).notNull(),
  // The item's status in items before it was hidden, put back when a reviewer finds no error.
  previousStatus: text('previous_status'),
  since: timestamp('since', { withTimezone: true }).notNull().defaultNow(),
});

/** A batch of generated items released by the sampling rule (10%, at least 30). */
export const reviewBatches = pgTable('review_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  // Writer prompt and source the batch came from, so a confirmed error can re-check siblings.
  writerPrompt: text('writer_prompt'),
  sourceUrl: text('source_url'),
  status: text('status', { enum: ['in_review', 'passed', 'failed'] })
    .notNull()
    .default('in_review'),
  // Seed of the random sample, so the draw can be replayed for audit.
  sampleSeed: integer('sample_seed').notNull(),
  createdAt: createdAt(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
});

export const reviewBatchItems = pgTable(
  'review_batch_items',
  {
    batchId: uuid('batch_id')
      .notNull()
      .references(() => reviewBatches.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    itemVersion: integer('item_version').notNull(),
    needsHumanApproval: boolean('needs_human_approval').notNull().default(false),
    inSample: boolean('in_sample').notNull(),
    // The item as the reviewer sees it (question, answer, citations), from content/.
    snapshot: jsonb('snapshot').notNull(),
    decision: text('decision', { enum: ['approved', 'confirmed_error'] }),
    decidedByRole: text('decided_by_role', { enum: REVIEWER_ROLES }),
    decisionNotes: text('decision_notes'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.batchId, t.itemId] })],
);

/** Requests to send items back through pipeline steps 3 to 5 (picked up by the offline tools). */
export const recheckRequests = pgTable('recheck_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  scope: text('scope', { enum: ['batch', 'item', 'writer_prompt', 'source'] }).notNull(),
  scopeValue: text('scope_value').notNull(),
  cause: text('cause').notNull(),
  status: text('status', { enum: ['pending', 'done'] })
    .notNull()
    .default('pending'),
  createdAt: createdAt(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

/** Scores and mastery to recalculate after a confirmed error in an item. */
export const recalculationJobs = pgTable('recalculation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: text('item_id').notNull(),
  itemVersion: integer('item_version').notNull(),
  status: text('status', { enum: ['pending', 'done'] })
    .notNull()
    .default('pending'),
  createdAt: createdAt(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
