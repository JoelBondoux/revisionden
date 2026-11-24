import { z } from 'zod';

// TODO(workstream C): replace these with the shared nickname, avatar code and request schemas
// from packages/core once they land. Kept identical to the rules in docs/PRIVACY.md.

/** Letters, numbers and underscore; 2 to 16 characters. */
export const nicknameSchema = z.string().regex(/^[A-Za-z0-9_]{2,16}$/, {
  message: 'Nickname must be 2 to 16 letters, numbers or underscores',
});

/** Layered avatar saved as a short code (format owned by workstream C). */
export const avatarCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, {
  message: 'Avatar code must be 1 to 64 letters, numbers, dashes or underscores',
});

export const yearGroupSchema = z.number().int().min(7).max(13);

export const createStudentSchema = z.strictObject({
  nickname: nicknameSchema,
  avatarCode: avatarCodeSchema,
  yearGroup: yearGroupSchema,
});

export const updateStudentSchema = createStudentSchema.partial();

export const subjectIdSchema = z.string().regex(/^[a-z0-9-]{2,64}$/);

export const enrolmentSchema = z.strictObject({
  board: z.string().regex(/^[a-z0-9_]{2,32}$/),
  tier: z.enum(['foundation', 'higher', 'not_sure']).nullable().optional(),
  specVersion: z.string().max(32).nullable().optional(),
});

export const uuidSchema = z.uuid();
