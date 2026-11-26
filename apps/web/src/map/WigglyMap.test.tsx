import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { TopicMap } from '@revisionden/core';
import { resetDiscoveries, type Bridges } from './bridges';
import { WigglyMap } from './WigglyMap';

const topic = (id: string, title: string, extra: object = {}) => ({
  id,
  title,
  lessonId: id,
  status: 'in-progress' as const,
  mastery: 20,
  ...extra,
});

function mapWith(
  topics: TopicMap['units'][number]['topics'],
  qualification = 'GCSE Foundation',
): TopicMap {
  return {
    subjectId: 'gcse-maths',
    subject: 'Maths',
    qualification,
    streakDays: 0,
    xpToday: 0,
    dailyGoalXp: 50,
    nextMission: null,
    units: [
      {
        id: 'number',
        title: 'Number',
        masteryPercent: 20,
        topics,
        challenge: { lessonId: 'number-challenge', unlockAtPercent: 80, unlocked: false },
      },
    ],
  };
}

const show = (map: TopicMap, bridges?: Bridges) =>
  render(
    <MemoryRouter>
      <WigglyMap map={map} onLocked={() => {}} bridges={bridges} />
    </MemoryRouter>,
  );

beforeEach(() => resetDiscoveries());

// J15c (owner sign-off of the all-themes mockup, revision 5, 2026-11-26).
describe('the winding path', () => {
  it("puts a Foundation student's Higher-only topics on an optional side branch", () => {
    show(
      mapWith([
        topic('a', 'Fractions'),
        topic('h', 'Surds', { tier: 'higher' }),
        topic('b', 'Bounds'),
      ]),
    );
    const surds = screen.getByRole('link', { name: 'Surds, optional Higher topic, 20% mastered' });
    expect(surds).toHaveClass('path-node--higher');
    expect(screen.getByText('Higher · optional')).toBeInTheDocument();
  });

  it('keeps Higher topics on the main route for a Higher student', () => {
    show(
      mapWith([topic('a', 'Fractions'), topic('h', 'Surds', { tier: 'higher' })], 'GCSE Higher'),
    );
    expect(screen.getByRole('link', { name: 'Surds, 20% mastered' })).not.toHaveClass(
      'path-node--higher',
    );
  });

  it('shows two topics that can be done in either order side by side', () => {
    show(
      mapWith([
        topic('a', 'Expanding'),
        topic('f', 'Factorising', { orderGroup: 'g1' }),
        topic('e', 'Equations', { orderGroup: 'g1' }),
        topic('b', 'Inequalities'),
      ]),
    );
    expect(screen.getAllByText('either order')).toHaveLength(2);
  });

  it('changes nothing when there is no branch or bridge data', () => {
    show(mapWith([topic('a', 'Fractions'), topic('b', 'Bounds')]));
    expect(screen.queryByText(/optional|either order|From /)).not.toBeInTheDocument();
  });
});

describe('bridges to other subjects (discovered, never shown up front)', () => {
  const bridges: Bridges = {
    a: [
      {
        subject: 'Physics',
        subjectId: 'gcse-physics',
        topic: 'Speed, distance and time',
        why: 'speed = distance ÷ time, rearranged three ways',
      },
      {
        subject: 'Physics',
        subjectId: 'gcse-physics',
        topic: 'Acceleration',
        why: 'another formula to rearrange',
      },
    ],
  };

  it('hides a bridge until its topic has been opened', async () => {
    show(mapWith([topic('a', 'Rearranging formulae'), topic('b', 'Bounds')]), bridges);
    expect(screen.queryByText('Speed, distance and time')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Rearranging formulae/ }));
  });

  it('shows the first link once the topic has been opened, then the next when that is tapped', async () => {
    const first = show(
      mapWith([topic('a', 'Rearranging formulae'), topic('b', 'Bounds')]),
      bridges,
    );
    await userEvent.click(screen.getByRole('link', { name: /Rearranging formulae/ }));
    first.unmount();
    show(mapWith([topic('a', 'Rearranging formulae'), topic('b', 'Bounds')]), bridges);
    const bridge = await screen.findByRole('button', {
      name: 'Speed, distance and time, optional Physics topic',
    });
    expect(screen.getByText('From Physics · optional')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'You might find this Physics topic useful: Speed, distance and time',
    );
    expect(screen.queryByText('Acceleration')).not.toBeInTheDocument();
    await userEvent.click(bridge);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Practise this in Physics: speed = distance ÷ time, rearranged three ways.',
    );
    expect(
      await screen.findByRole('button', { name: 'Acceleration, optional Physics topic' }),
    ).toBeInTheDocument();
  });

  it('only celebrates a discovery once', async () => {
    const one = show(mapWith([topic('a', 'Rearranging formulae')]), bridges);
    await userEvent.click(screen.getByRole('link', { name: /Rearranging formulae/ }));
    one.unmount();
    const two = show(mapWith([topic('a', 'Rearranging formulae')]), bridges);
    expect(await screen.findByRole('status')).toBeInTheDocument();
    two.unmount();
    show(mapWith([topic('a', 'Rearranging formulae')]), bridges);
    expect(screen.getByRole('button', { name: /Speed, distance and time/ })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('the breathing path', () => {
  it('holds still in automated tests and with reduced motion', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    show(mapWith([topic('a', 'Fractions'), topic('b', 'Bounds')]));
    act(() => void 0);
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
    const page = screen.getByRole('region', { name: 'Number' });
    expect(
      within(page).getByRole('link', { name: 'Fractions, 20% mastered' }).style.translate,
    ).toBe('');
  });
});
