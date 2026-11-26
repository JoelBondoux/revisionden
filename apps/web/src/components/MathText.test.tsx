import { render, screen } from '@testing-library/react';
import { MathText } from './MathText';

describe('MathText (F9)', () => {
  it('shows powers as superscripts with no visible caret', () => {
    const { container } = render(<p>{<MathText text="Solve x^2 + 11x + 24 = 0" />}</p>);
    const shown = container.querySelector('[aria-hidden="true"]')!;
    expect(shown.textContent).toBe('Solve x2 + 11x + 24 = 0');
    expect(shown.querySelector('sup')!.textContent).toBe('2');
    expect(container.textContent).not.toContain('^');
  });

  it('nests powers and drops a raised bracket', () => {
    const { container } = render(<MathText text="3.2 × 10^(8+2) and a^b^c" />);
    const sups = container.querySelectorAll('sup');
    expect(sups[0]!.textContent).toBe('8+2');
    expect(sups[1]!.textContent).toBe('bc');
    expect(sups[2]!.textContent).toBe('c');
  });

  it('tells screen readers the power in words', () => {
    render(<p data-testid="p">{<MathText text="x^2 and 10^-3" />}</p>);
    expect(screen.getByTestId('p')).toHaveTextContent(/x squared and 10 to the power minus 3/);
  });

  it('leaves text without a power exactly as it is', () => {
    const { container } = render(<p>{<MathText text="What is a tangent?" />}</p>);
    expect(container.innerHTML).toBe('<p>What is a tangent?</p>');
  });

  it('keeps the caret in computing subjects', () => {
    const { container } = render(
      <MathText text="x ^ 2 and x^2" subject="a-level-computer-science" />,
    );
    expect(container.textContent).toBe('x ^ 2 and x^2');
    expect(container.querySelector('sup')).toBeNull();
  });
});
