import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { devices, reviewerRoles, studentSessions } from '@revisionden/db';
import { isQuarantined, quarantinedItemIds } from './routes/quarantine';
import { STUDENT_COOKIE } from './routes/devices';
import { hashToken } from './tokens';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;
const confirmed: { itemId: string; itemVersion: number }[] = [];

beforeEach(async () => {
  confirmed.length = 0;
  t = await createTestContext({
    verification: {
      randomSeed: () => 42,
      onConfirmedError: async (job) => void confirmed.push(job),
    },
  });
});
afterEach(async () => {
  await t.close();
});

async function parentWithStudent() {
  const parent = await t.signInParent();
  const res = await t.app.request(
    '/v1/students',
    jsonRequest(
      'POST',
      { nickname: 'quiz_fox', avatarCode: AVATAR, yearGroup: 10 },
      parent.headers,
    ),
  );
  const student = (await res.json()) as { id: string };
  const [device] = await t.db
    .insert(devices)
    .values({ studentId: student.id, credentialId: `cred-${student.id}`, publicKey: 'pk' })
    .returning();
  const token = `student-token-${student.id}`;
  await t.db.insert(studentSessions).values({
    tokenHash: await hashToken(token),
    studentId: student.id,
    deviceId: device!.id,
    expiresAt: new Date(t.clock.now().getTime() + 60 * 60 * 1000),
  });
  return { parent, student: { headers: { cookie: `${STUDENT_COOKIE}=${token}` } } };
}

async function reviewer(role: 'subject-specialist' | 'content-lead' = 'subject-specialist') {
  const user = await t.signInParent();
  await t.db.insert(reviewerRoles).values({ authUserId: user.userId, role });
  return user.headers;
}

const report = (headers: Record<string, string>, itemId = 'fixture-item', body?: object) =>
  t.app.request(
    `/v1/student/items/${itemId}/reports`,
    jsonRequest('POST', body ?? { itemVersion: 2, reason: 'wrong_answer' }, headers),
  );

describe('report a problem', () => {
  it('a student report hides the item from every student at once', async () => {
    const { student } = await parentWithStudent();
    const res = await report(student.headers);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ quarantined: true });
    expect(await quarantinedItemIds(t.db)).toEqual(new Set(['fixture-item']));
  });

  it('tells the learning loop whether one item is hidden', async () => {
    const { student } = await parentWithStudent();
    expect(await isQuarantined(t.db, 'fixture-item')).toBe(false);
    await report(student.headers);
    expect(await isQuarantined(t.db, 'fixture-item')).toBe(true);
  });

  it('a parent can report too', async () => {
    const { parent } = await parentWithStudent();
    const res = await t.app.request(
      '/v1/items/fixture-item/reports',
      jsonRequest('POST', { itemVersion: 1, reason: 'unclear' }, parent.headers),
    );
    expect(res.status).toBe(201);
    expect(await quarantinedItemIds(t.db)).toEqual(new Set(['fixture-item']));
  });

  it('needs a signed-in student or parent', async () => {
    const res = await report({});
    expect(res.status).toBe(401);
  });

  it('accepts only a known reason and never free text', async () => {
    const { student } = await parentWithStudent();
    expect(
      (await report(student.headers, 'fixture-item', { itemVersion: 1, reason: 'boring' })).status,
    ).toBe(400);
    const extra = { itemVersion: 1, reason: 'typo', detail: 'my name is ...' };
    expect((await report(student.headers, 'fixture-item', extra)).status).toBe(400);
  });

  it('rejects an item id that is not a content id', async () => {
    const { student } = await parentWithStudent();
    expect((await report(student.headers, 'Not An Id!')).status).toBe(400);
  });
});

describe('review queue access', () => {
  it('is only for accounts with a reviewer role', async () => {
    const { parent } = await parentWithStudent();
    expect((await t.app.request('/v1/review/reports', { headers: parent.headers })).status).toBe(
      403,
    );
    expect((await t.app.request('/v1/review/reports')).status).toBe(401);
    const headers = await reviewer();
    const me = await t.app.request('/v1/review/me', { headers });
    expect(await me.json()).toEqual({ role: 'subject-specialist' });
  });
});

