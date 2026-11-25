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
     values ($1, 'Comet_7', '10000000000000000000000000000', 11) returning id`,
    [family.rows[0]!.id],
  );
  studentId = student.rows[0]!.id;
});

afterAll(async () => {
  await client.close();
});

const addDevice = (credentialId: string) =>
  client.query<{ id: string }>(
    `insert into devices (student_id, credential_id, public_key) values ($1, $2, 'key') returning id`,
    [studentId, credentialId],
  );

describe('synced passkeys (I5b)', () => {
  it('lets one synced passkey belong to several devices of the same student', async () => {
    await addDevice('synced-cred');
    await addDevice('synced-cred');
    const { rows } = await client.query(
      `select id from devices where credential_id = 'synced-cred'`,
    );
    expect(rows).toHaveLength(2);
  });

  it('keeps a device marker hash per device, unique, and keeps it when the device is unlinked', async () => {
    const device = (await addDevice('cred-m')).rows[0]!.id;
    await client.query(
      `insert into device_markers (marker_hash, device_id, student_id) values ('hash-1', $1, $2)`,
      [device, studentId],
    );
    await expect(
      client.query(
        `insert into device_markers (marker_hash, device_id, student_id) values ('hash-1', $1, $2)`,
        [device, studentId],
      ),
    ).rejects.toThrow(/device_markers_pkey/);
    await client.query(`delete from devices where id = $1`, [device]);
    const { rows } = await client.query<{ device_id: string | null }>(
      `select device_id from device_markers where marker_hash = 'hash-1'`,
    );
    // An unlinked device's marker stays, with no device, so that browser is refused.
    expect(rows).toEqual([{ device_id: null }]);
  });

  it('deletes the markers with the student', async () => {
    await client.query(`delete from students where id = $1`, [studentId]);
    const { rows } = await client.query(`select * from device_markers`);
    expect(rows).toEqual([]);
  });
});
