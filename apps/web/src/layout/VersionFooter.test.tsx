import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VersionFooter } from './VersionFooter';

describe('VersionFooter', () => {
  it('shows the app version and links to the About page', () => {
    render(
      <MemoryRouter>
        <VersionFooter version="00.01.002" environment="Live" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'RevisionDen version 00.01.002' });
    expect(link).toHaveAttribute('href', '/about');
  });

  it('names the environment outside the live app', () => {
    render(
      <MemoryRouter>
        <VersionFooter version="00.01.002" environment="Staging" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'RevisionDen version 00.01.002 (Staging',
    );
  });

  it('shows the short commit next to the environment outside the live app', () => {
    render(
      <MemoryRouter>
        <VersionFooter version="00.01.002" environment="Development" commit="ef86a9a" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'RevisionDen version 00.01.002 (Development, ef86a9a)',
    );
  });

  it('never shows the commit in the live app', () => {
    render(
      <MemoryRouter>
        <VersionFooter version="00.01.002" environment="Live" commit="ef86a9a" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('contentinfo')).not.toHaveTextContent('ef86a9a');
  });

  it('leaves out an unknown commit', () => {
    render(
      <MemoryRouter>
        <VersionFooter version="00.01.002" environment="Staging" commit="unknown" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'RevisionDen version 00.01.002 (Staging)',
    );
    expect(screen.getByRole('contentinfo')).not.toHaveTextContent('unknown');
  });

  it('uses the version of this build by default', () => {
    render(
      <MemoryRouter>
        <VersionFooter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/version \d{2}\.\d{2}\.\d{3}/);
  });

  it('never shows a text separator, so a wrapped line can neither end nor start with a stray dot', () => {
    render(
      <MemoryRouter>
        <VersionFooter version="00.01.002" environment="Development" commit="ef86a9a" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('contentinfo').textContent).not.toContain('·');
  });

  it('lays the footer out as separate pieces: the version, then the environment (no Get help link: that lives on Settings)', () => {
    render(
      <MemoryRouter>
        <VersionFooter version="00.01.002" environment="Development" commit="ef86a9a" />
      </MemoryRouter>,
    );
    const pieces = Array.from(
      screen.getByRole('contentinfo').querySelectorAll(':scope > .version-footer-item'),
    );
    expect(pieces.map((piece) => piece.textContent)).toEqual([
      'RevisionDen version 00.01.002',
      '(Development, ef86a9a)',
    ]);
    expect(screen.queryByRole('link', { name: 'Get help' })).toBeNull();
  });
});
