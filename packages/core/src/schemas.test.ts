import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, encodeAvatar } from './avatar';
import {
  ApiErrorSchema,
  CreateEnrolmentRequestSchema,
  CreateStudentRequestSchema,
  EnrolmentSchema,
  ItemSchema,
  NextItemsRequestSchema,
  NextItemsResponseSchema,
  PlanSchema,
  StudentSchema,
  UpdatePlanRequestSchema,
  UpdateStudentRequestSchema,
  readableErrors,
} from './schemas';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const avatarCode = encodeAvatar(DEFAULT_AVATAR);

const newStudent = { nickname: 'Quiet_Otter', avatarCode, yearGroup: 10 };
const student = { id: id(1), ...newStudent };
const enrolment = {
  studentId: id(1),
  subjectId: 'gcse-maths',
  board: 'AQA',
  tier: 'higher',
  specVersion: '8300',
};
const item = {
  id: id(2),
  topicId: 'algebra-linear-equations',
  type: 'numeric',
  body: { prompt: 'Solve 2x + 3 = 11' },
};
const plan = {
  id: id(3),
  studentId: id(1),
  weekStart: '2026-11-23',
  sessions: [{ date: '2026-11-24', subjectId: 'gcse-maths', topicId: 'ratio', minutes: 20 }],
  editedBy: 'auto',
};

function errorsFor(schema: { safeParse: (v: unknown) => unknown }, value: unknown): string[] {
  const result = schema.safeParse(value) as { success: boolean; error?: never };
  expect(result.success).toBe(false);
  return readableErrors(result.error!);
}

describe('students', () => {
  it('parses a valid student and create/update requests', () => {
    expect(StudentSchema.parse(student)).toEqual(student);
    expect(
      CreateStudentRequestSchema.parse({ nickname: 'Ace_7', avatarCode, yearGroup: 12 }),
    ).toBeTruthy();
    expect(UpdateStudentRequestSchema.parse({ yearGroup: 11 })).toEqual({ yearGroup: 11 });
  });

  it('gives readable errors for a bad nickname, avatar code and year group', () => {
    const errors = errorsFor(CreateStudentRequestSchema, {
      nickname: 'x',
      avatarCode: 'abc',
      yearGroup: 5,
    });
    expect(errors).toEqual([
      'nickname: Nickname must be at least 2 characters',
      'avatarCode: Avatar code is not valid',
      'yearGroup: Year group must be from 9 to 13',
    ]);
  });

  it('rejects blocked nicknames with a polite message', () => {
    expect(errorsFor(CreateStudentRequestSchema, { ...newStudent, nickname: 'admin' })).toEqual([
      "nickname: That looks like a real name or a word we don't allow. Try a made-up nickname like Pixel_Fox",
    ]);
  });

  it('trims spaces at either end of a nickname before it is saved', () => {
    expect(
      CreateStudentRequestSchema.parse({ ...newStudent, nickname: '  Thing 1 ' }).nickname,
    ).toBe('Thing 1');
  });

  it('never accepts unknown fields such as a real name', () => {
    expect(errorsFor(CreateStudentRequestSchema, { ...newStudent, realName: 'X' })).toEqual([
      "(root): Unrecognized key(s) in object: 'realName'",
    ]);
  });

  it('needs at least one field in an update', () => {
    expect(errorsFor(UpdateStudentRequestSchema, {})).toEqual([
      '(root): Send at least one field to change',
    ]);
  });
});

describe('enrolments', () => {
  it('parses a valid enrolment, allowing "not sure" for board and tier', () => {
    expect(EnrolmentSchema.parse(enrolment)).toEqual(enrolment);
    const unsure = { subjectId: 'gcse-biology', board: 'not_sure', tier: 'not_sure' };
    expect(CreateEnrolmentRequestSchema.parse(unsure)).toEqual(unsure);
  });

  it('gives readable errors for an unknown board', () => {
    const [error] = errorsFor(EnrolmentSchema, { ...enrolment, board: 'Hogwarts' });
    expect(error).toMatch(/^board: /);
  });
});

describe('items and next items', () => {
  it('parses a valid item and never includes the answer', () => {
    const parsed = ItemSchema.parse({ ...item, answer: { value: 4 } });
    expect(parsed).toEqual(item);
  });

  it('parses a next-items request and response', () => {
    expect(NextItemsRequestSchema.parse({})).toEqual({ count: 10 });
    expect(NextItemsResponseSchema.parse({ items: [item] })).toEqual({ items: [item] });
  });

  it('gives readable errors for an unknown item type and too many items', () => {
    expect(errorsFor(ItemSchema, { ...item, type: 'essay-ish' })[0]).toMatch(/^type: /);
    expect(errorsFor(NextItemsRequestSchema, { count: 50 })).toEqual([
      'count: Number must be less than or equal to 20',
    ]);
  });
});

describe('plans', () => {
  it('parses a valid plan and an update request', () => {
    expect(PlanSchema.parse(plan)).toEqual(plan);
    expect(UpdatePlanRequestSchema.parse({ sessions: plan.sessions })).toEqual({
      sessions: plan.sessions,
    });
  });

  it('gives readable errors for a bad date and a session with no minutes', () => {
    const bad = {
      ...plan,
      weekStart: '23/11/2026',
      sessions: [{ ...plan.sessions[0], minutes: 0 }],
    };
    expect(errorsFor(PlanSchema, bad)).toEqual([
      'weekStart: Use a date like 2026-01-31',
      'sessions.0.minutes: Number must be greater than or equal to 5',
    ]);
  });
});

describe('API errors', () => {
  it('parses the shared error shape', () => {
    const body = { error: { code: 'validation_failed', message: 'Bad input', details: ['x'] } };
    expect(ApiErrorSchema.parse(body)).toEqual(body);
  });
});
