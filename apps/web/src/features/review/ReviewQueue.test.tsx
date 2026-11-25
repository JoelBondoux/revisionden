import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';

const BATCH_ID = '11111111-1111-4111-8111-111111111111';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';

const openReport = {
  id: REPORT_ID,
  itemId: 'fixture-item',
  itemVersion: 2,
  reason: 'wrong_answer',
  reportedBy: 'student',
  status: 'open',
  reportedAt: '2026-11-24T10:00:00.000Z',
  decidedAt: null,
  decidedByRole: null,
  decisionNotes: null,
};

const sampleItem = (itemId: string, decision: string | null = null) => ({
  itemId,
  itemVersion: 1,
  needsHumanApproval: false,
  snapshot: {
    prompt: `Fixture question for ${itemId}?`,
    answer: { accepted: ['fixture answer'] },
    citations: [{ publisher: 'Fixture board', location: 'page 3', quote: 'fixture quoted words' }],
  },
  decision,
  decidedByRole: decision ? 'subject-specialist' : null,
  decisionNotes: null,
  decidedAt: null,
});

function reviewerApi({ role = 'subject-specialist' as string | null } = {}) {
  const decisions: unknown[] = [];
  let status = 'in_review';
  server.use(
    http.get('*/v1/review/me', () =>
      role
        ? HttpResponse.json({ role })
        : HttpResponse.json({ error: { code: 'forbidden', message: 'no' } }, { status: 403 }),
    ),
    http.get('*/v1/review/reports', () => HttpResponse.json({ reports: [openReport] })),
    http.post('*/v1/review/reports/:id/decision', async ({ request, params }) => {
      decisions.push({ report: params.id, ...((await request.json()) as object) });
      return HttpResponse.json({ id: params.id, status: 'no_error' });
    }),
    http.get('*/v1/review/batches', () =>
      HttpResponse.json({
        batches: [
          {
            id: BATCH_ID,
            title: 'Fixture batch',
            status,
            createdAt: '2026-11-24T09:00:00.000Z',
            size: 300,
            sampleSize: 30,
            decided: 1,
          },
        ],
      }),
    ),
    http.get(`*/v1/review/batches/${BATCH_ID}`, () =>
      HttpResponse.json({
        id: BATCH_ID,
        title: 'Fixture batch',
        status,
        sampleSeed: 42,
        createdAt: '2026-11-24T09:00:00.000Z',
        decidedAt: null,
        items: [sampleItem('fixture-item-1', 'approved'), sampleItem('fixture-item-2')],
      }),
    ),
    http.post(
      `*/v1/review/batches/${BATCH_ID}/items/:itemId/decision`,
      async ({ request, params }) => {
        const body = (await request.json()) as { decision: string };
        decisions.push({ item: params.itemId, ...body });
        status = body.decision === 'confirmed_error' ? 'failed' : 'in_review';
        return HttpResponse.json({ itemId: params.itemId, decision: body.decision, status });
      },
    ),
  );
  return { decisions };
}

describe('Review queue', () => {
  it('shows the reviewer role, open reports and batches', async () => {
    reviewerApi();
    renderRoute('/review');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Review queue' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Signed in as subject-specialist/)).toBeInTheDocument();
    const reports = await screen.findByRole('region', { name: 'Reported problems' });
    expect(within(reports).getByText('fixture-item')).toBeInTheDocument();
    expect(within(reports).getByText(/Wrong answer/)).toBeInTheDocument();
    const batches = screen.getByRole('region', { name: 'Batches' });
    expect(within(batches).getByRole('link', { name: /Fixture batch/ })).toBeInTheDocument();
    expect(within(batches).getByText('1 of 30 sampled items decided')).toBeInTheDocument();
  });

  it('records a decision on a report', async () => {
    const { decisions } = reviewerApi();
    renderRoute('/review');
    const reports = await screen.findByRole('region', { name: 'Reported problems' });
    await userEvent.click(within(reports).getByRole('button', { name: 'No error' }));
    expect(decisions).toEqual([{ report: REPORT_ID, decision: 'no_error' }]);
    expect(await screen.findByText('Decision saved.')).toHaveAttribute('role', 'status');
  });

  it('asks before confirming an error, because it hides the item and re-checks its batch', async () => {
    const { decisions } = reviewerApi();
    renderRoute('/review');
    const reports = await screen.findByRole('region', { name: 'Reported problems' });
    await userEvent.click(within(reports).getByRole('button', { name: 'Confirm error' }));
    expect(decisions).toEqual([]);
    await userEvent.type(screen.getByLabelText('What is wrong?'), 'Option 2 is also right');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, confirm the error' }));
    expect(decisions).toEqual([
      { report: REPORT_ID, decision: 'confirmed_error', notes: 'Option 2 is also right' },
    ]);
  });

  it('tells someone without a reviewer role that the page is not for them', async () => {
    reviewerApi({ role: null });
    renderRoute('/review');
    expect(await screen.findByText('This page is for reviewers only.')).toBeInTheDocument();
  });
});

