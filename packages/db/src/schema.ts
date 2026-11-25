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
  // Last time a parent or student used the account (updated at most hourly). A family unused
  // for 12 months is deleted by the scheduled clean-up (docs/legal/data-retention.md).
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  // The value lastActiveAt had before its latest update, so the app can warn a parent who
  // comes back after a long gap. Null until the second update.
  previousActiveAt: timestamp('previous_active_at', { withTimezone: true }),
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
    check('students_year_group_range', sql`${t.yearGroup} between 9 and 13`),
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
    // Added by workstream F2: order in the topic tree (specification order) for the topic map.
    position: integer('position').notNull().default(0),
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
 * A flashcard review session (workstream F3). Deck XP is paid per completed session, not per
 * card: card_ids counts each card once (at most 20); xp_earned and finished_at are set when the
 * session is finished, so reward XP can apply the late-night and daily rules to it.
 */
export const flashcardSessions = pgTable(
  'flashcard_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    cardIds: jsonb('card_ids').$type<string[]>().notNull().default([]),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    completed: boolean('completed').notNull().default(false),
    xpEarned: integer('xp_earned').notNull().default(0),
    /** Set when the session reviews one deck: completion is checked within that deck only. */
    topicId: text('topic_id'),
    /**
     * A rewarded session takes one of the student's daily reward slots (UK day, slot 1 or 2).
     * The unique key means two finishes at the same time can never both take the same slot,
     * so the 2-a-day limit holds without a transaction (the Neon HTTP driver has none).
     */
    rewardedDay: date('rewarded_day'),
    rewardSlot: integer('reward_slot'),
  },
  (t) => [
    index('flashcard_sessions_student_started_idx').on(t.studentId, t.startedAt),
    unique('flashcard_sessions_reward_slot').on(t.studentId, t.rewardedDay, t.rewardSlot),
    check('flashcard_sessions_reward_slot_range', sql`${t.rewardSlot} between 1 and 2`),
  ],
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
 * Web push subscriptions on a parent's own devices (workstream H2), turned on from the parent
 * home. Used only to tell the parent a parent-set reward target was met. No payload is sent.
 */
export const parentPushSubscriptions = pgTable(
  'parent_push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => parents.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('parent_push_subscriptions_parent_id_idx').on(t.parentId)],
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

// ---------------------------------------------------------------------------------------------
// Five-year rewards (workstream R)
// ---------------------------------------------------------------------------------------------

/**
 * Real-world rewards a parent ties to a target: a catalogue reward id, a stat reaching a number,
 * or a date. The parent can edit or delete one until it is marked as given; then it is history.
 * Only a short title and an optional note are stored.
 */
export const parentRewards = pgTable(
  'parent_rewards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    note: text('note'),
    targetKind: text('target_kind', { enum: ['reward', 'stat', 'date'] }).notNull(),
    rewardId: text('reward_id'),
    stat: text('stat'),
    atLeast: integer('at_least'),
    targetDate: date('target_date'),
    createdAt: createdAt(),
    givenAt: timestamp('given_at', { withTimezone: true }),
    // When the parent was told the target was met (workstream H2); set once, so they are told once.
    reachedNotifiedAt: timestamp('reached_notified_at', { withTimezone: true }),
  },
  (t) => [
    index('parent_rewards_student_idx').on(t.studentId),
    check(
      'parent_rewards_target',
      sql`(${t.targetKind} = 'reward' and ${t.rewardId} is not null) or (${t.targetKind} = 'stat' and ${t.stat} is not null and ${t.atLeast} >= 1) or (${t.targetKind} = 'date' and ${t.targetDate} is not null)`,
    ),
  ],
);

// Feedback and policy acceptance (workstream L, docs/PRODUCT_RULES.md "About page, policies and
// feedback"). Feedback text is checked for personal details before it is saved; it is deleted
// 12 months after it is closed.
// ---------------------------------------------------------------------------------------------

export const FEEDBACK_KINDS = ['bug', 'idea', 'confusing', 'other'] as const;
export const FEEDBACK_STATUSES = ['new', 'looking_into_it', 'fixed', 'will_not_fix'] as const;
export const FEEDBACK_MAX_TEXT = 500;

/** Device details a sender may include: never IP address, location or contacts. */
export interface FeedbackDevice {
  appVersion?: string;
  route?: string;
  browserFamily?: string;
  screenSize?: string;
  online?: boolean;
}

