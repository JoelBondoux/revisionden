import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(
      <Sheet open={false} title="Hint" onClose={() => {}}>
        Try factorising.
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a labelled dialog when open and moves focus into it', () => {
    render(
      <Sheet open title="Hint" onClose={() => {}}>
        Try factorising.
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Hint' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('Try factorising.');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes with the close button', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Hint" onClose={onClose}>
        Body
      </Sheet>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with the Escape key', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Hint" onClose={onClose}>
        Body
      </Sheet>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
