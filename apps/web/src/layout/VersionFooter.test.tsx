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
      'RevisionDen version 00.01.002 (Staging)',
    );
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
