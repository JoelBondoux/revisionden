/**
 * Shared Zod schemas for every API request and response defined so far. The web app (MSW mocks
 * and forms) and the API (request validation) both import these, so they cannot drift apart.
 *
 * Request schemas for things a family creates are strict: unknown fields (for example a real
 * name) are rejected, never silently stored.
 */
import { z } from 'zod';
import { ErrorRefSchema } from './error-ref';
import { decodeAvatar } from './avatar';
import { NICKNAME_MESSAGES, normaliseNickname, validateNickname } from './nickname';

export const IdSchema = z.string().uuid();

/** Calendar date such as 2026-01-31 (no time, no time zone). */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Use a date like 2026-01-31');

export const IsoDateTimeSchema = z.string().datetime();

export const NicknameSchema = z
  .string()
  .transform(normaliseNickname)
  .superRefine((value, ctx) => {
    const result = validateNickname(value);
    if (!result.ok)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: NICKNAME_MESSAGES[result.reason] });
  });

/** Checks the code's shape only. Locked items are checked by validateAvatar with earned rewards. */
export const AvatarCodeSchema = z.string().refine(
  (value) => {
    try {
      decodeAvatar(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Avatar code is not valid' },
);

// Years 9 to 13 (GCSE and A-Level, 13+); the database check matches.
const yearGroupMessage = 'Year group must be from 9 to 13';
export const YearGroupSchema = z
  .number()
  .int(yearGroupMessage)
  .min(9, yearGroupMessage)
  .max(13, yearGroupMessage);

// Students

export const StudentSchema = z.object({
  id: IdSchema,
  nickname: NicknameSchema,
  avatarCode: AvatarCodeSchema,
  yearGroup: YearGroupSchema,
});
export type Student = z.infer<typeof StudentSchema>;

const studentFields = z
  .object({ nickname: NicknameSchema, avatarCode: AvatarCodeSchema, yearGroup: YearGroupSchema })
  .strict();

export const CreateStudentRequestSchema = studentFields;
export type CreateStudentRequest = z.infer<typeof CreateStudentRequestSchema>;

export const UpdateStudentRequestSchema = studentFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to change');
export type UpdateStudentRequest = z.infer<typeof UpdateStudentRequestSchema>;

export const StudentListResponseSchema = z.object({ students: z.array(StudentSchema) });

// Enrolments

export const BoardSchema = z.enum(['AQA', 'Edexcel', 'OCR', 'WJEC', 'Eduqas', 'CCEA', 'not_sure']);
export const TierSchema = z.enum(['foundation', 'higher', 'none', 'not_sure']);

const enrolmentFields = {
  subjectId: z.string().min(1),
  board: BoardSchema,
  tier: TierSchema,
  specVersion: z.string().min(1).optional(),
};

export const EnrolmentSchema = z.object({ studentId: IdSchema, ...enrolmentFields });
export type Enrolment = z.infer<typeof EnrolmentSchema>;

export const CreateEnrolmentRequestSchema = z.object(enrolmentFields).strict();
export type CreateEnrolmentRequest = z.infer<typeof CreateEnrolmentRequestSchema>;

export const EnrolmentListResponseSchema = z.object({ enrolments: z.array(EnrolmentSchema) });

// Items (the answer is never sent to the student, so it is not part of the schema)

export const ItemTypeSchema = z.enum([
  'multiple_choice',
  'short_answer',
  'numeric',
  'worked_maths',
  'extended_answer',
  'flashcard',
]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const ItemSchema = z.object({
  id: IdSchema,
  topicId: z.string().min(1),
  type: ItemTypeSchema,
  body: z.record(z.unknown()),
  sourceRef: z.string().optional(),
});
export type Item = z.infer<typeof ItemSchema>;

export const NextItemsRequestSchema = z.object({
  count: z.number().int().min(1).max(20).default(10),
});
export const NextItemsResponseSchema = z.object({ items: z.array(ItemSchema) });

// Attempts (the request is LearnAttemptRequestSchema in learning-schemas.ts)

export const ModeSchema = z.enum(['learn', 'test']);

// Plans

export const PlanSessionSchema = z.object({
  date: IsoDateSchema,
  subjectId: z.string().min(1),
  topicId: z.string().min(1).optional(),
  minutes: z.number().int().min(5).max(240),
});

export const PlanSchema = z.object({
  id: IdSchema,
  studentId: IdSchema,
  weekStart: IsoDateSchema,
  sessions: z.array(PlanSessionSchema),
  editedBy: z.enum(['auto', 'parent', 'student']),
});
export type Plan = z.infer<typeof PlanSchema>;

export const UpdatePlanRequestSchema = z.object({ sessions: z.array(PlanSessionSchema) }).strict();

// Errors

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
    details: z.array(z.string()).optional(),
    /** Reference code for the owner to find the logged error (`makeErrorRef`). */
    ref: ErrorRefSchema.optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Turns a Zod error into lines like "sessions.0.minutes: Number must be ...". */
export function readableErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}
