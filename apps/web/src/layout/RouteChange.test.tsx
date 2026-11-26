import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Outlet, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RouteChange } from './RouteChange';

/** Pretend the window is scrolled to `y` (jsdom never scrolls on its own). */
function windowAt(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
}

/** The reader scrolls to `y`: the window moves and the browser says so. */
function scrolledTo(y: number) {
  windowAt(y);
  window.dispatchEvent(new Event('scroll'));
}

function Page({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <>
      <h1>{title}</h1>
      {children}
    </>
  );
}

function setup(initial = '/one') {
  const router = createMemoryRouter(
    [
      {
        element: <RouteChange />,
        children: [
          {
            element: (
              <main id="main" tabIndex={-1}>
                <Outlet />
              </main>
            ),
            children: [
              {
                path: '/one',
                element: (
                  <Page title="Page one">
                    <Link to="/two">Go to two</Link>
                    <Link to="/one?tab=b">Other tab</Link>
                  </Page>
                ),
              },
              {
                path: '/two',
                element: (
                  <Page title="Page two">
                    <Link to="/two#later">Jump to later</Link>
                    <p id="later">Later on the page</p>
                  </Page>
                ),
              },
              { path: '/empty', element: <p>No heading here</p> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initial] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  windowAt(0);
  // Long enough to scroll anywhere unless a test says otherwise.
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 10_000,
  });
});

describe('changing screen', () => {
  it('starts the new screen at the top', async () => {
    setup();
    scrolledTo(900);
    await userEvent.click(screen.getByRole('link', { name: 'Go to two' }));
    expect(await screen.findByRole('heading', { name: 'Page two' })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
  });

  it("moves focus to the new screen's main heading for screen readers", async () => {
    setup();
    await userEvent.click(screen.getByRole('link', { name: 'Go to two' }));
    const heading = await screen.findByRole('heading', { name: 'Page two' });
    expect(heading).toHaveFocus();
  });

  it('focuses the main area when the new screen has no heading yet', async () => {
    const router = setup();
    await act(() => router.navigate('/empty'));
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('leaves the first screen alone when the app opens', () => {
    setup();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Page one' })).not.toHaveFocus();
  });

  it('puts the reader back where they were on the back button', async () => {
    const router = setup();
    scrolledTo(640);
    await userEvent.click(screen.getByRole('link', { name: 'Go to two' }));
    scrolledTo(0);
    await act(() => router.navigate(-1));
    expect(screen.getByRole('heading', { name: 'Page one' })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenLastCalledWith(0, 640);
  });

  it('keeps in-page links to a part of the page working', async () => {
    setup('/two');
    const later = screen.getByText('Later on the page');
    later.scrollIntoView = vi.fn();
    await userEvent.click(screen.getByRole('link', { name: 'Jump to later' }));
    expect(later.scrollIntoView).toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalledWith(0, 0);
  });

  it('keeps the scroll position when only the query changes on the same screen', async () => {
    setup();
    scrolledTo(300);
    await userEvent.click(screen.getByRole('link', { name: 'Other tab' }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('remembers where the reader was before the old screen was replaced', async () => {
    const router = setup();
    scrolledTo(640);
    // The next screen is short: by the time it shows, the window has been clamped near the top.
    windowAt(40);
    await act(() => router.navigate('/two'));
    await act(() => router.navigate(-1));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 640);
  });

  it('finishes putting the reader back once a loading screen has its content', async () => {
    const router = setup();
    scrolledTo(640);
    await act(() => router.navigate('/two'));
    // Back to a screen still loading: only 100px can be scrolled yet.
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 100 + window.innerHeight,
    });
    await act(() => router.navigate(-1));
    scrollTo.mockClear();
    // The content arrives and the page grows.
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2000 + window.innerHeight,
    });
    await act(async () => {
      document.getElementById('main')!.append(document.createElement('section'));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(scrollTo).toHaveBeenLastCalledWith(0, 640);
  });
});
