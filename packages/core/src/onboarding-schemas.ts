/**
 * Shared Zod schemas for the onboarding API (/v1/onboarding) and the avatar endpoints. The web
 * app and the API both use them, so they cannot drift apart.
 */
import { z } from 'zod';
import { ONBOARDING_YEARS } from './onboarding';
import {
  AvatarCodeSchema,
  BoardSchema,
  EnrolmentSchema,
  NicknameSchema,
  StudentSchema,
  TierSchema,
} from './schemas';

const onboardingYearMessage = 'School year must be from 9 to 13';
export const OnboardingYearSchema = z
  .number()
  .int(onboardingYearMessage)
  .min(ONBOARDING_YEARS[0], onboardingYearMessage)
  .max(ONBOARDING_YEARS[ONBOARDING_YEARS.length - 1]!, onboardingYearMessage);

export const SubjectChoiceSchema = z
  .object({ subjectId: z.string().min(1), board: BoardSchema, tier: TierSchema })
  .strict();

export const OnboardChildRequestSchema = z
  .object({
    nickname: NicknameSchema,
    avatarCode: AvatarCodeSchema,
    yearGroup: OnboardingYearSchema,
    subjects: z.array(SubjectChoiceSchema).max(20),
  })
  .strict();
export type OnboardChildRequest = z.infer<typeof OnboardChildRequestSchema>;

export const LevelSchema = z.enum(['gcse', 'a_level']);
export const ExamSeasonSchema = z.object({
  season: z.literal('summer'),
  year: z.number().int(),
});

export const OnboardedChildSchema = z.object({
  student: StudentSchema,
  enrolments: z.array(EnrolmentSchema),
  level: LevelSchema,
  examSeason: ExamSeasonSchema,
  /** Boards and tiers left as "not sure". */
  toCheckLater: z.number().int().min(0),
  linkedDevices: z.number().int().min(0),
});
export type OnboardedChild = z.infer<typeof OnboardedChildSchema>;

export const OnboardingFamilySchema = z.object({ children: z.array(OnboardedChildSchema) });
export type OnboardingFamily = z.infer<typeof OnboardingFamilySchema>;

export const StudentAvatarSchema = z.object({
  avatarCode: AvatarCodeSchema,
  earnedRewardIds: z.array(z.string()),
});
export type StudentAvatar = z.infer<typeof StudentAvatarSchema>;

export const UpdateAvatarRequestSchema = z.object({ avatarCode: AvatarCodeSchema }).strict();

/** Returned by POST /v1/students/:id/link-tokens (one-time QR code for a device). */
export const LinkTokenSchema = z.object({
  token: z.string(),
  familyId: z.string(),
  studentId: z.string(),
  expiresAt: z.string().datetime(),
  linkUrl: z.string().url(),
});
export type LinkToken = z.infer<typeof LinkTokenSchema>;
