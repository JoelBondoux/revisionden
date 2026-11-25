import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createPolicyLibrary } from './library';
import { PolicyLibraryProvider } from './PolicyLibraryContext';
import {
  afterLinkPath,
  NOTICE_KEY,
  YoungPeopleNoticePage,
  type NoticeStorage,
} from './youngPeopleNotice';

const library = createPolicyLibrary(
  {
    'a/privacy-for-young-people.md':
      '# Your privacy\n\nVersion: 1.0\n\n## In plain English\n\n- We never ask for your real name.\n\n## Full text\n\nLong.\n',
  },
  {},
);

const memory = (
  initial: Record<string, string> = {},
): NoticeStorage & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('afterLinkPath', () => {
  it("goes to the young people's notice the first time a device is linked", () => {
    expect(afterLinkPath('1.0', memory())).toBe('/welcome/privacy');
  });

  it('goes straight to learning once this version has been seen', () => {
    expect(afterLinkPath('1.0', memory({ [NOTICE_KEY]: '1.0' }))).toBe('/learn');
  });

  it('shows the notice again after it changes', () => {
    expect(afterLinkPath('1.1', memory({ [NOTICE_KEY]: '1.0' }))).toBe('/welcome/privacy');
  });

  it('goes straight to learning when there is no notice in this build', () => {
    expect(afterLinkPath(null, memory())).toBe('/learn');
  });

  it('still shows the notice when storage is blocked', () => {
    const blocked: NoticeStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(afterLinkPath('1.0', blocked)).toBe('/welcome/privacy');
  });
});

describe("young people's notice page", () => {
  it('shows the plain-English notice and remembers it was seen', async () => {
    const storage = memory();
    const router = createMemoryRouter(
      [
        { path: '/welcome/privacy', element: <YoungPeopleNoticePage storage={storage} /> },
        { path: '/learn', element: <h1>Learn</h1> },
      ],
      { initialEntries: ['/welcome/privacy'] },
    );
    render(
      <PolicyLibraryProvider library={library}>
        <RouterProvider router={router} />
      </PolicyLibraryProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Your privacy' })).toBeInTheDocument();
    expect(screen.getByText('We never ask for your real name.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open this notice on its own page' })).toHaveAttribute(
      'href',
      '/legal/privacy-for-young-people',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(storage.data.get(NOTICE_KEY)).toBe('1.0');
    expect(await screen.findByRole('heading', { name: 'Learn' })).toBeInTheDocument();
  });

  it('moves on when the notice is missing from this build', () => {
    const router = createMemoryRouter(
      [
        { path: '/welcome/privacy', element: <YoungPeopleNoticePage storage={memory()} /> },
        { path: '/learn', element: <h1>Learn</h1> },
      ],
      { initialEntries: ['/welcome/privacy'] },
    );
    render(
      <PolicyLibraryProvider library={createPolicyLibrary({}, {})}>
        <RouterProvider router={router} />
      </PolicyLibraryProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Learn' })).toBeInTheDocument();
  });
});
