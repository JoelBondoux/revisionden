import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  DEFAULT_AVATAR,
  encodeAvatar,
  type AddSubjectRequest,
  type OnboardedChild,
  type ParentSubject,
  type UpdateSubjectChoiceRequest,
} from '@revisionden/core';
import { fakeOnboardingApi } from '../../test/fakeOnboardingApi';
import { OnboardingApiError } from './api';
import { OnboardingApiProvider } from './OnboardingApiContext';
import { SubjectsPage } from './SubjectsPage';

const ID = '11111111-1111-4111-8111-111111111111';

const subject = (subjectId: string, board: string, tier: string, hasQuestions = true) =>
  ({ studentId: ID, subjectId, board, tier, hasQuestions }) as ParentSubject;

const child: OnboardedChild = {
  student: { id: ID, nickname: 'Comet_7', avatarCode: encodeAvatar(DEFAULT_AVATAR), yearGroup: 11 },
  enrolments: [],
  level: 'gcse',
  examSeason: { season: 'summer', year: 2027 },
  toCheckLater: 0,
  linkedDevices: 0,
};

/** A fake API that keeps the child's subjects in memory, like the real one. */
function setup(initial: ParentSubject[], children: OnboardedChild[] = [child]) {
  let subjects = [...initial];
  const api = fakeOnboardingApi({
    getFamily: vi.fn(async () => ({ children })),
    getChildSubjects: vi.fn(async () => [...subjects]),
    addChildSubject: vi.fn(async (_id: string, choice: AddSubjectRequest) => {
      subjects = [...subjects, subject(choice.subjectId, choice.board, choice.tier, false)];
      return subjects.at(-1)!;
    }),
    removeChildSubject: vi.fn(async (_id: string, subjectId: string) => {
      subjects = subjects.filter((s) => s.subjectId !== subjectId);
    }),
    updateChildSubject: vi.fn(
      async (_id: string, subjectId: string, change: UpdateSubjectChoiceRequest) => {
        subjects = subjects.map((s) =>
          s.subjectId === subjectId ? ({ ...s, ...change } as ParentSubject) : s,
        );
        return subjects.find((s) => s.subjectId === subjectId)!;
      },
    ),
  });
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[`/parent/subjects/${ID}`]}>
      <OnboardingApiProvider api={api}>
        <Routes>
          <Route path="/parent/subjects/:studentId" element={<SubjectsPage />} />
        </Routes>
      </OnboardingApiProvider>
    </MemoryRouter>,
  );
  return { api, user };
}

const card = (name: string) => screen.getByRole('region', { name });

