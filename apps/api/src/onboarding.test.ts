import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AVATAR_CATALOGUE,
  DEFAULT_AVATAR,
  encodeAvatar,
  OnboardedChildSchema,
  OnboardingFamilySchema,
  StudentAvatarSchema,
} from '@revisionden/core';
import { enrolments, rewards } from '@revisionden/db';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

type Headers = Record<string, string>;

const LOCKED_SKIN = encodeAvatar({
  ...DEFAULT_AVATAR,
  skin: AVATAR_CATALOGUE.skin.findIndex((i) => i.id === 'alien'),
});

const child = (overrides: Record<string, unknown> = {}) => ({
  nickname: 'Comet_7',
  avatarCode: AVATAR,
  yearGroup: 11,
  subjects: [
    { subjectId: 'gcse-maths', board: 'Edexcel', tier: 'higher' },
    { subjectId: 'gcse-film-studies', board: 'Eduqas', tier: 'none' },
    { subjectId: 'gcse-physics', board: 'not_sure', tier: 'not_sure' },
  ],
  ...overrides,
});

function addChild(headers: Headers, body: unknown) {
  return t.app.request('/v1/onboarding/children', jsonRequest('POST', body, headers));
}

describe('POST /v1/onboarding/children', () => {
  it('needs a signed-in parent', async () => {
    const res = await addChild({}, child());
    expect(res.status).toBe(401);
  });

  it('adds a child with subjects, boards and tiers, and works out the exams', async () => {
    const { headers } = await t.signInParent();
    const res = await addChild(headers, child());
    expect(res.status).toBe(201);
    const body = OnboardedChildSchema.parse(await res.json());
    expect(body.student).toMatchObject({ nickname: 'Comet_7', yearGroup: 11, avatarCode: AVATAR });
    expect(body.level).toBe('gcse');
    expect(body.examSeason).toEqual({ season: 'summer', year: 2027 });
    expect(body.toCheckLater).toBe(2);
    expect(body.enrolments.map((e) => e.subjectId).sort()).toEqual([
      'gcse-film-studies',
      'gcse-maths',
      'gcse-physics',
    ]);
  });

  it('allows a child with no subjects yet', async () => {
    const { headers } = await t.signInParent();
    const res = await addChild(headers, child({ subjects: [], yearGroup: 9 }));
    expect(res.status).toBe(201);
    const body = OnboardedChildSchema.parse(await res.json());
    expect(body.examSeason).toEqual({ season: 'summer', year: 2029 });
    expect(body.enrolments).toEqual([]);
  });

  it('rejects a subject, board or tier that does not fit the school year', async () => {
    const { headers } = await t.signInParent();
    const res = await addChild(
      headers,
      child({
        yearGroup: 12,
        subjects: [
          { subjectId: 'gcse-maths', board: 'AQA', tier: 'higher' },
          { subjectId: 'alevel-computer-science', board: 'Edexcel', tier: 'none' },
        ],
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details: string[] } };
    expect(body.error.code).toBe('invalid_subjects');
    expect(body.error.details).toEqual([
      'gcse-maths: not a subject for this school year',
      'alevel-computer-science: that exam board does not offer this subject',
    ]);
    const list = OnboardingFamilySchema.parse(
      await (await t.app.request('/v1/onboarding/family', { headers })).json(),
    );
    expect(list.children).toEqual([]);
  });

  it('only takes Years 9 to 13', async () => {
    const { headers } = await t.signInParent();
    const res = await addChild(headers, child({ yearGroup: 8, subjects: [] }));
    expect(res.status).toBe(400);
  });

  it('rejects a locked avatar item, because a new child has earned nothing yet', async () => {
    const { headers } = await t.signInParent();
    const res = await addChild(headers, child({ avatarCode: LOCKED_SKIN }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details: string[] } };
    expect(body.error.code).toBe('avatar_locked');
    expect(body.error.details).toEqual(['skin: needs the 100-day streak reward']);
  });

  it('rejects unknown fields such as a real name', async () => {
    const { headers } = await t.signInParent();
    const res = await addChild(headers, { ...child(), realName: 'Someone' });
    expect(res.status).toBe(400);
  });

  it('rejects a nickname already used in the family', async () => {
    const { headers } = await t.signInParent();
    expect((await addChild(headers, child({ subjects: [] }))).status).toBe(201);
    const res = await addChild(headers, child());
    expect(res.status).toBe(409);
    const list = OnboardingFamilySchema.parse(
      await (await t.app.request('/v1/onboarding/family', { headers })).json(),
    );
    expect(list.children).toHaveLength(1);
    expect(list.children[0]!.enrolments).toEqual([]);
  });
  it('saves nothing when the subjects cannot be saved', async () => {
    const { headers } = await t.signInParent();
    const realInsert = t.db.insert.bind(t.db);
    const spy = vi.spyOn(t.db, 'insert').mockImplementation(((table: unknown) => {
      if (table === enrolments) throw new Error('database went away');
      return realInsert(table as never);
    }) as typeof t.db.insert);
    const res = await addChild(headers, child({ nickname: 'Pulsar' }));
    spy.mockRestore();
    expect(res.status).toBe(500);
    const list = OnboardingFamilySchema.parse(
      await (await t.app.request('/v1/onboarding/family', { headers })).json(),
    );
    expect(list.children).toEqual([]);
  });
});

describe('GET /v1/onboarding/family', () => {
  it('lists each child with subjects, exams, checks left and linked devices', async () => {
    const { headers } = await t.signInParent();
    await addChild(headers, child());
    await addChild(
      headers,
      child({
        nickname: 'Nova',
        yearGroup: 12,
        subjects: [{ subjectId: 'alevel-further-maths', board: 'OCR', tier: 'none' }],
      }),
    );
    const res = await t.app.request('/v1/onboarding/family', { headers });
    expect(res.status).toBe(200);
    const body = OnboardingFamilySchema.parse(await res.json());
    expect(body.children.map((c) => c.student.nickname)).toEqual(['Comet_7', 'Nova']);
    expect(body.children[1]).toMatchObject({
      level: 'a_level',
      examSeason: { season: 'summer', year: 2028 },
      toCheckLater: 0,
      linkedDevices: 0,
    });
  });

  it('never shows another family’s children', async () => {
    const a = await t.signInParent();
    const b = await t.signInParent();
    await addChild(a.headers, child({ nickname: 'Orbit' }));
    const body = OnboardingFamilySchema.parse(
      await (await t.app.request('/v1/onboarding/family', { headers: b.headers })).json(),
    );
    expect(body.children).toEqual([]);
  });
});

describe('student avatar', () => {
  async function newChildId(headers: Headers) {
    const res = await addChild(headers, child({ subjects: [] }));
    return OnboardedChildSchema.parse(await res.json()).student.id;
  }

  it('shows the avatar code and the rewards earned so far', async () => {
    const { headers } = await t.signInParent();
    const id = await newChildId(headers);
    await t.db.insert(rewards).values({ studentId: id, rewardId: 'streak-7' });
    const res = await t.app.request(`/v1/students/${id}/avatar`, { headers });
    expect(res.status).toBe(200);
    expect(StudentAvatarSchema.parse(await res.json())).toEqual({
      avatarCode: AVATAR,
      earnedRewardIds: ['streak-7'],
    });
  });

  it('saves a new avatar code', async () => {
    const { headers } = await t.signInParent();
    const id = await newChildId(headers);
    const code = encodeAvatar({ ...DEFAULT_AVATAR, hairStyle: 3, heldItem: 1 });
    const res = await t.app.request(
      `/v1/students/${id}/avatar`,
      jsonRequest('PUT', { avatarCode: code }, headers),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { avatarCode: string }).avatarCode).toBe(code);
  });

  it('only allows a locked item once its reward is earned', async () => {
    const { headers } = await t.signInParent();
    const id = await newChildId(headers);
    const put = () =>
      t.app.request(
        `/v1/students/${id}/avatar`,
        jsonRequest('PUT', { avatarCode: LOCKED_SKIN }, headers),
      );
    expect((await put()).status).toBe(400);
    await t.db.insert(rewards).values({ studentId: id, rewardId: 'streak-100' });
    expect((await put()).status).toBe(200);
  });

  it('rejects a malformed code', async () => {
    const { headers } = await t.signInParent();
    const id = await newChildId(headers);
    const res = await t.app.request(
      `/v1/students/${id}/avatar`,
      jsonRequest('PUT', { avatarCode: 'zz' }, headers),
    );
    expect(res.status).toBe(400);
  });

  it('cannot read or change another family’s child', async () => {
    const a = await t.signInParent();
    const b = await t.signInParent();
    const id = await newChildId(a.headers);
    expect((await t.app.request(`/v1/students/${id}/avatar`, { headers: b.headers })).status).toBe(
      404,
    );
    const put = await t.app.request(
      `/v1/students/${id}/avatar`,
      jsonRequest('PUT', { avatarCode: AVATAR }, b.headers),
    );
    expect(put.status).toBe(404);
  });
});
