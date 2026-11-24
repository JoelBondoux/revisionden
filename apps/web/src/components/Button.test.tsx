import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Button, ButtonLink } from './Button';

describe('Button', () => {
  it('renders its label as a real button', () => {
    render(<Button>Check answer</Button>);
    const button = screen.getByRole('button', { name: 'Check answer' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('cannot be clicked when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'success', 'danger', 'gold'] as const)(
    'applies the %s style',
    (variant) => {
      render(<Button variant={variant}>Styled</Button>);
      expect(screen.getByRole('button')).toHaveClass(`btn--${variant}`);
    },
  );

  it('uses the primary style by default', () => {
    render(<Button>Plain</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn', 'btn--primary');
  });
});

describe('ButtonLink', () => {
  it('renders a real link that looks like a button', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/learn" variant="secondary">
          Start learning
        </ButtonLink>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Start learning' });
    expect(link).toHaveAttribute('href', '/learn');
    expect(link).toHaveClass('btn', 'btn--secondary');
  });
});
