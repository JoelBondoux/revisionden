import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './testing';

let client: PGlite;
let studentId: string;

beforeAll(async () => {
  ({ client } = await createTestDb());
  const family = await client.query<{ id: string }>(
    `insert into families default values returning id`,
  );
  const student = await client.query<{ id: string }>(
    `insert into students (family_id, nickname, avatar_code, year_group)
     values ($1, 'Pulsar_3', '10000000000000000000000000000', 11) returning id`,
    [family.rows[0]!.id],
  );
  studentId = student.rows[0]!.id;
});

afterAll(async () => {
  await client.close();
});

/** The claim the API makes: wins only if no claim for this passkey is newer than `since`. */
const claim = (credentialId: string, at: string, since: string) =>
  client.query(
    `insert into passkey_new_device_claims (credential_id, student_id, claimed_at)
     values ($1, $2, $3)
     on conflict (credential_id) do update set claimed_at = excluded.claimed_at
       where passkey_new_device_claims.claimed_at < $4
     returning credential_id`,
    [credentialId, studentId, at, since],
  );

describe('new device claims (B7)', () => {
  it('keeps one claim per passkey, so only one new device a day can win it', async () => {
    const first = await claim('cred-1', '2026-11-26T10:00:00Z', '2026-11-25T10:00:00Z');
    const second = await claim('cred-1', '2026-11-26T11:00:00Z', '2026-11-25T11:00:00Z');
    expect(first.rows).toHaveLength(1);
    expect(second.rows).toHaveLength(0);
    const later = await claim('cred-1', '2026-11-27T10:30:00Z', '2026-11-26T10:30:00Z');
    expect(later.rows).toHaveLength(1);
  });

  it('is deleted with the student', async () => {
    await claim('cred-2', '2026-11-26T10:00:00Z', '2026-11-25T10:00:00Z');
    await client.query(`delete from students where id = $1`, [studentId]);
    const { rows } = await client.query(`select * from passkey_new_device_claims`);
    expect(rows).toHaveLength(0);
  });
});
