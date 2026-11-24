import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authUsers, families } from '@revisionden/db';
import { ensureParent } from './families';
import { createTestContext, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

describe('ensureParent', () => {
  it('creates exactly one family when two first requests arrive together', async () => {
    await t.db.insert(authUsers).values({ id: 'racer', email: 'racer@example.com' });
    const results = await Promise.all([
      ensureParent(t.db, 'racer'),
      ensureParent(t.db, 'racer'),
      ensureParent(t.db, 'racer'),
    ]);
    expect(new Set(results.map((r) => r.familyId)).size).toBe(1);
    expect(await t.db.select().from(families)).toHaveLength(1);
  });
});
