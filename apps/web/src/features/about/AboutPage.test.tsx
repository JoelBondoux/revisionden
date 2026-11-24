import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createPolicyLibrary } from '../legal/library';
import { PolicyLibraryProvider } from '../legal/PolicyLibraryContext';
import { AboutPage } from './AboutPage';
import type { BuildInfo } from './buildInfo';

const info: BuildInfo = {
  version: '00.04.012',
  environment: 'Staging',
  buildDate: '2026-12-01',
  commit: 'abc1234',
  licences: [{ name: 'react', version: '18.3.1', licence: 'MIT' }],
};

const changelog = `## [Unreleased]

### What's new

- Something on the way.

## [00.04.012] - 2026-12-01

### What's new

- You can send us feedback.

## [00.04.011] - 2026-11-30

### Added

- Technical only.
`;

function show() {
  render(
    <PolicyLibraryProvider
      library={createPolicyLibrary(
        { 'x/privacy-notice.md': '# Privacy notice\n\nVersion: 1.0\n' },
        {},
      )}
    >
      <MemoryRouter>
        <AboutPage info={info} changelog={changelog} />
      </MemoryRouter>
    </PolicyLibraryProvider>,
  );
}

describe('About page', () => {
  it('shows the version, environment, build date and commit', () => {
    show();
    expect(
      screen.getByRole('heading', { level: 1, name: 'About RevisionDen' }),
    ).toBeInTheDocument();
    const facts = screen.getByRole('region', { name: 'This version' });
    expect(within(facts).getByText('00.04.012')).toBeInTheDocument();
    expect(within(facts).getByText('Staging')).toBeInTheDocument();
    expect(within(facts).getByText('2026-12-01')).toBeInTheDocument();
    expect(within(facts).getByText('abc1234')).toBeInTheDocument();
  });

  it("lists What's new per version, newest first, hiding versions without it", () => {
    show();
    const news = screen.getByRole('region', { name: "What's new" });
    const headings = within(news)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      'Latest changes (not released yet)',
      'Version 00.04.012 · 2026-12-01',
    ]);
    expect(within(news).getByText('You can send us feedback.')).toBeInTheDocument();
    expect(within(news).queryByText('Technical only.')).not.toBeInTheDocument();
  });

  it('links to every policy, the licences and the feedback form', () => {
    show();
    expect(screen.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute(
      'href',
      '/legal/privacy-notice',
    );
    expect(screen.getByRole('link', { name: 'All policies' })).toHaveAttribute('href', '/legal');
    expect(screen.getByRole('link', { name: 'Report a bug' })).toHaveAttribute(
      'href',
      '/feedback?kind=bug',
    );
    expect(screen.getByRole('link', { name: 'Send an idea' })).toHaveAttribute(
      'href',
      '/feedback?kind=idea',
    );
    const licences = screen.getByRole('region', { name: 'Open-source licences' });
    expect(within(licences).getByText(/react 18.3.1/)).toHaveTextContent('MIT');
  });

  it('says so when there is nothing new to show', () => {
    render(
      <MemoryRouter>
        <AboutPage info={info} changelog="## [00.01.000]\n\n### Added\n\n- x\n" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument();
  });
});
