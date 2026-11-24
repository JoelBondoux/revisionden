import { act, render, screen } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

describe('OfflineBanner', () => {
  afterEach(() => setOnline(true));

  it('shows when navigator.onLine is false', () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/you're offline/i);
  });

  it('stays hidden when online', () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
  });

  it('appears and disappears as the connection drops and returns', () => {
    setOnline(true);
    render(<OfflineBanner />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
  });
});
