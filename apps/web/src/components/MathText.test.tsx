import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(container.querySelector('[aria-hidden="true"]')!.textContent).toBe('x ^ 2 and x^2');
    expect(container.querySelector('sup')).toBeNull();
  });
});

describe('tapping a power switches x² and x^2 everywhere (F9b, owner)', () => {
  beforeEach(() => window.localStorage.clear());

  it('switches every power on screen to ^ and back again', async () => {
    const { container } = render(
      <>
        <p>
          <MathText text="x^2 + 1" />
        </p>
        <p>
          <MathText text="10^-3" />
        </p>
      </>,
    );
    const shown = () =>
      [...container.querySelectorAll('[aria-hidden="true"]')].map((e) => e.innerHTML);
    expect(container.querySelectorAll('sup')).toHaveLength(2);
    await userEvent.click(container.querySelector('[aria-hidden="true"]')!);
    expect(container.querySelectorAll('sup')).toHaveLength(0);
    expect(shown()).toEqual(['x^2 + 1', '10^-3']);
    await userEvent.click(container.querySelectorAll('[aria-hidden="true"]')[1]!);
    expect(container.querySelectorAll('sup')).toHaveLength(2);
  });

  it('remembers the choice on this device', async () => {
    const first = render(<MathText text="x^2" />);
    await userEvent.click(first.container.querySelector('[aria-hidden="true"]')!);
    first.unmount();
    const again = render(<MathText text="x^2" />);
    expect(again.container.querySelector('sup')).toBeNull();
    expect(again.container.textContent).toContain('x^2');
  });

  it('in computing, starts with ^ and a tap raises it', async () => {
    const { container } = render(<MathText text="a^b" subject="a-level-computer-science" />);
    expect(container.querySelector('sup')).toBeNull();
    await userEvent.click(container.querySelector('[aria-hidden="true"]')!);
    expect(container.querySelector('sup')!.textContent).toBe('b');
  });

  it('a tap on a power in an answer choice does not choose that answer', async () => {
    const { container } = render(
      <label>
        <input type="radio" name="q" />
        <MathText text="x^2" />
      </label>,
    );
    await userEvent.click(container.querySelector('[aria-hidden="true"]')!);
    expect(container.querySelector('input')).not.toBeChecked();
  });

  it('screen readers hear the same words either way', async () => {
    render(<p data-testid="p">{<MathText text="x^2" />}</p>);
    expect(screen.getByTestId('p')).toHaveTextContent(/x squared/);
    await userEvent.click(screen.getByTestId('p').querySelector('[aria-hidden="true"]')!);
    expect(screen.getByTestId('p')).toHaveTextContent(/x squared/);
  });
});
