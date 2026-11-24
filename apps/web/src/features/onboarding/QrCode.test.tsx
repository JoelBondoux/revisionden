import { render, screen } from '@testing-library/react';
import { QrCode } from './QrCode';

describe('QrCode', () => {
  it('draws the code as one SVG path with a quiet border', () => {
    render(<QrCode value="https://dev.revisionden.test/link?token=abc" label="QR code" />);
    const svg = screen.getByRole('img', { name: 'QR code' });
    const size = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    expect(size).toBeGreaterThanOrEqual(21 + 8);
    expect(svg.querySelectorAll('path')).toHaveLength(1);
  });

  it('gives different codes for different links', () => {
    const { container, rerender } = render(<QrCode value="https://a.test/1" label="a" />);
    const first = container.querySelector('path')!.getAttribute('d');
    rerender(<QrCode value="https://a.test/2" label="a" />);
    expect(container.querySelector('path')!.getAttribute('d')).not.toBe(first);
  });
});
