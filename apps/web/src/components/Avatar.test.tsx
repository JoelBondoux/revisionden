import { render, screen } from '@testing-library/react';
import { DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders an image labelled with the nickname', () => {
    render(<Avatar code="a1b2c3" nickname="QuietComet" />);
    expect(screen.getByRole('img', { name: "QuietComet's avatar" })).toBeInTheDocument();
  });

  it('shows the first letter of the nickname as a placeholder', () => {
    render(<Avatar code="a1b2c3" nickname="quietComet" />);
    expect(screen.getByRole('img')).toHaveTextContent('Q');
  });

  it('picks the same colour for the same avatar code every time', () => {
    const { rerender } = render(<Avatar code="same-code" nickname="One" />);
    const first = screen.getByRole('img').style.backgroundColor;
    rerender(<Avatar code="same-code" nickname="Two" />);
    expect(screen.getByRole('img').style.backgroundColor).toBe(first);
    expect(first).not.toBe('');
  });

  it('picks different colours for different codes', () => {
    const colours = new Set(
      ['aa', 'bb', 'cc', 'dd', 'ee', 'ff'].map((code) => {
        const { unmount } = render(<Avatar code={code} nickname="Test" />);
        const colour = screen.getByRole('img').style.backgroundColor;
        unmount();
        return colour;
      }),
    );
    expect(colours.size).toBeGreaterThan(1);
  });

  it('draws the layered avatar when the code is a real avatar code', () => {
    const { container } = render(<Avatar code={encodeAvatar(DEFAULT_AVATAR)} nickname="Nova" />);
    expect(screen.getByRole('img', { name: "Nova's avatar" }).tagName.toLowerCase()).toBe('svg');
    expect(container.querySelector('[data-layer="skin"]')).not.toBeNull();
  });
});
