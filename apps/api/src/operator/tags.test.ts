import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  OperatorFamilyDetailSchema,
  OperatorFamilySearchResultSchema,
  OperatorOverviewSchema,
} from '@revisionden/core';
import { operatorAuditLog, parents } from '@revisionden/db';
import { createTestContext, type TestContext } from '../test/helpers';
import { signedOperatorRequest, TEST_OPERATOR_SECRET } from '../test/operator';
import { effectsForFamily } from './tags';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext({ config: { operatorBridge: { secret: TEST_OPERATOR_SECRET } } });
});
afterEach(async () => {
  await t.close();
});

async function call(method: string, path: string, body?: unknown, role = 'manager') {
  const res = await t.app.request(
    ...(await signedOperatorRequest({
      clock: t.clock,
      method,
      path: `/operator/appdeck${path}`,
      body,
      role,
    })),
  );
  const json = (await res.json()) as { data?: unknown; error?: { code: string } };
  return { status: res.status, data: json.data, code: json.error?.code };
}

const off = {
  betaProgramme: false,
  earlyAccess: false,
  complimentaryPremium: false,
  excludeFromMetrics: false,
};
const tagBody = (name: string, effects = {}) => ({
  name,
  colour: '#6C47F5',
  description: 'A support label',
  effects: { ...off, ...effects },
});

async function createTag(name: string, effects = {}) {
  const res = await call('POST', '/tags', tagBody(name, effects));
  return (res.data as { tag: { id: string } }).tag.id;
}

async function makeFamily(nickname = 'test_kid') {
  const { parent } = await t.familyStudent(nickname);
  const [row] = await t.db
    .select({ familyId: parents.familyId })
    .from(parents)
    .where(eq(parents.authUserId, parent.userId));
  return { familyId: row!.familyId, headers: parent.headers };
}

const tags = async () =>
  (
    (await call('GET', '/tags', undefined, 'agent')).data as {
      tags: { id: string; familyCount: number; retiredAt: string | null }[];
    }
  ).tags;

describe('tag catalogue (Managers)', () => {
  it('creates, lists, edits and retires a tag; Agents can only look', async () => {
    const res = await call('POST', '/tags', tagBody('Beta tester', { betaProgramme: true }));
    expect(res.status).toBe(200);
    const tag = (res.data as { tag: Record<string, unknown> }).tag;
    expect(tag).toEqual({
      id: expect.any(String),
      name: 'Beta tester',
      colour: '#6c47f5',
      description: 'A support label',
      effects: { ...off, betaProgramme: true },
      familyCount: 0,
      retiredAt: null,
    });
    expect((await call('POST', '/tags', tagBody('Press'), 'agent')).status).toBe(403);

    expect((await call('POST', `/tags/${tag.id as string}`, tagBody('Beta testers'))).data).toEqual(
      {
        ok: true,
      },
    );
    expect((await call('POST', `/tags/${tag.id as string}/retire`, {})).data).toEqual({ ok: true });
    expect(await tags()).toEqual([
      expect.objectContaining({ name: 'Beta testers', retiredAt: expect.any(String) }),
    ]);
    const actions = (await t.db.select().from(operatorAuditLog)).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['tag.create', 'tag.edit', 'tag.retire']));
  });

  it('refuses a duplicate name and personal information in a tag', async () => {
    await createTag('Press');
    expect(await call('POST', '/tags', tagBody('Press'))).toMatchObject({
      status: 409,
      code: 'tag_taken',
    });
    expect((await call('POST', '/tags', tagBody('parent@example.com'))).status).toBe(400);
  });
});