describe('deciding reports', () => {
  it('lists open reports with the item, version and reason, but nothing about who reported', async () => {
    const { student } = await parentWithStudent();
    await report(student.headers);
    const headers = await reviewer();
    const res = await t.app.request('/v1/review/reports?status=open', { headers });
    const { reports } = (await res.json()) as { reports: Record<string, unknown>[] };
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      itemId: 'fixture-item',
      itemVersion: 2,
      reason: 'wrong_answer',
      status: 'open',
    });
    expect(Object.keys(reports[0]!)).not.toContain('familyId');
  });

  it('no error: the item comes back once no open report is left', async () => {
    const { student } = await parentWithStudent();
    const first = (await (await report(student.headers)).json()) as { reportId: string };
    const second = (await (await report(student.headers)).json()) as { reportId: string };
    const headers = await reviewer();
    const decide = (id: string) =>
      t.app.request(
        `/v1/review/reports/${id}/decision`,
        jsonRequest('POST', { decision: 'no_error' }, headers),
      );
    expect((await decide(first.reportId)).status).toBe(200);
    expect(await quarantinedItemIds(t.db)).toEqual(new Set(['fixture-item']));
    await decide(second.reportId);
    expect(await quarantinedItemIds(t.db)).toEqual(new Set());
  });

  it('confirmed error: the item stays hidden, scores are queued for recalculation and siblings re-checked', async () => {
    const { student } = await parentWithStudent();
    const { reportId } = (await (await report(student.headers)).json()) as { reportId: string };
    const headers = await reviewer('content-lead');
    const res = await t.app.request(
      `/v1/review/reports/${reportId}/decision`,
      jsonRequest(
        'POST',
        { decision: 'confirmed_error', notes: 'Option 2 is also correct.' },
        headers,
      ),
    );
    expect(res.status).toBe(200);
    expect(await quarantinedItemIds(t.db)).toEqual(new Set(['fixture-item']));
    expect(confirmed).toEqual([{ itemId: 'fixture-item', itemVersion: 2 }]);

    const jobs = await (
      await t.app.request('/v1/review/recalculations?status=pending', { headers })
    ).json();
    expect(jobs).toMatchObject({
      jobs: [{ itemId: 'fixture-item', itemVersion: 2, status: 'pending' }],
    });
    const rechecks = await (
      await t.app.request('/v1/review/rechecks?status=pending', { headers })
    ).json();
    expect(rechecks).toMatchObject({ rechecks: [{ scope: 'item', scopeValue: 'fixture-item' }] });

    const decided = await (
      await t.app.request('/v1/review/reports?item=fixture-item', { headers })
    ).json();
    expect(decided).toMatchObject({
      reports: [{ status: 'confirmed_error', decidedByRole: 'content-lead' }],
    });
  });

  it('a report can be decided only once', async () => {
    const { student } = await parentWithStudent();
    const { reportId } = (await (await report(student.headers)).json()) as { reportId: string };
    const headers = await reviewer();
    const decide = () =>
      t.app.request(
        `/v1/review/reports/${reportId}/decision`,
        jsonRequest('POST', { decision: 'no_error' }, headers),
      );
    await decide();
    expect((await decide()).status).toBe(409);
  });

  it('an unknown report is not found', async () => {
    const headers = await reviewer();
    const res = await t.app.request(
      '/v1/review/reports/00000000-0000-0000-0000-000000000000/decision',
      jsonRequest('POST', { decision: 'no_error' }, headers),
    );
    expect(res.status).toBe(404);
  });
});

const batchItems = (n: number, approvalAt: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({
    itemId: `fixture-item-${i}`,
    itemVersion: 1,
    needsHumanApproval: approvalAt.includes(i),
    snapshot: { prompt: `Fixture question ${i}?`, answer: { accepted: ['x'] } },
  }));

async function createBatch(headers: Record<string, string>, n = 400, approvalAt: number[] = []) {
  const res = await t.app.request(
    '/v1/review/batches',
    jsonRequest(
      'POST',
      {
        title: 'Fixture batch',
        writerPrompt: 'fixture-prompt-v1',
        sourceUrl: 'https://www.gov.uk/fixture',
        items: batchItems(n, approvalAt),
      },
      headers,
    ),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; sample: string[]; sampleSize: number };
}

