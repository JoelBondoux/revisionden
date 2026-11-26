import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CardsDueSchema, DailySetResponseSchema, TopicMapSchema } from '@revisionden/core';
import { syncContent } from './learning/content-sync';
import { createTestContext, type TestContext } from './test/helpers';
import { TEST_SUBJECT, testItems, testTopicTree } from './test/learning-fixtures';

type H = Record<string, string>;

/** Real subjects with no content in this test database (owner bug RD-MBXKTC). */
const EMPTY = 'gcse-chemistry';
const ALSO_EMPTY = 'gcse-drama';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [testTopicTree], items: testItems });
});

afterAll(async () => {
  await t.close();
});

const get = (path: string, headers: H) => t.app.request(path, { headers });

async function map(headers: H, query = '') {
  const res = await get(`/v1/student/map${query}`, headers);
  expect(res.status).toBe(200);
  return TopicMapSchema.parse(await res.json());
}

describe('subjects with no questions yet (RD-MBXKTC)', () => {
  it('shows "coming soon" instead of an error when no subject has questions', async () => {
    const { headers } = await t.familyStudent('empty_only', [EMPTY, ALSO_EMPTY]);
    const body = await map(headers);
    expect(body).toMatchObject({
      subjectId: EMPTY,
      subject: 'Chemistry',
      status: 'coming_soon',
      nextMission: null,
      units: [],
    });
    expect(body.subjects).toEqual([
      { subjectId: EMPTY, subject: 'Chemistry', hasContent: false },
      { subjectId: ALSO_EMPTY, subject: 'Drama', hasContent: false },
    ]);
  });

  it('opens on the first subject that has questions', async () => {
    const { headers } = await t.familyStudent('empty_first', [EMPTY, TEST_SUBJECT]);
    const body = await map(headers);
    expect(body).toMatchObject({ subjectId: TEST_SUBJECT, status: 'ready' });
    expect(body.units.length).toBeGreaterThan(0);
    expect(body.subjects!.map((s) => [s.subjectId, s.hasContent])).toEqual([
      [EMPTY, false],
      [TEST_SUBJECT, true],
    ]);
  });

  it('shows "coming soon" when a subject with no questions is chosen', async () => {
    const { headers } = await t.familyStudent('empty_chosen', [TEST_SUBJECT, EMPTY]);
    expect(await map(headers, `?subjectId=${EMPTY}`)).toMatchObject({
      subjectId: EMPTY,
      status: 'coming_soon',
    });
  });

  it('still says "choose a subject" when the student has no subjects at all', async () => {
    const { headers } = await t.familyStudent('no_subjects', []);
    expect((await get('/v1/student/map', headers)).status).toBe(404);
  });

  it('gives an empty 5-a-day, no due cards, an empty deck list and no recall', async () => {
    const { headers } = await t.familyStudent('empty_rest', [EMPTY]);
    const daily = await get('/v1/student/daily', headers);
    expect(daily.status).toBe(200);
    expect(DailySetResponseSchema.parse(await daily.json())).toMatchObject({ items: [], total: 0 });
    const due = await get('/v1/student/cards/due', headers);
    expect(due.status).toBe(200);
    expect(CardsDueSchema.parse(await due.json()).due).toBe(0);
    const cards = await get('/v1/student/flashcards', headers);
    expect(cards.status).toBe(200);
    const recall = await get('/v1/student/recall?topicId=test-topic-a', headers);
    expect(recall.status).toBe(200);
    expect(((await recall.json()) as { items: unknown[] }).items).toEqual([]);
  });
});
