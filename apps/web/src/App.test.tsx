import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('shows the app name', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'RevisionDen' })).toBeInTheDocument();
  });

  it('offers password-free sign-in only', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});
