import { render } from '@testing-library/react';
import { REWARDS } from '@revisionden/core';
import { AvatarEffect, EFFECTS } from './effects';

describe('avatar effects', () => {
  it('has original art for every effect a reward gives', () => {
    const ids = REWARDS.flatMap((r) => r.items.flatMap((i) => (i.kind === 'effect' ? [i.id] : [])));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(EFFECTS[id]).toBeDefined();
  });

  it('draws an effect as shapes only, and nothing for an unknown effect', () => {
    const { container, rerender } = render(<AvatarEffect id="glitch" />);
    expect(container.querySelector('[data-effect="glitch"]')).not.toBeNull();
    expect(container.querySelector('image, img')).toBeNull();
    rerender(<AvatarEffect id="nope" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
