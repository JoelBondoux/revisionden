import { render } from '@testing-library/react';
import { AVATAR_CATALOGUE, AVATAR_LAYERS, DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { AvatarSvg } from './AvatarSvg';
import { hasArt } from './parts';

const index = (layer: keyof typeof AVATAR_CATALOGUE, id: string) =>
  AVATAR_CATALOGUE[layer].findIndex((item) => item.id === id);

describe('AvatarSvg', () => {
  it('has original art for every item in the catalogue', () => {
    const missing = AVATAR_LAYERS.flatMap((layer) =>
      AVATAR_CATALOGUE[layer]
        .filter((item) => !hasArt(layer, item.id))
        .map((i) => `${layer}:${i.id}`),
    );
    expect(missing).toEqual([]);
  });

  it('draws each chosen item as its own layer', () => {
    const code = encodeAvatar({
      ...DEFAULT_AVATAR,
      heldItem: index('heldItem', 'guitar'),
      headwear: index('headwear', 'fox-ears'),
      scene: index('scene', 'skate-park'),
    });
    const { container } = render(<AvatarSvg code={code} label="Comet's avatar" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', "Comet's avatar");
    expect(svg.querySelector('[data-layer="heldItem"]')).toHaveAttribute('data-item', 'guitar');
    expect(svg.querySelector('[data-layer="headwear"]')).toHaveAttribute('data-item', 'fox-ears');
    expect(svg.querySelector('[data-layer="scene"]')).toHaveAttribute('data-item', 'skate-park');
  });

  it('falls back to the default avatar when the code is not valid', () => {
    const { container } = render(<AvatarSvg code="broken" label="avatar" />);
    expect(container.querySelector('[data-layer="skin"]')).toHaveAttribute('data-item', 'skin-1');
  });

  it('never uses photos or images', () => {
    for (const layer of AVATAR_LAYERS) {
      AVATAR_CATALOGUE[layer].forEach((_, i) => {
        const { container, unmount } = render(
          <AvatarSvg code={encodeAvatar({ ...DEFAULT_AVATAR, [layer]: i })} label="a" />,
        );
        expect(container.querySelector('image, img, foreignObject')).toBeNull();
        unmount();
      });
    }
  });
});