export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    senderRole: text('sender_role', { enum: ['student', 'parent'] }).notNull(),
    // Set when a student sent it.
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
    // Set when a parent sent it (for the daily limit per account).
    senderAuthUserId: text('sender_auth_user_id').references(() => authUsers.id, {
      onDelete: 'cascade',
    }),
    kind: text('kind', { enum: FEEDBACK_KINDS }).notNull(),
    text: text('text'),
    device: jsonb('device').$type<FeedbackDevice>(),
    status: text('status', { enum: FEEDBACK_STATUSES }).notNull().default('new'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // Set when the status becomes fixed or will_not_fix; the row is deleted 12 months later.
    closedAt: timestamp('closed_at', { withTimezone: true }),
    // Bug Hunter (L7): the operator confirms a bug report, or marks it a duplicate of an earlier
    // confirmed one. reward_xp and track_step record what the student earned (packages/core
    // bugReward); reward_seen_at is set once the student has seen the thank-you in the app.
    outcome: text('outcome', { enum: ['confirmed', 'duplicate'] }),
    duplicateOf: uuid('duplicate_of').references((): AnyPgColumn => feedback.id, {
      onDelete: 'set null',
    }),
    rewardXp: integer('reward_xp').notNull().default(0),
    trackStep: boolean('track_step').notNull().default(false),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    rewardSeenAt: timestamp('reward_seen_at', { withTimezone: true }),
  },
  (t) => [
    index('feedback_family_id_idx').on(t.familyId),
    index('feedback_created_at_idx').on(t.createdAt),
    check('feedback_kind_values', sql`${t.kind} in ('bug', 'idea', 'confusing', 'other')`),
    check('feedback_sender_role_values', sql`${t.senderRole} in ('student', 'parent')`),
    check(
      'feedback_status_values',
      sql`${t.status} in ('new', 'looking_into_it', 'fixed', 'will_not_fix')`,
    ),
    check('feedback_text_length', sql`char_length(${t.text}) <= 500`),
    check('feedback_outcome_values', sql`${t.outcome} in ('confirmed', 'duplicate')`),
    index('feedback_student_confirmed_idx').on(t.studentId, t.confirmedAt),
  ],
);

export const POLICIES_TO_ACCEPT = ['privacy-notice', 'terms-of-use'] as const;

/** The version of each policy a parent confirmed. No other data. */
export const policyAcceptances = pgTable(
  'policy_acceptances',
  {
    authUserId: text('auth_user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    policy: text('policy').notNull(),
    version: text('version').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.authUserId, t.policy] })],
);

/** Browser families an error report may name (no versions). */
export const ERROR_REPORT_BROWSERS = ['Chrome', 'Edge', 'Firefox', 'Safari', 'Other'] as const;

/**
 * Error reports sent with the "Send error report" button (workstream I). Anonymous: no family,
 * student, account or free text; screen and API path have ids masked. Deleted after 90 days.
 */
export const errorReports = pgTable(
  'error_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ref: text('ref').notNull().unique('error_reports_ref_unique'),
    screen: text('screen').notNull(),
    apiPath: text('api_path'),
    status: integer('status'),
    build: text('build').notNull(),
    browser: text('browser', { enum: ERROR_REPORT_BROWSERS }).notNull(),
    online: boolean('online').notNull(),
    // When the error happened, by the device's clock.
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('error_reports_created_at_idx').on(t.createdAt),
    check(
      'error_reports_browser_values',
      sql`${t.browser} in ('Chrome', 'Edge', 'Firefox', 'Safari', 'Other')`,
    ),
  ],
);

// ---------------------------------------------------------------------------------------------
// Workstream O: operator bridge for the owner's AppDeck Admin console (docs/OPERATOR_CONSOLE.md).
// ---------------------------------------------------------------------------------------------

export const OPERATOR_ROLES = ['agent', 'manager'] as const;
export const OPERATOR_AUDIT_OUTCOMES = ['ok', 'denied'] as const;

/**
 * Every operator read of a family and every operator action, kept 2 years. The operator's work
 * email is staff data from AppDeck, never a family's. The target is a plain id (no foreign key),
 * so the record outlives a deleted family; it never holds the search text or any content.
 */
export const operatorAuditLog = pgTable(
  'operator_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorEmail: text('operator_email').notNull(),
    operatorRole: text('operator_role', { enum: OPERATOR_ROLES }).notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    requestId: text('request_id').notNull(),
    outcome: text('outcome', { enum: OPERATOR_AUDIT_OUTCOMES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('operator_audit_log_created_at_idx').on(t.createdAt),
    index('operator_audit_log_target_idx').on(t.targetType, t.targetId),
    check('operator_audit_log_role_values', sql`${t.operatorRole} in ('agent', 'manager')`),
    check('operator_audit_log_outcome_values', sql`${t.outcome} in ('ok', 'denied')`),
  ],
);

/**
 * Request ids seen from AppDeck, kept 1 day (well past the 5-minute signing window). A read's id
 * may not be used twice; a change sent again with the same id and body gets the stored answer
 * instead of running twice. Only change answers are stored, never a read's.
 */
export const operatorRequests = pgTable(
  'operator_requests',
  {
    requestId: text('request_id').primaryKey(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    // SHA-256 of the raw body, to tell a true retry from a reused id.
    bodyHash: text('body_hash').notNull(),
    // Null while the change is running.
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    createdAt: createdAt(),
  },
  (t) => [index('operator_requests_created_at_idx').on(t.createdAt)],
);
