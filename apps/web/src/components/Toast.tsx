import { useEffect } from 'react';
import { CloseIcon } from './icons';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
  tone?: 'neutral' | 'success' | 'warning';
}

export function Toast({ message, onDismiss, durationMs = 4000, tone = 'neutral' }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div className={`toast toast--${tone}`} role="status" aria-live="polite">
      <span className="toast__message">{message}</span>
      <button type="button" className="icon-button" aria-label="Dismiss" onClick={onDismiss}>
        <CloseIcon />
      </button>
    </div>
  );
}
