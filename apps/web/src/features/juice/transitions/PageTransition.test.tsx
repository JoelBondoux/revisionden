import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { ButtonTile, ButtonTiles } from '../../../components/links';
import { PageTransition } from './PageTransition';

function Inner() {
  const navigate = useNavigate();
  return (
    <>
      <h1>Inner page</h1>
      <button onClick={() => navigate(-1)}>Back</button>
    </>
  );
}

function Hub() {
  return (
    <>
      <h1>Hub</h1>
      <ButtonTiles>
        <ButtonTile to="/inner" icon={<span />} label="Inner" />
        <ButtonTile to="/help" icon={<span />} label="Get help" tone="help" />
      </ButtonTiles>
      <Link to="/inner">Plain link</Link>
    </>
  );
}

function renderApp(reducedMotion = false) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          element={
            <main id="main">
              <PageTransition reducedMotion={() => reducedMotion} />
              <Outlet />
            </main>
          }
        >
          <Route path="/" element={<Hub />} />
          <Route path="/inner" element={<Inner />} />
          <Route path="/help" element={<h1>Get help</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return document.getElementById('main')!;
}

// J15a: opening a page from a button tile plays the effect style's page transition on the main
// area (each style's stylesheet draws it), and Back plays it in reverse. Never on Get help, never
// with reduced motion, and it never blocks taps (a CSS animation on the page, nothing on top).
describe('the page transition', () => {
  it('plays when a button tile opens a page', async () => {
    const main = renderApp();
    await userEvent.click(screen.getByRole('link', { name: 'Inner' }));
    expect(screen.getByRole('heading', { name: 'Inner page' })).toBeInTheDocument();
    expect(main).toHaveClass('page-enter');
    expect(main).not.toHaveClass('page-enter--back');
  });

  it('plays in reverse on Back', async () => {
    const main = renderApp();
    await userEvent.click(screen.getByRole('link', { name: 'Inner' }));
    fireEvent.animationEnd(main);
    expect(main).not.toHaveClass('page-enter');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Hub' })).toBeInTheDocument();
    expect(main).toHaveClass('page-enter', 'page-enter--back');
  });

  it('clears itself when the animation ends, or soon after if it never runs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const main = renderApp();
      await userEvent.click(screen.getByRole('link', { name: 'Inner' }));
      expect(main).toHaveClass('page-enter');
      act(() => void vi.advanceTimersByTime(600));
      expect(main).not.toHaveClass('page-enter');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not play for an ordinary link', async () => {
    const main = renderApp();
    await userEvent.click(screen.getByRole('link', { name: 'Plain link' }));
    expect(screen.getByRole('heading', { name: 'Inner page' })).toBeInTheDocument();
    expect(main).not.toHaveClass('page-enter');
  });

  it('never plays for Get help, which opens calmly and at once', async () => {
    const main = renderApp();
    await userEvent.click(screen.getByRole('link', { name: 'Get help' }));
    expect(screen.getByRole('heading', { name: 'Get help' })).toBeInTheDocument();
    expect(main).not.toHaveClass('page-enter');
  });

  it('swaps pages instantly when reduced motion is asked for', async () => {
    const main = renderApp(true);
    await userEvent.click(screen.getByRole('link', { name: 'Inner' }));
    expect(main).not.toHaveClass('page-enter');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(main).not.toHaveClass('page-enter');
  });
});
