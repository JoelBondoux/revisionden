import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentProvider } from '../../../session/StudentContext';
import { renderRoute } from '../../../test/render';
import { EffectStyleCard } from './EffectStyleCard';
import { EffectStyleProvider } from './EffectStyleProvider';

const childOnDevice = {
  getItem: (k: string) => (k === 'revisionden.studentId' ? 'student-1' : null),
  setItem: () => undefined,
};

function renderCard(unlocked: string[]) {
  return render(
    <StudentProvider storage={childOnDevice}>
      <EffectStyleProvider loadUnlocked={async () => unlocked}>
        <EffectStyleCard />
      </EffectStyleProvider>
    </StudentProvider>,
  );
}

// J10b: the child picks their effect style in Settings. Locked styles show a preview and how to
// unlock them, and cannot be chosen yet.
describe('effect style picker', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.effectStyle;
  });

  it('offers every style with Sticker Book chosen by default', async () => {
    renderCard([]);
    const group = screen.getByRole('group', { name: 'Effect style' });
    expect(within(group).getAllByRole('radio')).toHaveLength(6);
    expect(within(group).getByRole('radio', { name: /^Sticker Book/ })).toBeChecked();
  });

  it('shows how to unlock a locked style, and it cannot be chosen yet', async () => {
    renderCard(['pop-burst']);
    const starlight = await screen.findByRole('radio', { name: /^Starlight/ });
    expect(starlight).toBeDisabled();
    expect(starlight).toHaveAccessibleName(
      expect.stringMatching(/Locked\. Unlock: Master 10 topics/),
    );
    expect(await screen.findByRole('radio', { name: /^Pop Burst/ })).toBeEnabled();
  });

  it('offers Garden Grow, Comic Pop and Pixel Arcade once unlocked', async () => {
    renderCard(['comic-pop']);
    expect(await screen.findByRole('radio', { name: /^Comic Pop/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /^Pixel Arcade/ })).toHaveAccessibleName(
      expect.stringMatching(/Locked\. Unlock: Reach level 40/),
    );
  });

  it('switches to an unlocked style straight away and remembers it', async () => {
    renderCard(['pop-burst']);
    const pop = await screen.findByRole('radio', { name: /^Pop Burst/ });
    await userEvent.click(pop);
    expect(pop).toBeChecked();
    expect(document.documentElement.dataset.effectStyle).toBe('pop-burst');
    expect(localStorage.getItem('revisionden.effectStyle')).toBe('pop-burst');
  });

  it('appears in Settings for a student, not for a parent', async () => {
    const { unmount } = renderRoute('/settings');
    expect(await screen.findByRole('heading', { name: 'Effect style' })).toBeInTheDocument();
    unmount();
    renderRoute('/settings', { studentId: null });
    await screen.findByRole('heading', { name: 'Appearance' });
    expect(screen.queryByRole('heading', { name: 'Effect style' })).not.toBeInTheDocument();
  });
});
