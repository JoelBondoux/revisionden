import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  DEFAULT_AVATAR,
  encodeAvatar,
  type Enrolment,
  type OnboardedChild,
} from '@revisionden/core';
import { fakeOnboardingApi } from '../../test/fakeOnboardingApi';
import type { OnboardingApi } from './api';
import { MySubjectsCard, SubjectsNudge, ThingsToCheckCard } from './checksUi';
import { OnboardingApiProvider } from './OnboardingApiContext';

const ID = '11111111-1111-4111-8111-111111111111';
const enrol = (subjectId: string, board: string, tier: string) =>
  ({ studentId: ID, subjectId, board, tier }) as Enrolment;

const child = (enrolments: Enrolment[], toCheckLater: number): OnboardedChild => ({
  student: { id: ID, nickname: 'Comet_7', avatarCode: encodeAvatar(DEFAULT_AVATAR), yearGroup: 11 },
  enrolments,
  level: 'gcse',
  examSeason: { season: 'summer', year: 2027 },
  toCheckLater,
  linkedDevices: 0,
});

function renderWith(api: OnboardingApi, ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <OnboardingApiProvider api={api}>{ui}</OnboardingApiProvider>
    </MemoryRouter>,
  );
}

describe('ThingsToCheckCard (parent)', () => {
  it('shows how many things are left to check and lets the parent set them', async () => {
    let enrolments = [
      enrol('gcse-maths', 'not_sure', 'not_sure'),
      enrol('gcse-history', 'AQA', 'none'),
    ];
    const api = fakeOnboardingApi({
      getFamily: vi.fn(async () => ({
        children: [child(enrolments, enrolments.filter((e) => e.board === 'not_sure').length * 2)],
      })),
      updateChildSubject: vi.fn(async (_id, subjectId, change) => {
        enrolments = enrolments.map((e) =>
          e.subjectId === subjectId ? ({ ...e, ...change } as Enrolment) : e,
        );
        return enrolments.find((e) => e.subjectId === subjectId)!;
      }),
    });
    const user = userEvent.setup();
    renderWith(api, <ThingsToCheckCard />);
    expect(await screen.findByRole('heading', { name: 'Things to check: 2' })).toBeInTheDocument();
    const boards = screen.getByRole('radiogroup', { name: 'Comet_7: Maths exam board' });
    expect(
      within(boards)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['AQA', 'Pearson Edexcel', 'OCR', 'WJEC Eduqas']);
    await user.click(within(boards).getByRole('radio', { name: 'OCR' }));
    expect(api.updateChildSubject).toHaveBeenCalledWith(ID, 'gcse-maths', { board: 'OCR' });
  });

  it('shows nothing when everything is set', async () => {
    const api = fakeOnboardingApi({
      getFamily: vi.fn(async () => ({
        children: [child([enrol('gcse-history', 'AQA', 'none')], 0)],
      })),
    });
    const { container } = renderWith(api, <ThingsToCheckCard />);
    await vi.waitFor(() => expect(api.getFamily).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a save error', async () => {
    const api = fakeOnboardingApi({
      getFamily: vi.fn(async () => ({
        children: [child([enrol('gcse-history', 'not_sure', 'none')], 1)],
      })),
      updateChildSubject: vi.fn(async () => {
        throw new Error('Could not reach RevisionDen.');
      }),
    });
    const user = userEvent.setup();
    renderWith(api, <ThingsToCheckCard />);
    await user.click(await screen.findByRole('radio', { name: 'AQA' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach RevisionDen.');
  });
});

describe('MySubjectsCard (student settings)', () => {
  it('lists the student subjects and lets them set only Not sure ones', async () => {
    const api = fakeOnboardingApi({
      getMySubjects: vi.fn(async () => ({
        enrolments: [
          enrol('gcse-maths', 'AQA', 'not_sure'),
          enrol('gcse-film-studies', 'Eduqas', 'none'),
        ],
        toCheckLater: 1,
      })),
      updateMySubject: vi.fn(async () => enrol('gcse-maths', 'AQA', 'higher')),
    });
    const user = userEvent.setup();
    renderWith(api, <MySubjectsCard />);
    expect(await screen.findByRole('heading', { name: 'My subjects' })).toBeInTheDocument();
    expect(screen.getByText('Film Studies')).toBeInTheDocument();
    expect(screen.getByText('WJEC Eduqas')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: /Maths exam board/ })).toBeNull();
    const tiers = screen.getByRole('radiogroup', { name: 'Maths tier' });
    expect(
      within(tiers)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Foundation', 'Higher']);
    await user.click(within(tiers).getByRole('radio', { name: 'Higher' }));
    expect(api.updateMySubject).toHaveBeenCalledWith('gcse-maths', { tier: 'higher' });
  });

  it('says when there are no subjects yet', async () => {
    renderWith(fakeOnboardingApi(), <MySubjectsCard />);
    expect(
      await screen.findByText('No subjects yet. Ask a parent to add them.'),
    ).toBeInTheDocument();
  });
});

describe('SubjectsNudge (student home)', () => {
  it('nudges gently until the Not sure items are set', async () => {
    const api = fakeOnboardingApi({
      getMySubjects: vi.fn(async () => ({
        enrolments: [enrol('gcse-maths', 'not_sure', 'not_sure')],
        toCheckLater: 2,
      })),
    });
    renderWith(api, <SubjectsNudge />);
    const link = await screen.findByRole('link', { name: /2 things to check/ });
    expect(link).toHaveAttribute('href', '/settings#my-subjects');
  });

  it('stays hidden when nothing is left, or the check fails', async () => {
    const api = fakeOnboardingApi({
      getMySubjects: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const { container } = renderWith(api, <SubjectsNudge />);
    await vi.waitFor(() => expect(api.getMySubjects).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('says one thing in the singular', async () => {
    const api = fakeOnboardingApi({
      getMySubjects: vi.fn(async () => ({
        enrolments: [enrol('gcse-maths', 'AQA', 'not_sure')],
        toCheckLater: 1,
      })),
    });
    renderWith(api, <SubjectsNudge />);
    expect(await screen.findByRole('link', { name: /1 thing to check/ })).toBeInTheDocument();
  });
});
