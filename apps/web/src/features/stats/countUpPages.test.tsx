import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MyStatsPage } from './MyStatsPage';
import { ParentDashboardPage } from './ParentDashboardPage';
import { DEMO_CHILDREN } from './mocks';
import { fakeMotionEnv } from './motionTestEnv';

const emit = vi.fn(() => ({ sound: true, haptic: true }));
vi.mock('../sound', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sound')>();
  return { ...actual, useSound: () => ({ ...actual.useSound(), emit }) };
});

beforeEach(() => emit.mockClear());
const LOAD = { timeout: 5000 };

function renderAt(path: string, page: ReactNode, wrap: (p: { children: ReactNode }) => ReactNode) {
  const Wrap = wrap;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Wrap>{page}</Wrap>
    </MemoryRouter>,
  );
}

describe('count-up on the stats pages (K5)', () => {
  it('My stats: tiles count up, screen readers get the final value, one soft settle sound', async () => {
    const { step, show, wrap } = fakeMotionEnv();
    renderAt('/progress', <MyStatsPage />, wrap);
    const xp = await screen.findByRole('group', { name: 'XP' }, LOAD);
    expect(within(xp).getByText('95', { selector: '.visually-hidden' })).toBeInTheDocument();
    show();
    step(0);
    step(400);
    expect(emit).not.toHaveBeenCalled();
    step(700);
    step(16);
    expect(within(xp).getByText('95')).toBeInTheDocument();
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('ringFill');
    step(2000);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('My stats with reduced motion: final values at once and no sound', async () => {
    const { step, show, wrap } = fakeMotionEnv({ reduced: true });
    renderAt('/progress', <MyStatsPage />, wrap);
    const xp = await screen.findByRole('group', { name: 'XP' }, LOAD);
    expect(within(xp).getByText('95')).toBeInTheDocument();
    show();
    step(2000);
    expect(emit).not.toHaveBeenCalled();
  });

  it('the parent dashboard counts up silently', async () => {
    const { step, show, wrap } = fakeMotionEnv();
    renderAt(`/parent/stats?child=${DEMO_CHILDREN[0]!.id}`, <ParentDashboardPage />, wrap);
    const tile = await screen.findByRole('group', { name: 'Active study time' }, LOAD);
    show();
    step(0);
    step(2000);
    step(16);
    expect(tile.querySelector('.count-up__digits')).toBeNull();
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('K5b: count-up follow-ups (Codex on #235)', () => {
  it('switching to Term or Year does not replay the counts, the bars or the settle sound', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const { step, show, wrap } = fakeMotionEnv();
    renderAt('/progress', <MyStatsPage />, wrap);
    await screen.findByRole('group', { name: 'XP' }, LOAD);
    show();
    step(0);
    step(1100);
    step(16);
    expect(emit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Term' }));
    await screen.findByRole('table', { name: 'XP per week' }, LOAD);
    const xp = screen.getByRole('group', { name: 'XP' });
    // Shown at once: no moving digits, the chart not waiting to grow.
    expect(xp.querySelector('.count-up__digits')).toBeNull();
    expect(document.querySelector('.bar-chart--waiting, .bar-chart--growing')).toBeNull();
    expect(document.querySelector('.stats-grow--waiting, .stats-grow--running')).toBeNull();
    show();
    step(0);
    step(1100);
    step(16);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
