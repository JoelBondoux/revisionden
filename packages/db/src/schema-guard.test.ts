import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './testing';
import { findForbiddenColumns } from './schema-guard';

let client: PGlite;

beforeAll(async () => {
  ({ client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe('privacy schema guard', () => {
  it('finds no column that could hold a real name, birth date, email, photo or school name', async () => {
    expect(await findForbiddenColumns(client)).toEqual([]);
  });

  it('flags columns that would store personal details of a student', async () => {
    await client.exec(`
      create table guard_probe (
        id serial primary key,
        first_name text, surname text, full_name text, date_of_birth date, dob date,
        student_email text, photo_url text, school_name text, avatar_code text
      );
    `);
    try {
      const found = await findForbiddenColumns(client);
      expect(
        found
          .filter((f) => f.table === 'guard_probe')
          .map((f) => f.column)
          .sort(),
      ).toEqual(
        [
          'date_of_birth',
          'dob',
          'first_name',
          'full_name',
          'photo_url',
          'school_name',
          'student_email',
          'surname',
        ].sort(),
      );
    } finally {
      await client.exec('drop table guard_probe');
    }
  });

  it('only allows the parent sign-in email (and blank Better Auth fields) on auth_users', async () => {
    await client.exec(`alter table students add column name text`);
    try {
      const found = await findForbiddenColumns(client);
      expect(found).toEqual([{ table: 'students', column: 'name' }]);
    } finally {
      await client.exec('alter table students drop column name');
    }
  });

  it('allows only the operator email on the operator audit log, nothing else email-like', async () => {
    await client.exec(`alter table operator_audit_log add column parent_email text`);
    try {
      const found = await findForbiddenColumns(client);
      expect(found).toEqual([{ table: 'operator_audit_log', column: 'parent_email' }]);
    } finally {
      await client.exec('alter table operator_audit_log drop column parent_email');
    }
  });
});
