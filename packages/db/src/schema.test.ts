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

async function tableNames(): Promise<string[]> {
  const res = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  );
  return res.rows.map((r) => r.table_name);
}

describe('database schema', () => {
  it('applies the first migration and creates every table in the data model', async () => {
    const tables = await tableNames();
    for (const t of [
      'families',
      'parents',
      'students',
      'devices',
      'enrolments',
      'topics',
      'items',
      'attempts',
      'mastery',
      'exams',
      'school_reports',
      'plans',
      'rewards',
      'streaks',
      'device_link_tokens',
      'passkey_challenges',
      'student_sessions',
      'auth_users',
      'auth_sessions',
      'auth_accounts',
      'auth_verifications',
    ]) {
      expect(tables).toContain(t);
    }
  });

  it('enforces foreign keys: a student cannot belong to a family that does not exist', async () => {
    await expect(
      client.query(
        `insert into students (family_id, nickname, avatar_code, year_group)
         values ('00000000-0000-0000-0000-000000000000', 'ghost_kid', 'a1', 10)`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });
});

describe('student constraints', () => {
  async function newFamily(): Promise<string> {
    const res = await client.query<{ id: string }>(
      'insert into families default values returning id',
    );
    return res.rows[0]!.id;
  }

  it('rejects a nickname with spaces or symbols', async () => {
    const familyId = await newFamily();
    await expect(
      client.query(
        `insert into students (family_id, nickname, avatar_code, year_group) values ($1, 'Bad Name!', 'a1', 10)`,
        [familyId],
      ),
    ).rejects.toThrow(/students_nickname_format/);
  });

  it('rejects a year group outside 7 to 13', async () => {
    const familyId = await newFamily();
    await expect(
      client.query(
        `insert into students (family_id, nickname, avatar_code, year_group) values ($1, 'owl_7', 'a1', 6)`,
        [familyId],
      ),
    ).rejects.toThrow(/students_year_group_range/);
  });

  it('does not allow two students with the same nickname in one family', async () => {
    const familyId = await newFamily();
    const insert = () =>
      client.query(
        `insert into students (family_id, nickname, avatar_code, year_group) values ($1, 'fox_1', 'a1', 11)`,
        [familyId],
      );
    await insert();
    await expect(insert()).rejects.toThrow(/students_family_nickname_unique/);
  });
});
