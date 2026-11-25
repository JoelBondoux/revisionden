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

const columns = async (table: string) =>
  (
    await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = $1 order by column_name`,
      [table],
    )
  ).rows.map((r) => r.column_name);

describe('operator_audit_log table (workstream O)', () => {
  it('records who did what to which target, and when', async () => {
    await client.query(
      `insert into operator_audit_log (operator_email, operator_role, action, target_type, target_id, request_id, outcome)
       values ('operator@example.com', 'agent', 'family.view', 'family', 'f-1', 'req-1', 'ok')`,
    );
    const { rows } = await client.query<{ action: string; outcome: string }>(
      `select action, outcome from operator_audit_log where request_id = 'req-1'`,
    );
    expect(rows).toEqual([{ action: 'family.view', outcome: 'ok' }]);
  });

  it('only accepts the Agent and Manager roles', async () => {
    await expect(
      client.query(
        `insert into operator_audit_log (operator_email, operator_role, action, request_id, outcome)
         values ('operator@example.com', 'owner', 'ping', 'req-2', 'ok')`,
      ),
    ).rejects.toThrow(/operator_audit_log_role_values/);
  });

  it('only accepts ok or denied as the outcome', async () => {
    await expect(
      client.query(
        `insert into operator_audit_log (operator_email, operator_role, action, request_id, outcome)
         values ('operator@example.com', 'agent', 'ping', 'req-3', 'maybe')`,
      ),
    ).rejects.toThrow(/operator_audit_log_outcome_values/);
  });

  it('keeps entries after a family is deleted: the target is a plain id, not a foreign key', async () => {
    expect(await columns('operator_audit_log')).toEqual([
      'action',
      'created_at',
      'id',
      'operator_email',
      'operator_role',
      'outcome',
      'request_id',
      'target_id',
      'target_type',
    ]);
    const { rows } = await client.query(
      `select 1 from information_schema.table_constraints
       where table_name = 'operator_audit_log' and constraint_type = 'FOREIGN KEY'`,
    );
    expect(rows).toEqual([]);
  });
});

describe('operator_requests table (request ids, workstream O)', () => {
  it('keeps one row per request id', async () => {
    const insert = () =>
      client.query(
        `insert into operator_requests (request_id, method, path, body_hash)
         values ('req-dup', 'POST', '/operator/appdeck/x', 'abc')`,
      );
    await insert();
    await expect(insert()).rejects.toThrow(/operator_requests_pkey/);
  });

  it('stores only what is needed to replay a change: no operator or family columns', async () => {
    expect(await columns('operator_requests')).toEqual([
      'body_hash',
      'created_at',
      'method',
      'path',
      'request_id',
      'response_body',
      'response_status',
    ]);
  });
});
