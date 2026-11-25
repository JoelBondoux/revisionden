import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Outlet, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RouteChange } from './RouteChange';

/** Pretend the window is scrolled to `y` (jsdom never scrolls on its own). */
function scrolledTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
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
  scrolledTo(0);
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
});
