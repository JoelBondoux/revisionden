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

async function columns(table: string): Promise<string[]> {
  const res = await client.query<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = '${table}' order by ordinal_position`,
  );
  return res.rows.map((r) => r.column_name);
}

async function makeStudent(): Promise<string> {
  const fam = await client.query<{ id: string }>(
    `insert into families default values returning id`,
  );
  const st = await client.query<{ id: string }>(
    `insert into students (family_id, nickname, avatar_code, year_group)
     values ('${fam.rows[0]!.id}', 'test_kid_${Math.floor(Math.random() * 1e6)}', 'a1', 10) returning id`,
  );
  return st.rows[0]!.id;
}

describe('reminders and AI tables (workstream H)', () => {
  it('stores push subscriptions per device with a unique endpoint', async () => {
    expect(await columns('push_subscriptions')).toEqual(
      expect.arrayContaining(['id', 'student_id', 'device_id', 'endpoint', 'p256dh', 'auth']),
    );
    const idx = await client.query<{ indexdef: string }>(
      `select indexdef from pg_indexes where tablename = 'push_subscriptions'`,
    );
    expect(idx.rows.some((r) => /unique/i.test(r.indexdef) && /endpoint/.test(r.indexdef))).toBe(
      true,
    );
  });

  it('gives a new student the default quiet hours and reminder times', async () => {
    const studentId = await makeStudent();
    await client.query(`insert into reminder_settings (student_id) values ('${studentId}')`);
    const res = await client.query<Record<string, unknown>>(
      `select * from reminder_settings where student_id = '${studentId}'`,
    );
    expect(res.rows[0]).toMatchObject({
      enabled: true,
      quiet_start: '21:00',
      quiet_end: '07:30',
      weekday_quiet_start: '08:30',
      weekday_quiet_end: '15:30',
      session_reminder_time: '16:30',
      streak_reminder_time: '19:00',
      time_zone: 'Europe/London',
    });
  });

  it('rejects a reminder time that is not HH:MM', async () => {
    const studentId = await makeStudent();
    await expect(
      client.query(
        `insert into reminder_settings (student_id, quiet_start) values ('${studentId}', '9pm')`,
      ),
    ).rejects.toThrow(/check/i);
  });

  it('logs sent reminders by local day', async () => {
    expect(await columns('reminder_log')).toEqual(
      expect.arrayContaining(['id', 'student_id', 'kind', 'local_date', 'message', 'sent_at']),
    );
  });

  it('records AI usage per child without any prompt text', async () => {
    const cols = await columns('ai_usage');
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'student_id',
        'job',
        'provider',
        'model',
        'input_tokens',
        'output_tokens',
        'cost_micro_usd',
        'created_at',
      ]),
    );
    for (const c of cols) expect(c).not.toMatch(/prompt|answer|text|body|content/);
  });
});
