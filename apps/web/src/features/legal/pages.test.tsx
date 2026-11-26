import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createPolicyLibrary } from './library';
import { PolicyLibraryProvider } from './PolicyLibraryContext';
import { LegalIndexPage, PolicyPage } from './pages';

const files = {
  'docs/legal/privacy-notice.md': `# Privacy notice

Version: 1.0
Effective date: {{EFFECTIVE_DATE}}

## In plain English

- We keep very little.

## Full text

### 1. Who we are

We are {{OPERATOR_NAME}}. See [terms](terms-of-use.md).

## Changes

- 1.0: First version.
`,
  'docs/legal/terms-of-use.md': '# Terms of use\n\nVersion: 1.0\n',
};

function show(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/legal', element: <LegalIndexPage /> },
      { path: '/legal/:name', element: <PolicyPage /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <PolicyLibraryProvider library={createPolicyLibrary(files, {})}>
      <RouterProvider router={router} />
    </PolicyLibraryProvider>,
  );
}

describe('policy page', () => {
  it('shows the plain English first, then the full text under a visible heading, then changes', () => {
    show('/legal/privacy-notice');
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument();
    expect(screen.getByText(/Version 1.0/)).toHaveTextContent('Effective date: date to be added');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['In plain English', 'Read the full text', 'Changes']);
    expect(screen.getByText('We keep very little.')).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: '1. Who we are' })).toBeVisible();
    expect(screen.getByText(/We are contact details to be added/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute(
      'href',
      '/legal/terms-of-use',
    );
  });

  it('says where the full text applies when the two differ', () => {
    show('/legal/privacy-notice');
    expect(
      screen.getByText(/If this summary and the full text differ, the full text applies/),
    ).toBeInTheDocument();
  });

  it('shows a print button', () => {
    show('/legal/privacy-notice');
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    screen.getByRole('button', { name: 'Print' }).click();
    expect(print).toHaveBeenCalled();
  });

  it('shows the not-found page for an unknown policy', () => {
    show('/legal/made-up');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('policies index', () => {
  it('lists every available policy with who it is for', () => {
    show('/legal');
    expect(screen.getByRole('heading', { level: 1, name: 'Policies' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Privacy notice/ })).toHaveAttribute(
      'href',
      '/legal/privacy-notice',
    );
    expect(screen.getByRole('link', { name: /Terms of use/ })).toHaveAttribute(
      'href',
      '/legal/terms-of-use',
    );
    expect(screen.getByText('Parents and carers')).toBeInTheDocument();
  });

  // J15a (owner, 2026-11-26): the policy rows become themed buttons: the policy's name and who it
  // is for, without the helper sentence.
  it('shows each policy as a button tile named by its title and who it is for', () => {
    show('/legal');
    const link = screen.getByRole('link', { name: 'Privacy notice Parents and carers' });
    expect(link).toHaveClass('button-tile');
    expect(link.closest('ul')).toHaveClass('button-tiles');
    expect(document.querySelector('.link-tile')).toBeNull();
    expect(screen.queryByText('What we collect, why, and your rights')).not.toBeInTheDocument();
  });
});
