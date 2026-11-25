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

const insert = (ref: string) =>
  client.query(
    `insert into error_reports (ref, screen, api_path, status, build, browser, online, reported_at)
     values ($1, '/map', '/v1/student/map', 404, '00.01.002-abc', 'Safari', true, now())`,
    [ref],
  );

describe('error_reports table (workstream I)', () => {
  it('stores an anonymous report keyed by its reference code', async () => {
    await insert('RD-VDMW5E');
    const { rows } = await client.query<{ ref: string; status: number }>(
      `select ref, status from error_reports where ref = 'RD-VDMW5E'`,
    );
    expect(rows).toEqual([{ ref: 'RD-VDMW5E', status: 404 }]);
  });

  it('keeps one report per reference code', async () => {
    await insert('RD-7K2M9Q');
    await expect(insert('RD-7K2M9Q')).rejects.toThrow(/error_reports_ref_unique/);
  });

  it('only accepts known browser families', async () => {
    await expect(
      client.query(
        `insert into error_reports (ref, screen, build, browser, online, reported_at)
         values ('RD-AAAAAA', '/map', 'b', 'Netscape', true, now())`,
      ),
    ).rejects.toThrow(/error_reports_browser_values/);
  });

  it('has no column that could hold a person or a family', async () => {
    const { rows } = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'error_reports' order by column_name`,
    );
    expect(rows.map((r) => r.column_name)).toEqual([
      'api_path',
      'browser',
      'build',
      'created_at',
      'id',
      'online',
      'ref',
      'reported_at',
      'screen',
      'status',
    ]);
  });
});
