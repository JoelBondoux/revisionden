import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, encodeAvatar } from './avatar';
import {
  AddSubjectRequestSchema,
  OnboardChildRequestSchema,
  ParentSubjectsSchema,
  UpdateAvatarRequestSchema,
} from './onboarding-schemas';

const valid = {
  nickname: 'Comet_7',
  avatarCode: encodeAvatar(DEFAULT_AVATAR),
  yearGroup: 10,
  subjects: [{ subjectId: 'gcse-maths', board: 'AQA', tier: 'higher' }],
};

describe('OnboardChildRequestSchema', () => {
  it('accepts a nickname, avatar, school year and subjects', () => {
    expect(OnboardChildRequestSchema.parse(valid)).toEqual(valid);
  });

  it('only takes Years 9 to 13', () => {
    const result = OnboardChildRequestSchema.safeParse({ ...valid, yearGroup: 8 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('School year must be from 9 to 13');
    expect(OnboardChildRequestSchema.safeParse({ ...valid, yearGroup: 14 }).success).toBe(false);
  });

  it('rejects unknown fields, so a real name is never stored', () => {
    expect(OnboardChildRequestSchema.safeParse({ ...valid, realName: 'x' }).success).toBe(false);
    const extraOnSubject = { ...valid, subjects: [{ ...valid.subjects[0], school: 'x' }] };
    expect(OnboardChildRequestSchema.safeParse(extraOnSubject).success).toBe(false);
  });
});

describe('UpdateAvatarRequestSchema', () => {
  it('needs a well-formed avatar code', () => {
    expect(UpdateAvatarRequestSchema.safeParse({ avatarCode: 'nope' }).success).toBe(false);
    expect(UpdateAvatarRequestSchema.safeParse({ avatarCode: valid.avatarCode }).success).toBe(
      true,
    );
  });
});

describe('UpdateSubjectChoiceRequestSchema', () => {
  it('needs a board or a tier, and nothing else', async () => {
    const { UpdateSubjectChoiceRequestSchema } = await import('./onboarding-schemas');
    expect(UpdateSubjectChoiceRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateSubjectChoiceRequestSchema.safeParse({ board: 'AQA' }).success).toBe(true);
    expect(UpdateSubjectChoiceRequestSchema.safeParse({ tier: 'higher', x: 1 }).success).toBe(
      false,
    );
  });
});

describe('ParentSubjectsSchema', () => {
  it('says for each subject whether questions are ready yet', () => {
    const subject = {
      studentId: '00000000-0000-4000-8000-000000000001',
      subjectId: 'gcse-history',
      board: 'AQA',
      tier: 'none',
      hasQuestions: false,
    };
    expect(ParentSubjectsSchema.parse({ subjects: [subject] }).subjects[0]!.hasQuestions).toBe(
      false,
    );
    expect(() =>
      ParentSubjectsSchema.parse({ subjects: [{ ...subject, hasQuestions: 'no' }] }),
    ).toThrow();
  });

  it('adds a subject with the same fields as onboarding', () => {
    expect(
      AddSubjectRequestSchema.safeParse({
        subjectId: 'gcse-maths',
        board: 'not_sure',
        tier: 'higher',
      }).success,
    ).toBe(true);
    expect(AddSubjectRequestSchema.safeParse({ subjectId: 'gcse-maths' }).success).toBe(false);
  });
});
