import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  AVATAR_CATALOGUE,
  DEFAULT_AVATAR,
  decodeAvatar,
  encodeAvatar,
  type AvatarLayer,
} from '@revisionden/core';
import { stubReducedMotion } from '../juice/testing';
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
    // Browsers put a space before the hidden ", locked" (it is positioned, so a block); it
    // reads the same aloud.
    expect(crown).toHaveAccessibleName(/^Crown ?, locked\. Unlock: 100-day streak$/);
    // The name comes from the visible text plus hidden words, so what is seen is what is said
    // (WCAG 2.5.3): no aria-label that hides the visible text.
    expect(crown).not.toHaveAttribute('aria-label');
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

  describe('tabs (J9)', () => {
    it('moves between tabs with the arrow keys, Home and End, wrapping round', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(screen.getByRole('tab', { name: 'Face' }));
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Hair' })).toHaveFocus();
      expect(screen.getByRole('tab', { name: 'Hair' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { name: 'Hair' })).toBeInTheDocument();
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(screen.getByRole('tab', { name: 'Background' })).toHaveFocus();
      await user.keyboard('{Home}');
      expect(screen.getByRole('tab', { name: 'Face' })).toHaveFocus();
      await user.keyboard('{End}');
      expect(screen.getByRole('tab', { name: 'Background' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('keeps only the selected tab in the Tab order', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(screen.getByRole('tab', { name: 'Top' }));
      for (const tab of screen.getAllByRole('tab')) {
        expect(tab).toHaveAttribute('tabindex', tab.textContent === 'Top' ? '0' : '-1');
      }
    });
  });

  describe('layout (J9)', () => {
    it('keeps the preview and tabs together in a stage, apart from the scrolling options', () => {
      const { container } = render(<Harness />);
      const stage = container.querySelector('.avatar-builder__stage')!;
      expect(stage).toContainElement(screen.getByRole('img', { name: "Comet's avatar" }));
      expect(stage).toContainElement(screen.getByRole('tablist'));
      expect(stage).not.toContainElement(screen.getByRole('tabpanel'));
    });

    it('makes the preview compact once the options have scrolled up, and full size again at the top', () => {
      let callback: IntersectionObserverCallback = () => undefined;
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(cb: IntersectionObserverCallback) {
            callback = cb;
          }
          observe() {}
          disconnect() {}
          unobserve() {}
          takeRecords() {
            return [];
          }
        },
      );
      const { container } = render(<Harness />);
      const stage = container.querySelector('.avatar-builder__stage')!;
      expect(stage).not.toHaveAttribute('data-compact');
      const fire = (isIntersecting: boolean, top: number) =>
        act(() =>
          callback(
            [{ isIntersecting, boundingClientRect: { top } } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          ),
        );
      fire(false, -20);
      expect(stage).toHaveAttribute('data-compact', 'true');
      fire(true, 40);
      expect(stage).not.toHaveAttribute('data-compact');
      vi.unstubAllGlobals();
    });
    it('watches the scrolling box it sits in (such as a sheet) and compares with its top edge', () => {
      let callback: IntersectionObserverCallback = () => undefined;
      let root: Element | Document | null | undefined;
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
            callback = cb;
            root = options?.root;
          }
          observe() {}
          disconnect() {}
          unobserve() {}
          takeRecords() {
            return [];
          }
        },
      );
      const { container } = render(
        <div data-testid="scroller" style={{ overflowY: 'auto' }}>
          <Harness />
        </div>,
      );
      expect(root).toBe(screen.getByTestId('scroller'));
      // The sheet starts 128px down the screen: a marker at 23px has gone under its top edge.
      act(() =>
        callback(
          [
            {
              isIntersecting: false,
              boundingClientRect: { top: 23 },
              rootBounds: { top: 128 },
            } as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver,
        ),
      );
      expect(container.querySelector('.avatar-builder__stage')).toHaveAttribute(
        'data-compact',
        'true',
      );
      vi.unstubAllGlobals();
    });
  });

  describe('live preview juice (J9)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('gives the preview a gentle pop each time something changes', async () => {
      stubReducedMotion(false);
      const user = userEvent.setup();
      const { container } = render(<Harness />);
      const pop = () => container.querySelector('.avatar-builder__pop');
      expect(pop()).toBeNull();
      await user.click(screen.getByRole('tab', { name: 'Holding' }));
      await user.click(screen.getByRole('button', { name: 'Guitar' }));
      const first = pop();
      expect(first).not.toBeNull();
      await user.click(screen.getByRole('button', { name: 'Shuffle' }));
      expect(pop()).not.toBeNull();
      expect(pop()).not.toBe(first);
    });

    it('changes the preview without the pop when reduced motion is on', async () => {
      stubReducedMotion(true);
      const user = userEvent.setup();
      const { container } = render(<Harness />);
      await user.click(screen.getByRole('tab', { name: 'Holding' }));
      await user.click(screen.getByRole('button', { name: 'Guitar' }));
      expect(container.querySelector('.avatar-builder__pop')).toBeNull();
      expect(decodeAvatar(currentCode()).heldItem).toBe(index('heldItem', 'guitar'));
    });
  });
});
