import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  AVATAR_CATALOGUE,
  DEFAULT_AVATAR,
  decodeAvatar,
  encodeAvatar,
  type AvatarLayer,
} from '@revisionden/core';
import { AvatarBuilder } from './AvatarBuilder';

const index = (layer: AvatarLayer, id: string) =>
  AVATAR_CATALOGUE[layer].findIndex((item) => item.id === id);

function Harness({ earned = [], random }: { earned?: string[]; random?: () => number }) {
  const [code, setCode] = useState(encodeAvatar(DEFAULT_AVATAR));
  return (
    <>
      <AvatarBuilder
        code={code}
        nickname="Comet"
        earnedRewardIds={earned}
        onChange={setCode}
        random={random}
      />
      <output data-testid="code">{code}</output>
    </>
  );
}

const currentCode = () => screen.getByTestId('code').textContent!;

describe('AvatarBuilder', () => {
  it('shows the seven tabs, starting on Face', () => {
    render(<Harness />);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Face', 'Hair', 'Top', 'Eyewear', 'Headwear', 'Holding', 'Background']);
    expect(screen.getByRole('tab', { name: 'Face' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Face' })).toBeInTheDocument();
  });

  it('changes the avatar code when an item is picked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Holding' }));
    await user.click(screen.getByRole('button', { name: 'Guitar' }));
    expect(decodeAvatar(currentCode()).heldItem).toBe(index('heldItem', 'guitar'));
    expect(screen.getByRole('button', { name: 'Guitar' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the unlock target on locked items and does not let them be picked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Headwear' }));
    const crown = screen.getByRole('button', { name: /Crown/ });
    expect(crown).toHaveAccessibleName('Crown, locked. Unlock: 100-day streak');
    expect(crown).toHaveAttribute('aria-disabled', 'true');
    expect(within(crown).getByText('100-day streak')).toBeInTheDocument();
    await user.click(crown);
    expect(decodeAvatar(currentCode()).headwear).toBe(0);
  });

  it('lets an earned item be picked', async () => {
    const user = userEvent.setup();
    render(<Harness earned={['streak-100']} />);
    await user.click(screen.getByRole('tab', { name: 'Headwear' }));
    await user.click(screen.getByRole('button', { name: 'Crown' }));
    expect(decodeAvatar(currentCode()).headwear).toBe(index('headwear', 'crown'));
  });

  it('shuffles using only unlocked items', async () => {
    const user = userEvent.setup();
    // 0.999 picks the last item of every layer, which would be a locked one if allowed.
    render(<Harness random={() => 0.999} />);
    await user.click(screen.getByRole('button', { name: 'Shuffle' }));
    const choices = decodeAvatar(currentCode());
    expect(AVATAR_CATALOGUE.scene[choices.scene]!.id).toBe('vinyl');
    expect(AVATAR_CATALOGUE.skin[choices.skin]!.id).toBe('skin-8');
  });

  it('groups background scenes, colours and patterns', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Background' }));
    const panel = screen.getByRole('tabpanel', { name: 'Background' });
    expect(within(panel).getByRole('group', { name: 'Scene' })).toBeInTheDocument();
    expect(within(panel).getByRole('group', { name: 'Colour' })).toBeInTheDocument();
    expect(within(panel).getByRole('group', { name: 'Pattern' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Skate park' }));
    expect(decodeAvatar(currentCode()).scene).toBe(index('scene', 'skate-park'));
  });

  it('shows a live preview of the avatar', () => {
    render(<Harness />);
    expect(screen.getByRole('img', { name: "Comet's avatar" })).toBeInTheDocument();
  });
});
