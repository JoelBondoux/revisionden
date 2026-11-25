import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './testing';

let client: PGlite;

beforeAll(async () => {
  ({ client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe('items review snapshot', () => {
  it('has an optional review_snapshot column holding the full content item', async () => {
    const res = await client.query<{ data_type: string; is_nullable: string }>(
      `select data_type, is_nullable from information_schema.columns
       where table_name = 'items' and column_name = 'review_snapshot'`,
    );
    expect(res.rows).toEqual([{ data_type: 'jsonb', is_nullable: 'YES' }]);
  });
});
