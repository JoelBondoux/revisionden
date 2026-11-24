import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddChildForm } from './AddChildForm';

function setup(onSubmit = vi.fn(async () => undefined)) {
  const user = userEvent.setup();
  render(
    <AddChildForm
      onSubmit={onSubmit}
      onCancel={() => undefined}
      random={() => 0}
      today={new Date('2026-11-24')}
    />,
  );
  return { user, onSubmit };
}

const continueButton = () => screen.getByRole('button', { name: /^Continue/ });

async function fillBasics(user: ReturnType<typeof userEvent.setup>, year = 'Year 11') {
  await user.type(screen.getByLabelText('Nickname'), 'Comet_7');
  await user.click(screen.getByRole('radio', { name: year }));
}

describe('AddChildForm', () => {
  it('explains that the nickname is not a real name', () => {
    setup();
    expect(screen.getByLabelText('Nickname')).toHaveAccessibleDescription(
      'Not their real name. Friends only ever see this.',
    );
  });

  it('checks the nickname with the shared rules', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Nickname'), 'a b');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nickname can only use letters, numbers and underscores',
    );
    expect(continueButton()).toBeDisabled();
  });

  it('offers GCSE Years 9 to 11 and A-Level Years 12 and 13', () => {
    setup();
    const gcse = screen.getByRole('radiogroup', { name: 'GCSE' });
    const aLevel = screen.getByRole('radiogroup', { name: 'A-Level' });
    expect(
      within(gcse)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Year 9', 'Year 10', 'Year 11']);
    expect(
      within(aLevel)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Year 12', 'Year 13']);
  });

  it('shows the subjects for the level and the exams it works out', async () => {
    const { user } = setup();
    await fillBasics(user);
    expect(screen.getByText('Exams in summer 2027')).toBeInTheDocument();
    const subjects = screen.getByRole('group', { name: 'Subjects' });
    expect(within(subjects).getByRole('button', { name: 'Film Studies' })).toBeInTheDocument();
    expect(within(subjects).queryByRole('button', { name: 'Further Maths' })).toBeNull();
  });

  it('offers only the boards that teach a subject, plus Not sure', async () => {
    const { user } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: 'French' }));
    const boards = screen.getByRole('radiogroup', { name: 'French exam board' });
    expect(
      within(boards)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['AQA', 'Pearson Edexcel', 'WJEC Eduqas', 'Not sure']);
    const tiers = screen.getByRole('radiogroup', { name: 'French tier' });
    expect(
      within(tiers)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Foundation', 'Higher', 'Not sure']);
  });

  it('picks WJEC Eduqas for Film Studies because it is the only board, and asks no tier', async () => {
    const { user } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: 'Film Studies' }));
    expect(screen.getByRole('radio', { name: 'WJEC Eduqas' })).toBeChecked();
    expect(screen.queryByRole('radiogroup', { name: 'Film Studies tier' })).toBeNull();
  });

  it('counts boards and tiers left as Not sure on the Continue button', async () => {
    const { user } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: 'Maths' }));
    expect(continueButton()).toHaveTextContent('Continue · 2 to check later');
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Maths exam board' })).getByRole('radio', {
        name: 'AQA',
      }),
    );
    expect(continueButton()).toHaveTextContent('Continue · 1 to check later');
    await user.click(screen.getByRole('radio', { name: 'Higher' }));
    expect(continueButton()).toHaveTextContent(/^Continue$/);
  });

  it('clears the subjects when the level changes', async () => {
    const { user } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(screen.getByRole('radio', { name: 'Year 10' }));
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('radio', { name: 'Year 12' }));
    expect(screen.getByRole('button', { name: 'Further Maths' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByRole('radiogroup', { name: 'History exam board' })).toBeNull();
  });

  it('sends the nickname, avatar, year and subject choices', async () => {
    const { user, onSubmit } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(screen.getByRole('radio', { name: 'OCR' }));
    await user.click(continueButton());
    expect(onSubmit).toHaveBeenCalledWith({
      nickname: 'Comet_7',
      avatarCode: expect.stringMatching(/^1[0-9a-z]{28}$/),
      yearGroup: 11,
      subjects: [{ subjectId: 'gcse-history', board: 'OCR', tier: 'none' }],
    });
  });

  it('turns a subject off when its chip is pressed again', async () => {
    const { user } = setup();
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.queryByRole('radiogroup', { name: 'History exam board' })).toBeNull();
  });

  it('opens the avatar builder and keeps the chosen look', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Nickname'), 'Comet_7');
    await user.click(screen.getByRole('button', { name: 'Edit avatar' }));
    const dialog = screen.getByRole('dialog', { name: 'Build an avatar' });
    await user.click(within(dialog).getByRole('tab', { name: 'Holding' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guitar' }));
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const preview = screen.getByRole('img', { name: "Comet_7's avatar" });
    expect(preview.querySelector('[data-layer="heldItem"]')).toHaveAttribute('data-item', 'guitar');
  });

  it('shows a server error such as a nickname already used', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Another student in the family has that nickname');
    });
    const { user } = setup(onSubmit);
    await fillBasics(user);
    await user.click(continueButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Another student in the family has that nickname',
    );
  });
});
