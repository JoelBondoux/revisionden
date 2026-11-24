import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './testing';
import { seed } from './seed';

let client: PGlite;
let db: Awaited<ReturnType<typeof createTestDb>>['db'];

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe('seed', () => {
  it('creates one made-up family with two students, a topic and an item', async () => {
    const result = await seed(db);
    expect(result.students).toHaveLength(2);
    const count = async (table: string) =>
      (await client.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n;
    expect(await count('families')).toBe(1);
    expect(await count('parents')).toBe(1);
    expect(await count('students')).toBe(2);
    expect(await count('topics')).toBeGreaterThan(0);
    expect(await count('items')).toBeGreaterThan(0);
  });

  it('can run twice without failing or duplicating content', async () => {
    await seed(db);
    const n = (await client.query<{ n: number }>(`select count(*)::int as n from topics`)).rows[0]!
      .n;
    await seed(db);
    expect(
      (await client.query<{ n: number }>(`select count(*)::int as n from topics`)).rows[0]!.n,
    ).toBe(n);
  });

  it('uses only made-up example addresses for the parent', async () => {
    await seed(db);
    const emails = (await client.query<{ email: string }>(`select email from auth_users`)).rows;
    for (const { email } of emails) expect(email).toMatch(/@example\.(com|org|net)$/);
  });
});