const templateSnapshot = (i: number, approved = true) => ({
  type: 'numeric',
  prompt: `Template question ${i}?`,
  template: { id: 'fixture-template', version: 1, seed: i + 1 },
  verification: {
    status: 'draft',
    checks: [
      { name: 'maths-engine', result: 'pass' },
      ...(approved
        ? [
            {
              name: 'template-approval',
              result: 'pass',
              tool: 'content-lead',
              tool_version: 'fixture-template v1',
            },
          ]
        : []),
    ],
  },
});

async function postBatch(headers: Record<string, string>, items: unknown[]) {
  const res = await t.app.request(
    '/v1/review/batches',
    jsonRequest('POST', { title: 'Template batch', items }, headers),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as { sample: string[]; sampleSize: number; samplingRule: string };
}

describe('template batch sampling (decision 0010)', () => {
  const templateItems = (n: number, approved = true) =>
    Array.from({ length: n }, (_, i) => ({
      itemId: `fixture-template-item-${i}`,
      itemVersion: 1,
      snapshot: templateSnapshot(i, approved),
    }));

  it('samples 3% (at least 10) when every item is from an approved template', async () => {
    const headers = await reviewer();
    const batch = await postBatch(headers, templateItems(300));
    expect(batch.samplingRule).toBe('template');
    expect(batch.sample).toHaveLength(10);
  });

  it('keeps 10% (at least 30) for a batch that mixes in a hand-written item', async () => {
    const headers = await reviewer();
    const items = [...templateItems(299), ...batchItems(1)];
    const batch = await postBatch(headers, items);
    expect(batch.samplingRule).toBe('standard');
    expect(batch.sample).toHaveLength(30);
  });

  it('keeps 10% (at least 30) when the template preview is not approved', async () => {
    const headers = await reviewer();
    const batch = await postBatch(headers, templateItems(300, false));
    expect(batch.samplingRule).toBe('standard');
    expect(batch.sample).toHaveLength(30);
  });
});

describe('batch sampling', () => {
  it('draws 10% (at least 30) plus every item that needs approval, replayably', async () => {
    const headers = await reviewer();
    const batch = await createBatch(headers, 400, [7]);
    expect(batch.sample).toHaveLength(41);
    expect(batch.sample).toContain('fixture-item-7');
    const again = await createBatch(headers, 400, [7]);
    expect(again.sample).toEqual(batch.sample);
  });

  it('always reviews extended answers individually, even when not flagged', async () => {
    const headers = await reviewer();
    const items = batchItems(400).map((i, n) =>
      n === 9 ? { ...i, snapshot: { ...i.snapshot, type: 'extended_answer' } } : i,
    );
    const res = await t.app.request(
      '/v1/review/batches',
      jsonRequest('POST', { title: 'Fixture batch', items }, headers),
    );
    const batch = (await res.json()) as { sample: string[] };
    expect(batch.sample).toContain('fixture-item-9');
    expect(batch.sample).toHaveLength(41);
  });

  it('shows the reviewer only the sampled items, with what they need to check', async () => {
    const headers = await reviewer();
    const batch = await createBatch(headers, 50);
    const res = await t.app.request(`/v1/review/batches/${batch.id}`, { headers });
    const body = (await res.json()) as {
      status: string;
      items: { itemId: string; snapshot: unknown }[];
    };
    expect(body.status).toBe('in_review');
    expect(body.items).toHaveLength(30);
    expect(body.items[0]).toHaveProperty('snapshot');
  });

  it('passes the batch when every sampled item is approved, recording the role', async () => {
    const headers = await reviewer();
    const batch = await createBatch(headers, 35);
    let last: Response | undefined;
    for (const itemId of batch.sample) {
      last = await t.app.request(
        `/v1/review/batches/${batch.id}/items/${itemId}/decision`,
        jsonRequest('POST', { decision: 'approved' }, headers),
      );
    }
    expect(await last!.json()).toMatchObject({ status: 'passed' });
    const detail = (await (
      await t.app.request(`/v1/review/batches/${batch.id}`, { headers })
    ).json()) as {
      items: { decidedByRole: string }[];
    };
    expect(detail.items.every((i) => i.decidedByRole === 'subject-specialist')).toBe(true);
  });

  it('one confirmed error fails the whole batch and sends it back for re-checking', async () => {
    const headers = await reviewer();
    const batch = await createBatch(headers, 35);
    const res = await t.app.request(
      `/v1/review/batches/${batch.id}/items/${batch.sample[0]}/decision`,
      jsonRequest('POST', { decision: 'confirmed_error', notes: 'Wrong unit.' }, headers),
    );
    expect(await res.json()).toMatchObject({ status: 'failed' });
    const { rechecks } = (await (
      await t.app.request('/v1/review/rechecks?status=pending', { headers })
    ).json()) as {
      rechecks: { scope: string; scopeValue: string }[];
    };
    expect(rechecks.map((r) => [r.scope, r.scopeValue]).sort()).toEqual([
      ['batch', batch.id],
      ['source', 'https://www.gov.uk/fixture'],
      ['writer_prompt', 'fixture-prompt-v1'],
    ]);
  });

  it('refuses a decision on an item outside the sample or on a closed batch', async () => {
    const headers = await reviewer();
    const batch = await createBatch(headers, 400);
    const outside = batchItems(400).find((i) => !batch.sample.includes(i.itemId))!.itemId;
    const decide = (itemId: string) =>
      t.app.request(
        `/v1/review/batches/${batch.id}/items/${itemId}/decision`,
        jsonRequest('POST', { decision: 'approved' }, headers),
      );
    expect((await decide(outside)).status).toBe(409);
    await t.app.request(
      `/v1/review/batches/${batch.id}/items/${batch.sample[0]}/decision`,
      jsonRequest('POST', { decision: 'confirmed_error' }, headers),
    );
    expect((await decide(batch.sample[1]!)).status).toBe(409);
  });

  it('lists batches with their progress', async () => {
    const headers = await reviewer();
    await createBatch(headers, 35);
    const { batches } = (await (await t.app.request('/v1/review/batches', { headers })).json()) as {
      batches: { title: string; sampleSize: number; decided: number; status: string }[];
    };
    expect(batches).toMatchObject([
      { title: 'Fixture batch', sampleSize: 30, decided: 0, status: 'in_review' },
    ]);
  });

  it('rejects an empty batch or one with duplicate items', async () => {
    const headers = await reviewer();
    const post = (items: unknown[]) =>
      t.app.request('/v1/review/batches', jsonRequest('POST', { title: 'x', items }, headers));
    expect((await post([])).status).toBe(400);
    expect((await post([...batchItems(1), ...batchItems(1)])).status).toBe(400);
  });
});

describe('re-checks and recalculation', () => {
  it('a reviewer can trigger a re-check by hand and mark it done', async () => {
    const headers = await reviewer();
    const res = await t.app.request(
      '/v1/review/rechecks',
      jsonRequest(
        'POST',
        {
          scope: 'source',
          scopeValue: 'https://www.aqa.org.uk/x.pdf',
          cause: 'Board reissued the specification',
        },
        headers,
      ),
    );
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(
      (await t.app.request(`/v1/review/rechecks/${id}/done`, { method: 'POST', headers })).status,
    ).toBe(200);
    const pending = await (
      await t.app.request('/v1/review/rechecks?status=pending', { headers })
    ).json();
    expect(pending).toEqual({ rechecks: [] });
  });

  it('a recalculation job can be marked done', async () => {
    const { student } = await parentWithStudent();
    const { reportId } = (await (await report(student.headers)).json()) as { reportId: string };
    const headers = await reviewer();
    await t.app.request(
      `/v1/review/reports/${reportId}/decision`,
      jsonRequest('POST', { decision: 'confirmed_error' }, headers),
    );
    const { jobs } = (await (
      await t.app.request('/v1/review/recalculations', { headers })
    ).json()) as { jobs: { id: string }[] };
    const done = await t.app.request(`/v1/review/recalculations/${jobs[0]!.id}/done`, {
      method: 'POST',
      headers,
    });
    expect(done.status).toBe(200);
    expect(
      (
        await t.app.request(`/v1/review/recalculations/${jobs[0]!.id}/done`, {
          method: 'POST',
          headers,
        })
      ).status,
    ).toBe(404);
  });
});
