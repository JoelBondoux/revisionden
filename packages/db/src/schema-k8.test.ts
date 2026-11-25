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
  it('starts with no targets and keeps the parent’s and the child’s own separately', async () => {
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
    const targets = () =>
      client.query<{ parent_target_grade: string | null; student_target_grade: string | null }>(
        `select parent_target_grade, student_target_grade from enrolments
         where student_id = '${studentId}'`,
      );
    expect((await targets()).rows[0]).toEqual({
      parent_target_grade: null,
      student_target_grade: null,
    });
    await client.query(
      `update enrolments set parent_target_grade = '7', student_target_grade = '8'
       where student_id = '${studentId}'`,
    );
    expect((await targets()).rows[0]).toEqual({
      parent_target_grade: '7',
      student_target_grade: '8',
    });
  });
});
