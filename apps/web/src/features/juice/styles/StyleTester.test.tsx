import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppearanceProvider } from '../../appearance/AppearanceProvider';
import { StudentProvider } from '../../../session/StudentContext';
import { EffectStyleCard } from './EffectStyleCard';
import { EffectStyleProvider } from './EffectStyleProvider';

const childOnDevice = {
  getItem: (k: string) => (k === 'revisionden.studentId' ? 'student-1' : null),
  setItem: () => undefined,
};

const ALL = ['sticker-book', 'pop-burst', 'garden-grow', 'starlight', 'comic-pop', 'pixel-arcade'];

/** The settings card, with the API answering as the dev environment (testerStyles) or not. */
function renderCard(access: { unlocked: string[]; testerStyles?: string[] }) {
  return render(
    <AppearanceProvider matchMedia={null}>
      <StudentProvider storage={childOnDevice}>
        <EffectStyleProvider loadUnlocked={async () => access}>
          <EffectStyleCard />
        </EffectStyleProvider>
      </StudentProvider>
    </AppearanceProvider>,
  );
}

const root = document.documentElement;

// J12c: on the dev environment only, a tester can try any style and theme. The API decides
// (testerStyles is only sent in development), so a stray build cannot show it.
describe('the dev style tester', () => {
  beforeEach(() => {
    localStorage.clear();
    delete root.dataset.effectStyle;
    delete root.dataset.theme;
    delete root.dataset.palette;
  });

  it('is not shown unless the API says this is the dev environment', async () => {
    renderCard({ unlocked: ['pop-burst'] });
    await screen.findByRole('radio', { name: /^Pop Burst/, checked: false });
    expect(screen.queryByRole('group', { name: /Tester/ })).not.toBeInTheDocument();
  });

  it('says plainly that it is for testing and unlocks nothing', async () => {
    renderCard({ unlocked: [], testerStyles: ALL });
    const tester = await screen.findByRole('group', { name: 'Tester: try any style' });
    expect(tester).toHaveTextContent("Dev only: doesn't unlock anything for real.");
  });

  it('applies any style at once, even a locked one, without unlocking it', async () => {
    renderCard({ unlocked: [], testerStyles: ALL });
    const tester = await screen.findByRole('group', { name: 'Tester: try any style' });
    await userEvent.click(within(tester).getByRole('button', { name: 'Pixel Arcade' }));
    expect(root.dataset.effectStyle).toBe('pixel-arcade');
    expect(within(tester).getByRole('button', { name: 'Pixel Arcade' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The real picker still shows it locked.
    expect(screen.getByRole('radio', { name: /^Pixel Arcade/ })).toBeDisabled();
  });

  it('switches light, dark and colour-blind themes at once', async () => {
    renderCard({ unlocked: [], testerStyles: ALL });
    const tester = await screen.findByRole('group', { name: 'Tester: try any style' });
    await userEvent.click(within(tester).getByRole('button', { name: 'Dark' }));
    expect(root.dataset.theme).toBe('dark');
    await userEvent.click(within(tester).getByRole('button', { name: 'Colour-blind' }));
    expect(root.dataset.palette).toBe('colourblind');
    await userEvent.click(within(tester).getByRole('button', { name: 'Light' }));
    expect(root.dataset.theme).toBe('light');
    await userEvent.click(within(tester).getByRole('button', { name: 'Standard colours' }));
    expect(root.dataset.palette).toBe('standard');
  });

  it('stays chosen across reloads, separately from the real choice, until reset', async () => {
    const { unmount } = renderCard({ unlocked: [], testerStyles: ALL });
    let tester = await screen.findByRole('group', { name: 'Tester: try any style' });
    await userEvent.click(within(tester).getByRole('button', { name: 'Starlight' }));
    expect(localStorage.getItem('revisionden.effectStyleTester')).toBe('starlight');
    expect(localStorage.getItem('revisionden.effectStyle')).toBeNull();
    unmount();
    renderCard({ unlocked: [], testerStyles: ALL });
    tester = await screen.findByRole('group', { name: 'Tester: try any style' });
    expect(await screen.findByRole('button', { name: 'Starlight', pressed: true })).toBeVisible();
    expect(root.dataset.effectStyle).toBe('starlight');
    await userEvent.click(
      within(tester).getByRole('button', { name: 'Reset to my unlocked style' }),
    );
    expect(root.dataset.effectStyle).toBe('doodle-diary');
    expect(localStorage.getItem('revisionden.effectStyleTester')).toBeNull();
  });

  it('is ignored if the API stops saying this is the dev environment', async () => {
    localStorage.setItem('revisionden.effectStyleTester', 'pixel-arcade');
    renderCard({ unlocked: [] });
    await screen.findByRole('radio', { name: /^Doodle Diary/, checked: true });
    expect(root.dataset.effectStyle).toBe('doodle-diary');
  });
});