describe('tags on a family (Agents)', () => {
  it('adds and removes a tag, shown on the family, its search hit and the tag count', async () => {
    const f = await makeFamily();
    const id = await createTag('Friends & family');
    expect(
      (await call('POST', `/families/${f.familyId}/tags`, { tagId: id }, 'agent')).data,
    ).toEqual({
      ok: true,
    });
    const detail = OperatorFamilyDetailSchema.parse(
      (await call('GET', `/families/${f.familyId}`)).data,
    );
    expect(detail.tags).toEqual([{ id, name: 'Friends & family', colour: '#6c47f5' }]);
    const search = OperatorFamilySearchResultSchema.parse(
      (await call('POST', '/families/search', { familyId: f.familyId })).data,
    );
    expect(search.families[0]!.tags).toEqual([{ id, name: 'Friends & family', colour: '#6c47f5' }]);
    expect((await tags())[0]!.familyCount).toBe(1);

    expect(
      (await call('POST', `/families/${f.familyId}/tags/${id}/remove`, {}, 'agent')).data,
    ).toEqual({ ok: true });
    expect(
      OperatorFamilyDetailSchema.parse((await call('GET', `/families/${f.familyId}`)).data).tags,
    ).toEqual([]);
    const actions = (await t.db.select().from(operatorAuditLog)).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['family.tag_add', 'family.tag_remove']));
  });

  it('refuses a retired or unknown tag, and an unknown family', async () => {
    const f = await makeFamily();
    const id = await createTag('Old label');
    await call('POST', `/tags/${id}/retire`, {});
    expect(
      await call('POST', `/families/${f.familyId}/tags`, { tagId: id }, 'agent'),
    ).toMatchObject({
      status: 409,
      code: 'tag_retired',
    });
    expect(
      (await call('POST', `/families/${f.familyId}/tags`, { tagId: crypto.randomUUID() }, 'agent'))
        .status,
    ).toBe(404);
    const live = await createTag('Live label');
    expect(
      (await call('POST', `/families/${crypto.randomUUID()}/tags`, { tagId: live }, 'agent'))
        .status,
    ).toBe(404);
  });

  it('lists the families with a tag: id, parent emails, plan and tags only, audited', async () => {
    const a = await makeFamily('kid_a');
    await makeFamily('kid_b');
    const id = await createTag('Press');
    await call('POST', `/families/${a.familyId}/tags`, { tagId: id }, 'agent');
    const res = await call('GET', `/families?tag=${id}`, undefined, 'agent');
    expect(res.data).toEqual({
      families: [
        {
          id: a.familyId,
          parents: [{ email: expect.stringMatching(/@example\.com$/) }],
          plan: null,
          tags: [{ id, name: 'Press', colour: '#6c47f5' }],
        },
      ],
    });
    expect(await t.db.select().from(operatorAuditLog)).toContainEqual(
      expect.objectContaining({ action: 'families.by_tag', targetType: 'tag', targetId: id }),
    );
    expect((await call('GET', '/families?tag=not-a-tag', undefined, 'agent')).status).toBe(400);
  });
});

describe('tag effects', () => {
  it('leaves families tagged "exclude from metrics" out of the overview', async () => {
    const a = await makeFamily('kid_a');
    await makeFamily('kid_b');
    const id = await createTag('Test account', { excludeFromMetrics: true });
    await call('POST', `/families/${a.familyId}/tags`, { tagId: id }, 'agent');
    const overview = OperatorOverviewSchema.parse((await call('GET', '/overview')).data);
    expect(overview).toMatchObject({ families: 1, students: 1 });
  });

  it("gives other code a family's live effects; a retired tag has none", async () => {
    const f = await makeFamily();
    const early = await createTag('Early access', { earlyAccess: true });
    const comp = await createTag('VIP', { complimentaryPremium: true });
    await call('POST', `/families/${f.familyId}/tags`, { tagId: early }, 'agent');
    await call('POST', `/families/${f.familyId}/tags`, { tagId: comp }, 'agent');
    await call('POST', `/tags/${comp}/retire`, {});
    expect(await effectsForFamily(t.db, f.familyId)).toEqual({ ...off, earlyAccess: true });
  });

  it('shows the family only the beta programme, and lets a parent leave it', async () => {
    const f = await makeFamily();
    const beta = await createTag('Beta tester', { betaProgramme: true, earlyAccess: true });
    const press = await createTag('Press');
    await call('POST', `/families/${f.familyId}/tags`, { tagId: beta }, 'agent');
    await call('POST', `/families/${f.familyId}/tags`, { tagId: press }, 'agent');

    const programmes = async () =>
      (await (
        await t.app.request('/v1/family/programmes', { headers: f.headers })
      ).json()) as unknown;
    expect(await programmes()).toEqual({ beta: true });
    expect(JSON.stringify(await programmes())).not.toContain('Press');

    const left = await t.app.request('/v1/family/programmes/beta', {
      method: 'DELETE',
      headers: f.headers,
    });
    expect(left.status).toBe(204);
    expect(await programmes()).toEqual({ beta: false });
    // Only the beta tag goes; internal tags stay.
    const detail = OperatorFamilyDetailSchema.parse(
      (await call('GET', `/families/${f.familyId}`)).data,
    );
    expect(detail.tags.map((x) => x.name)).toEqual(['Press']);
  });
});
