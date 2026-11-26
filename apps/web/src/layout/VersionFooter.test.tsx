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
});
