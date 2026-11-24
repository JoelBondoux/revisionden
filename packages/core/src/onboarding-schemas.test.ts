import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, encodeAvatar } from './avatar';
import { OnboardChildRequestSchema, UpdateAvatarRequestSchema } from './onboarding-schemas';

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
