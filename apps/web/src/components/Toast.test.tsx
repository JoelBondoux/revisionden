import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast } from './Toast';

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces its message via role status', () => {
    render(<Toast message="Saved!" onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved!');
  });

  it('dismisses itself after the given time', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Saved!" onDismiss={onDismiss} durationMs={3000} />);
    act(() => vi.advanceTimersByTime(2999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed with its close button', async () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved!" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
