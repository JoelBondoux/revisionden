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

describe('target grades on enrolments (workstream K8)', () => {
  it('starts with no target and keeps one once set', async () => {
    const fam = await client.query<{ id: string }>(
      `insert into families default values returning id`,
    );
    const st = await client.query<{ id: string }>(
      `insert into students (family_id, nickname, avatar_code, year_group)
       values ('${fam.rows[0]!.id}', 'k8_kid', 'a1', 10) returning id`,
    );
    const studentId = st.rows[0]!.id;
    await client.query(
      `insert into enrolments (student_id, subject_id, board, tier)
       values ('${studentId}', 'gcse-maths', 'Edexcel', 'higher')`,
    );
    const before = await client.query<{ target_grade: string | null }>(
      `select target_grade from enrolments where student_id = '${studentId}'`,
    );
    expect(before.rows[0]!.target_grade).toBeNull();
    await client.query(
      `update enrolments set target_grade = '7' where student_id = '${studentId}'`,
    );
    const after = await client.query<{ target_grade: string | null }>(
      `select target_grade from enrolments where student_id = '${studentId}'`,
    );
    expect(after.rows[0]!.target_grade).toBe('7');
  });
});
