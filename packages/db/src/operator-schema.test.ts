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

describe('operator_notes and feedback_replies tables (O3)', () => {
  async function family() {
    const { rows } = await client.query<{ id: string }>(
      `insert into families default values returning id`,
    );
    return rows[0]!.id;
  }

  it('keeps internal notes on a family, at most 2000 characters, deleted with the family', async () => {
    const id = await family();
    await client.query(
      `insert into operator_notes (family_id, author_email, text) values ($1, 'agent@example.com', 'Called back')`,
      [id],
    );
    await expect(
      client.query(
        `insert into operator_notes (family_id, author_email, text) values ($1, 'agent@example.com', $2)`,
        [id, 'x'.repeat(2001)],
      ),
    ).rejects.toThrow(/operator_notes_text_length/);
    await client.query(`delete from families where id = $1`, [id]);
    const { rows } = await client.query(`select 1 from operator_notes where family_id = $1`, [id]);
    expect(rows).toEqual([]);
  });

  it('keeps replies to a ticket, at most 5000 characters, deleted with the ticket', async () => {
    const id = await family();
    const { rows } = await client.query<{ id: string }>(
      `insert into feedback (family_id, sender_role, kind) values ($1, 'parent', 'bug') returning id`,
      [id],
    );
    const ticket = rows[0]!.id;
    await client.query(
      `insert into feedback_replies (feedback_id, author_email, body) values ($1, 'agent@example.com', 'Fixed now')`,
      [ticket],
    );
    await expect(
      client.query(
        `insert into feedback_replies (feedback_id, author_email, body) values ($1, 'a@example.com', $2)`,
        [ticket, 'x'.repeat(5001)],
      ),
    ).rejects.toThrow(/feedback_replies_body_length/);
    await client.query(`delete from feedback where id = $1`, [ticket]);
    const left = await client.query(`select 1 from feedback_replies where feedback_id = $1`, [
      ticket,
    ]);
    expect(left.rows).toEqual([]);
  });
});

describe('data_requests table (O3b)', () => {
  it('records an emailed export or deletion request with its deadline, and keeps it after the family is gone', async () => {
    await client.query(
      `insert into data_requests (family_id, kind, received_at, due_at, logged_by)
       values (gen_random_uuid(), 'deletion', now(), now() + interval '1 month', 'agent@example.com')`,
    );
    await expect(
      client.query(
        `insert into data_requests (family_id, kind, received_at, due_at, logged_by)
         values (gen_random_uuid(), 'rename', now(), now(), 'agent@example.com')`,
      ),
    ).rejects.toThrow(/data_requests_kind_values/);
    const fks = await client.query(
      `select 1 from information_schema.table_constraints
       where table_name = 'data_requests' and constraint_type = 'FOREIGN KEY'`,
    );
    expect(fks.rows).toEqual([]);
  });
});

describe('family_tags and family_tag_links tables (O6)', () => {
  it('keeps tag names unique and colours as #rrggbb, and links a family to a tag once', async () => {
    const tag = (name: string, colour = '#6c47f5') =>
      client.query<{ id: string }>(
        `insert into family_tags (name, colour, description, created_by) values ($1, $2, '', 'manager@example.com') returning id`,
        [name, colour],
      );
    const { rows } = await tag('Beta tester');
    await expect(tag('Beta tester')).rejects.toThrow(/family_tags_name_unique/);
    await expect(tag('Press', 'red')).rejects.toThrow(/family_tags_colour_format/);
    const { rows: fam } = await client.query<{ id: string }>(
      `insert into families default values returning id`,
    );
    const link = () =>
      client.query(
        `insert into family_tag_links (family_id, tag_id, added_by) values ($1, $2, 'agent@example.com')`,
        [fam[0]!.id, rows[0]!.id],
      );
    await link();
    await expect(link()).rejects.toThrow(/family_tag_links_pkey/);
    await client.query(`delete from families where id = $1`, [fam[0]!.id]);
    const left = await client.query(`select 1 from family_tag_links where tag_id = $1`, [
      rows[0]!.id,
    ]);
    expect(left.rows).toEqual([]);
  });
});
