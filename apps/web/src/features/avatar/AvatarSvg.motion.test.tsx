import { act, render } from '@testing-library/react';
import {
  AVATAR_CATALOGUE,
  AVATAR_LAYERS,
  DEFAULT_AVATAR,
  encodeAvatar,
  type AvatarChoices,
  type AvatarLayer,
} from '@revisionden/core';
import { AvatarSvg } from './AvatarSvg';
import { STARTER_LOOKS } from './starters';

/**
 * E9: the avatar moves as a puppet. Whole layer groups (figure, head, eyes, mouth) are moved by
 * CSS transforms, so whatever the child wears rides along with the part it sits on.
 */
const at = (layer: AvatarLayer, id: string) =>
  AVATAR_CATALOGUE[layer].findIndex((item) => item.id === id);

/** Starter looks, every headwear, eyewear, hair style, skin and held item, plus a few mixes. */
function looks(): AvatarChoices[] {
  const out: AvatarChoices[] = STARTER_LOOKS.map((s) => s.choices);
  for (const layer of [
    'headwear',
    'eyewear',
    'hairStyle',
    'skin',
    'heldItem',
    'facialHair',
    'eyes',
    'mouth',
    'top',
  ] as const) {
    AVATAR_CATALOGUE[layer].forEach((_, i) => out.push({ ...DEFAULT_AVATAR, [layer]: i }));
  }
  const hats = AVATAR_CATALOGUE.headwear.length;
  const hairs = AVATAR_CATALOGUE.hairStyle.length;
  const glasses = AVATAR_CATALOGUE.eyewear.length;
  for (let i = 0; i < 12; i += 1) {
    out.push({
      ...STARTER_LOOKS[i % 3]!.choices,
      headwear: (i * 5) % hats,
      hairStyle: (i * 7) % hairs,
      eyewear: (i * 3) % glasses,
      skin: at('skin', i % 2 ? 'alien' : 'robot'),
      facialHair: i % AVATAR_CATALOGUE.facialHair.length,
    });
  }
  return out;
}

const HEAD_LAYERS: AvatarLayer[] = [
  'skin',
  'facialHair',
  'mouth',
  'eyes',
  'hairStyle',
  'eyewear',
  'headwear',
];
const BODY_LAYERS: AvatarLayer[] = ['top', 'topColour', 'heldItem'];
const STILL_LAYERS: AvatarLayer[] = ['backgroundColour', 'pattern', 'scene'];

/** The nesting of moving parts and layers, e.g. `head[eyes[eyes]]`; drawings are left out. */
function outline(el: Element): string {
  const name =
    el.getAttribute('data-motion-part') ??
    el.getAttribute('data-layer') ??
    el.getAttribute('data-part');
  const inner = [...el.children]
    .map((child) =>
      child.matches('[data-motion-part], [data-layer], [data-part]') ? outline(child) : '',
    )
    .filter(Boolean)
    .join(' ');
  return inner ? `${name}[${inner}]` : `${name}`;
}

const part = (svg: Element, name: string) => svg.querySelector(`[data-motion-part="${name}"]`)!;
const layerOf = (svg: Element, layer: AvatarLayer) => svg.querySelector(`[data-layer="${layer}"]`)!;

describe('AvatarSvg motion: every look moves as one piece', () => {
  it('draws every layer once, inside the part that moves it, for every look', () => {
    const all = looks();
    expect(all.length).toBeGreaterThan(60);
    for (const choices of all) {
      const { container, unmount } = render(
        <AvatarSvg code={encodeAvatar(choices)} motion="idle" />,
      );
      const svg = container.querySelector('svg')!;
      const where = JSON.stringify(choices);
      for (const layer of AVATAR_LAYERS) {
        expect(svg.querySelectorAll(`[data-layer="${layer}"]`), `${layer} ${where}`).toHaveLength(
          1,
        );
      }
      const figure = part(svg, 'figure');
      const head = part(svg, 'head');
      expect(figure.contains(head)).toBe(true);
      for (const layer of HEAD_LAYERS) {
        expect(head.contains(layerOf(svg, layer)), `${layer} in head ${where}`).toBe(true);
      }
      // Hair that hangs behind the body has its own group, moved in step with the head.
      const back = part(svg, 'head-back');
      expect(
        figure.contains(back) && back.contains(svg.querySelector('[data-part="hair-back"]')),
      ).toBe(true);
      for (const layer of BODY_LAYERS) {
        const el = layerOf(svg, layer);
        expect(figure.contains(el) && !head.contains(el), `${layer} on body ${where}`).toBe(true);
      }
      for (const layer of STILL_LAYERS) {
        expect(figure.contains(layerOf(svg, layer)), `${layer} stays still`).toBe(false);
      }
      expect(part(svg, 'eyes').contains(layerOf(svg, 'eyes'))).toBe(true);
      expect(part(svg, 'mouth').contains(layerOf(svg, 'mouth'))).toBe(true);
      // CSS transforms would be overwritten by an SVG transform attribute on the same group.
      for (const moving of svg.querySelectorAll('[data-motion-part]')) {
        expect(moving.hasAttribute('transform')).toBe(false);
      }
      unmount();
    }
  });

  it('is still by default, so small copies (options, lists) never move', () => {
    const { container } = render(<AvatarSvg code={encodeAvatar(DEFAULT_AVATAR)} />);
    expect(container.querySelector('svg')).toHaveAttribute('data-motion', 'still');
  });

  it('says which motion is playing and whether the idle loop is paused', () => {
    const code = encodeAvatar(DEFAULT_AVATAR);
    const { container, rerender } = render(<AvatarSvg code={code} motion="idle" />);
    const svg = () => container.querySelector('svg')!;
    expect(svg()).toHaveAttribute('data-motion', 'idle');
    expect(svg()).not.toHaveAttribute('data-paused');
    rerender(<AvatarSvg code={code} motion="idle" paused />);
    expect(svg()).toHaveAttribute('data-paused', 'true');
    rerender(<AvatarSvg code={code} motion="hop" paused />);
    expect(svg()).toHaveAttribute('data-motion', 'hop');
  });

  it('restarts the same reaction when its key changes', () => {
    const code = encodeAvatar(DEFAULT_AVATAR);
    const { container, rerender } = render(<AvatarSvg code={code} motion="nod" motionKey={1} />);
    const first = part(container, 'figure');
    rerender(<AvatarSvg code={code} motion="nod" motionKey={2} />);
    expect(part(container, 'figure')).not.toBe(first);
  });

  it('pauses while the tab is hidden', () => {
    const { container } = render(<AvatarSvg code={encodeAvatar(DEFAULT_AVATAR)} motion="idle" />);
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(container.querySelector('svg')).toHaveAttribute('data-hidden', 'true');
    hidden.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(container.querySelector('svg')).not.toHaveAttribute('data-hidden');
    hidden.mockRestore();
  });

  it('keeps the same outline of moving parts and layers for every starter look', () => {
    const OUTLINE =
      'figure[head-back[hair-back] topColour[top] neck head[hairColour[skin facialHair ' +
      'mouth[mouth] eyes[eyes] hairStyle] eyewear headwear] heldItem]';
    for (const starter of STARTER_LOOKS) {
      const { container, unmount } = render(
        <AvatarSvg code={encodeAvatar(starter.choices)} motion="idle" />,
      );
      expect(outline(part(container, 'figure')), starter.id).toBe(OUTLINE);
      unmount();
    }
  });
});