describe('Batch review', () => {
  it('shows each sampled item with its answer and sources, and the sampling rule', async () => {
    reviewerApi();
    renderRoute(`/review/batches/${BATCH_ID}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fixture batch' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/One confirmed error sends the whole batch back/)).toBeInTheDocument();
    const item = screen.getByRole('article', { name: 'fixture-item-2' });
    expect(within(item).getByText(/Fixture question for fixture-item-2\?/)).toBeInTheDocument();
    expect(within(item).getByText(/fixture quoted words/)).toBeInTheDocument();
    const done = screen.getByRole('article', { name: 'fixture-item-1' });
    expect(within(done).getByText('Approved by subject-specialist')).toBeInTheDocument();
  });

  it('shows the hint, mark scheme, example answers and the checks the item passed', async () => {
    reviewerApi();
    const proof = {
      ...sampleItem('fixture-proof'),
      needsHumanApproval: true,
      snapshot: {
        prompt: 'Fixture proof question?',
        hint: 'Fixture hint words',
        mark_scheme: ['M1 fixture method mark'],
        mark_scheme_detail: {
          type: 'points',
          points: [{ code: 'B1', description: 'Fixture scheme point' }],
        },
        exemplars: [{ band: 'top', level: 3, answer: 'Fixture top answer' }],
        verification: {
          status: 'draft',
          version: 1,
          checks: [
            { name: 'quote-check', result: 'pass', tool: 't', tool_version: '1', at: 'x' },
            { name: 'blind-marking', result: 'fail', tool: 't', tool_version: '1', at: 'x' },
          ],
        },
        citations: [],
      },
    };
    const levels = {
      ...sampleItem('fixture-essay'),
      snapshot: {
        prompt: 'Fixture essay?',
        mark_scheme_detail: {
          type: 'levels',
          levels: [{ level: 2, marks: [3, 4], descriptor: 'Fixture level descriptor' }],
        },
      },
    };
    server.use(
      http.get(`*/v1/review/batches/${BATCH_ID}`, () =>
        HttpResponse.json({
          id: BATCH_ID,
          title: 'Fixture batch',
          status: 'in_review',
          sampleSeed: 42,
          createdAt: '2026-11-24T09:00:00.000Z',
          decidedAt: null,
          items: [proof, levels],
        }),
      ),
    );
    renderRoute(`/review/batches/${BATCH_ID}`);
    const item = await screen.findByRole('article', { name: 'fixture-proof' });
    expect(within(item).getByText('Fixture hint words')).toBeInTheDocument();
    expect(within(item).getByText('M1 fixture method mark')).toBeInTheDocument();
    expect(within(item).getByText(/B1: Fixture scheme point/)).toBeInTheDocument();
    expect(within(item).getByText(/Top \(3\): Fixture top answer/)).toBeInTheDocument();
    expect(within(item).getByText('quote-check: pass')).toBeInTheDocument();
    expect(within(item).getByText('blind-marking: FAIL')).toBeInTheDocument();
    const essay = screen.getByRole('article', { name: 'fixture-essay' });
    expect(
      within(essay).getByText(/Level 2 \(3–4 marks\): Fixture level descriptor/),
    ).toBeInTheDocument();
  });

  it('approves an item', async () => {
    const { decisions } = reviewerApi();
    renderRoute(`/review/batches/${BATCH_ID}`);
    const item = await screen.findByRole('article', { name: 'fixture-item-2' });
    await userEvent.click(within(item).getByRole('button', { name: 'Approve' }));
    expect(decisions).toEqual([{ item: 'fixture-item-2', decision: 'approved' }]);
  });

  it('shows that the batch failed after a confirmed error', async () => {
    reviewerApi();
    renderRoute(`/review/batches/${BATCH_ID}`);
    const item = await screen.findByRole('article', { name: 'fixture-item-2' });
    await userEvent.click(within(item).getByRole('button', { name: 'Confirm error' }));
    await userEvent.type(screen.getByLabelText('What is wrong?'), 'Wrong unit');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, confirm the error' }));
    expect(await screen.findByText(/This batch failed/)).toBeInTheDocument();
  });

  it('offers a retry when the batch cannot be loaded', async () => {
    reviewerApi();
    server.use(http.get(`*/v1/review/batches/${BATCH_ID}`, () => HttpResponse.error()));
    renderRoute(`/review/batches/${BATCH_ID}`);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