describe('SubjectsPage (parent)', () => {
  it("lists the child's subjects, with a badge where questions are coming soon", async () => {
    setup([
      subject('gcse-history', 'AQA', 'none', false),
      subject('gcse-maths', 'Edexcel', 'higher'),
    ]);
    expect(await screen.findByRole('heading', { name: "Comet_7's subjects" })).toBeInTheDocument();
    expect(within(card('History')).getByText('Questions coming soon')).toBeInTheDocument();
    expect(within(card('Maths')).queryByText('Questions coming soon')).toBeNull();
    expect(within(card('Maths')).getByRole('radio', { name: 'Pearson Edexcel' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('labels the exam board and tier rows, each grouped for screen readers', async () => {
    setup([subject('gcse-maths', 'Edexcel', 'higher'), subject('gcse-history', 'AQA', 'none')]);
    const maths = await screen.findByRole('region', { name: 'Maths' });
    const board = within(maths).getByRole('group', { name: 'Exam board' });
    const tier = within(maths).getByRole('group', { name: 'Tier' });
    expect(board.tagName).toBe('FIELDSET');
    expect(within(board).getByRole('radio', { name: 'Pearson Edexcel' })).toBeInTheDocument();
    expect(within(board).queryByRole('radio', { name: 'Higher' })).toBeNull();
    expect(within(tier).getByRole('radio', { name: 'Higher' })).toBeInTheDocument();
    expect(within(maths).getByText('Exam board')).toBeVisible();
    expect(within(maths).getByText('Tier')).toBeVisible();
    // A subject with no tiers has only the exam board row.
    const history = within(card('History'));
    expect(history.getByRole('group', { name: 'Exam board' })).toBeInTheDocument();
    expect(history.queryByRole('group', { name: 'Tier' })).toBeNull();
  });

  it('changes a board or tier', async () => {
    const { api, user } = setup([subject('gcse-maths', 'Edexcel', 'higher')]);
    await screen.findByRole('region', { name: 'Maths' });
    await user.click(within(card('Maths')).getByRole('radio', { name: 'Foundation' }));
    expect(api.updateChildSubject).toHaveBeenCalledWith(ID, 'gcse-maths', { tier: 'foundation' });
    expect(await within(card('Maths')).findByRole('radio', { name: 'Foundation' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('adds a subject with the onboarding picker, including Not sure for the board', async () => {
    const { api, user } = setup([subject('gcse-maths', 'Edexcel', 'higher')]);
    await screen.findByRole('region', { name: 'Maths' });
    const picker = screen.getByRole('group', { name: 'Add a subject' });
    // Subjects already taken are not offered again; A-Level subjects are not offered for Year 11.
    expect(within(picker).queryByRole('button', { name: 'Maths' })).toBeNull();
    expect(within(picker).queryByRole('button', { name: 'Further Maths' })).toBeNull();
    await user.click(within(picker).getByRole('button', { name: 'Physics' }));
    const board = screen.getByRole('radiogroup', { name: 'Physics exam board' });
    expect(within(board).getByRole('radio', { name: 'Not sure' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Add Physics' }));
    expect(api.addChildSubject).toHaveBeenCalledWith(ID, {
      subjectId: 'gcse-physics',
      board: 'not_sure',
      tier: 'not_sure',
    });
    expect(await screen.findByRole('region', { name: 'Physics' })).toBeInTheDocument();
  });

  it('removes a subject only after a confirm that says progress is kept', async () => {
    const { api, user } = setup([
      subject('gcse-maths', 'Edexcel', 'higher'),
      subject('gcse-history', 'AQA', 'none'),
    ]);
    await screen.findByRole('region', { name: 'History' });
    await user.click(within(card('History')).getByRole('button', { name: 'Remove' }));
    expect(
      within(card('History')).getByText(
        "Comet_7's progress in History is kept. It comes back if you add History again.",
      ),
    ).toBeInTheDocument();
    await user.click(within(card('History')).getByRole('button', { name: 'Keep it' }));
    expect(api.removeChildSubject).not.toHaveBeenCalled();
    await user.click(within(card('History')).getByRole('button', { name: 'Remove' }));
    await user.click(within(card('History')).getByRole('button', { name: 'Yes, remove History' }));
    expect(api.removeChildSubject).toHaveBeenCalledWith(ID, 'gcse-history');
    await screen.findByRole('button', { name: 'History' });
    expect(screen.queryByRole('region', { name: 'History' })).toBeNull();
  });

  it('shows the error when a change cannot be saved', async () => {
    const { api, user } = setup([subject('gcse-maths', 'Edexcel', 'higher')]);
    vi.mocked(api.updateChildSubject).mockRejectedValueOnce(
      new OnboardingApiError('invalid_subjects', 'That board or tier does not fit this subject'),
    );
    await screen.findByRole('region', { name: 'Maths' });
    await user.click(within(card('Maths')).getByRole('radio', { name: 'AQA' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That board or tier does not fit this subject',
    );
  });

  it('keeps the chosen subject when adding it fails, so the parent can try again', async () => {
    const { api, user } = setup([subject('gcse-maths', 'Edexcel', 'higher')]);
    vi.mocked(api.addChildSubject).mockRejectedValueOnce(
      new OnboardingApiError('network', 'Could not reach RevisionDen.'),
    );
    await screen.findByRole('region', { name: 'Maths' });
    await user.click(screen.getByRole('button', { name: 'Physics' }));
    const board = screen.getByRole('radiogroup', { name: 'Physics exam board' });
    await user.click(within(board).getByRole('radio', { name: 'AQA' }));
    await user.click(screen.getByRole('button', { name: 'Add Physics' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach RevisionDen.');
    expect(within(board).getByRole('radio', { name: 'AQA' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Add Physics' }));
    expect(await screen.findByRole('region', { name: 'Physics' })).toBeInTheDocument();
  });

  it('says so when the child is not in this family', async () => {
    setup([], []);
    expect(await screen.findByText('We could not find that child.')).toBeInTheDocument();
  });
});
