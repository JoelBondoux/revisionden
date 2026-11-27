import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PAST_PAPER_PAGES, type Enrolment } from '@revisionden/core';
import { fakeOnboardingApi } from '../../test/fakeOnboardingApi';
import { OnboardingApiProvider } from '../onboarding/OnboardingApiContext';
import type { OnboardingApi } from '../onboarding/api';
import { PastPapersPage } from './PastPapersPage';

const ID = '11111111-1111-4111-8111-111111111111';
const enrol = (subjectId: string, board: string) =>
  ({ studentId: ID, subjectId, board, tier: 'higher' }) as Enrolment;
const url = (board: keyof typeof PAST_PAPER_PAGES) =>
  (PAST_PAPER_PAGES[board] as { url: string }).url;

function renderPage(api: OnboardingApi, subjectId = 'gcse-maths') {
  return render(
    <MemoryRouter initialEntries={[`/learn/subject/${subjectId}/past-papers`]}>
      <OnboardingApiProvider api={api}>
        <Routes>
          <Route path="/learn/subject/:subjectId/past-papers" element={<PastPapersPage />} />
        </Routes>
      </OnboardingApiProvider>
    </MemoryRouter>,
  );
}

describe('PastPapersPage', () => {
  it("shows the student's own board first, then the other boards", async () => {
    const api = fakeOnboardingApi({
      getMySubjects: vi.fn(async () => ({
        enrolments: [enrol('gcse-maths', 'Edexcel')],
        toCheckLater: 0,
      })),
    });
    renderPage(api);
    expect(
      await screen.findByRole('heading', { name: 'GCSE Maths past papers' }),
    ).toBeInTheDocument();
    const yours = screen.getByRole('region', { name: 'Your exam board' });
    const own = within(yours).getByRole('link', { name: /Pearson Edexcel/ });
    expect(own).toHaveAttribute('href', url('Edexcel'));
    const others = screen.getByRole('region', { name: 'Other boards' });
    expect(
      within(others)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([
      expect.stringContaining('AQA'),
      expect.stringContaining('OCR'),
      expect.stringContaining('WJEC Eduqas'),
    ]);
  });

  it("opens each board's own site in a new tab, and says where the papers are", async () => {
    const api = fakeOnboardingApi({
      getMySubjects: vi.fn(async () => ({
        enrolments: [enrol('gcse-maths', 'AQA')],
        toCheckLater: 0,
      })),
    });
    renderPage(api);
    expect(
      await screen.findByText("Papers and mark schemes are on the exam board's website."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "These links take you to the exam board's own website. It is not part of RevisionDen and has its own rules, so check with a parent if you're not sure.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The newest papers are sometimes for teachers only, so ask your teacher if you can't find one.",
      ),
    ).toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      // The board never learns which app page a child came from (L, 2026-11-27).
      expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
      expect(link).toHaveAccessibleName(/opens in a new tab/);
    }
  });

  it('lists every board that offers the subject when the board is not known yet', async () => {
    const api = fakeOnboardingApi({
      getMySubjects: vi.fn(async () => ({
        enrolments: [enrol('gcse-maths', 'not_sure')],
        toCheckLater: 1,
      })),
    });
    renderPage(api);
    const others = await screen.findByRole('region', { name: 'Exam boards' });
    expect(within(others).getAllByRole('link')).toHaveLength(4);
    expect(
      screen.getByText("Papers and mark schemes are on each exam board's website."),
    ).toBeInTheDocument();
    expect(screen.getByText(/each exam board's own website/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your exam board' })).toBeNull();
  });

  it('still lists the boards if the subjects cannot be loaded', async () => {
    const api = fakeOnboardingApi({
      getMySubjects: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    renderPage(api, 'gcse-film-studies');
    const others = await screen.findByRole('region', { name: 'Exam boards' });
    expect(within(others).getByRole('link', { name: /WJEC Eduqas/ })).toHaveAttribute(
      'href',
      url('Eduqas'),
    );
  });
});
