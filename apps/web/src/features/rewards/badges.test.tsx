import { render, screen } from '@testing-library/react';
import { REWARDS } from '@revisionden/core';
import { BADGE_ART, RewardBadge } from './badges';

describe('badge art', () => {
  it('has original code-drawn art for every special reward badge (R5)', () => {
    const special = REWARDS.filter((r) => r.source === 'special').flatMap((r) =>
      r.items.flatMap((i) => (i.kind === 'badge' ? [i.id] : [])),
    );
    expect(special).toContain('founding-tester');
    for (const id of special) expect(BADGE_ART[id]).toBeDefined();
  });

  it('draws a badge as a labelled image, and nothing for a badge without art', () => {
    const { container } = render(
      <>
        <RewardBadge id="founding-tester" label="Founding Tester badge" />
        <RewardBadge id="no-such-badge" label="Missing" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Founding Tester badge' })).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });
});
