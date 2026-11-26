/**
 * Friends league API shapes (docs/FRIENDS_LEAGUE.md), shared by the API and the web app.
 * Other children appear only as nickname, avatar code and title.
 */
import { z } from 'zod';
import { REPORT_REASONS } from './league';

export const FriendCardSchema = z.object({
  nickname: z.string(),
  avatarCode: z.string(),
  title: z.string().nullable(),
});
export type FriendCard = z.infer<typeof FriendCardSchema>;

export const FriendSchema = FriendCardSchema.extend({ id: z.string(), sibling: z.boolean() });
export type Friend = z.infer<typeof FriendSchema>;

/** `confirm`: this child must check it is their friend; `friend_checking`: waiting for the friend. */
export const WaitingStatusSchema = z.enum([
  'confirm',
  'friend_checking',
  'parents',
  'not_going_ahead',
]);

export const StudentFriendsResponseSchema = z.object({
  allowed: z.boolean(),
  hidden: z.boolean(),
  friends: z.array(FriendSchema),
  waiting: z.array(
    z.object({
      requestId: z.string(),
      nickname: z.string(),
      avatarCode: z.string(),
      status: WaitingStatusSchema,
    }),
  ),
});
export type StudentFriendsResponse = z.infer<typeof StudentFriendsResponseSchema>;

export const FriendCodeResponseSchema = z.object({ code: z.string(), expiresAt: z.string() });
export type FriendCodeResponse = z.infer<typeof FriendCodeResponseSchema>;

export const RedeemFriendCodeResponseSchema = z.object({
  requestId: z.string(),
  friend: FriendCardSchema,
});
export type RedeemFriendCodeResponse = z.infer<typeof RedeemFriendCodeResponseSchema>;

export const ReportReasonSchema = z.enum(REPORT_REASONS);

export const LeagueEntrySchema = FriendCardSchema.extend({
  xp: z.number().int(),
  place: z.number().int().nullable(),
  winning: z.boolean(),
  you: z.boolean(),
});
export type LeagueEntry = z.infer<typeof LeagueEntrySchema>;

export const LeagueResponseSchema = z.object({
  week: z.object({ start: z.string(), end: z.string() }),
  hidden: z.boolean(),
  /** The student's own result for last week, once settled. */
  lastWeek: z
    .object({ xp: z.number().int(), place: z.number().int().nullable(), won: z.boolean() })
    .nullable(),
  entries: z.array(LeagueEntrySchema),
});
export type LeagueResponse = z.infer<typeof LeagueResponseSchema>;

const WaitingCardSchema = FriendCardSchema.extend({ requestId: z.string() });

export const FriendReportViewSchema = z.object({
  id: z.string(),
  direction: z.enum(['made', 'about']),
  reason: ReportReasonSchema,
  reporter: z.string().nullable(),
  reported: z.string().nullable(),
  at: z.string(),
  /** Marked as dealt with by the reporting child's parents (then kept 12 months). */
  closed: z.boolean(),
});
export type FriendReportView = z.infer<typeof FriendReportViewSchema>;

export const ParentFriendsResponseSchema = z.object({
  allowed: z.boolean(),
  hidden: z.boolean(),
  friends: z.array(
    FriendSchema.extend({ since: z.string().nullable(), label: z.string().nullable() }),
  ),
  waitingForYou: z.array(WaitingCardSchema),
  waitingForOther: z.array(WaitingCardSchema),
  blocked: z.array(z.object({ id: z.string(), nickname: z.string() })),
  reports: z.array(FriendReportViewSchema),
});
export type ParentFriendsResponse = z.infer<typeof ParentFriendsResponseSchema>;

/** "1st", "2nd", "3rd", "4th"…, for "You're 2nd this week". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10];
  return `${n}${suffix ?? 'th'}`;
}

/** AppDeck's view of friend reports (FL PR 4): nicknames, the reported avatar, reason, dates. */
export const OperatorFriendReportsSchema = z
  .object({
    reports: z.array(
      z
        .object({
          id: z.string(),
          reason: ReportReasonSchema,
          reporter: z.string().nullable(),
          reported: z.string().nullable(),
          reportedAvatarCode: z.string().nullable(),
          createdAt: z.string(),
          closedAt: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type OperatorFriendReports = z.infer<typeof OperatorFriendReportsSchema>;
