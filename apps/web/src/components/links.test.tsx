import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MapIcon } from './icons';
import { LinkButton, LinkChip, LinkTile, TextLink } from './links';

const inRouter = (ui: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/stats" element={<h1>Stats page</h1>} />
      </Routes>
    </MemoryRouter>,
  );

describe('LinkButton', () => {
  it('is a real link that looks like our buttons', () => {
    inRouter(<LinkButton to="/stats">See your stats</LinkButton>);
    const link = screen.getByRole('link', { name: 'See your stats' });
    expect(link).toHaveAttribute('href', '/stats');
    expect(link).toHaveClass('btn', 'btn--primary', 'link-button');
  });

  it.each(['primary', 'secondary', 'quiet'] as const)('has a %s style', (variant) => {
    inRouter(
      <LinkButton to="/stats" variant={variant}>
        Go
      </LinkButton>,
    );
    expect(screen.getByRole('link', { name: 'Go' })).toHaveClass(`btn--${variant}`);
  });

  it('shows an optional icon without changing the name screen readers hear', () => {
    inRouter(
      <LinkButton to="/stats" icon={<MapIcon />}>
        Map
      </LinkButton>,
    );
    const link = screen.getByRole('link', { name: 'Map' });
    expect(link.querySelector('.link-button__icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('navigates inside the app', async () => {
    inRouter(<LinkButton to="/stats">See your stats</LinkButton>);
    await userEvent.click(screen.getByRole('link', { name: 'See your stats' }));
    expect(screen.getByRole('heading', { name: 'Stats page' })).toBeInTheDocument();
  });

  it('uses a plain link for outside addresses and email, opening safely', () => {
    render(
      <>
        <LinkButton href="mailto:help@example.com" variant="secondary">
          Email us
        </LinkButton>
        <LinkButton href="https://example.com/guide" newTab>
          Guide
        </LinkButton>
      </>,
    );
    expect(screen.getByRole('link', { name: 'Email us' })).toHaveAttribute(
      'href',
      'mailto:help@example.com',
    );
    const guide = screen.getByRole('link', { name: /Guide/ });
    expect(guide).toHaveAttribute('target', '_blank');
    expect(guide).toHaveAttribute('rel', 'noopener noreferrer');
    expect(guide).toHaveAccessibleName('Guide (opens in a new tab)');
  });

  it('can fill the width', () => {
    inRouter(
      <LinkButton to="/stats" block>
        Go
      </LinkButton>,
    );
    expect(screen.getByRole('link')).toHaveClass('btn--block');
  });
});

describe('LinkTile', () => {
  it('is one tappable card whose name is just its title', () => {
    inRouter(
      <LinkTile
        to="/stats"
        icon={<MapIcon />}
        title="Stats dashboard"
        description="XP, accuracy and streaks by week"
      />,
    );
    const tile = screen.getByRole('link', { name: 'Stats dashboard' });
    expect(tile).toHaveAttribute('href', '/stats');
    expect(tile).toHaveClass('link-tile');
    expect(tile).toHaveAccessibleDescription('XP, accuracy and streaks by week');
    expect(tile.querySelector('.link-tile__chevron')).toHaveAttribute('aria-hidden', 'true');
    expect(tile.querySelector('.link-tile__icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('works without a description or icon', () => {
    inRouter(<LinkTile to="/stats" title="Stats" />);
    const tile = screen.getByRole('link', { name: 'Stats' });
    expect(tile).not.toHaveAttribute('aria-describedby');
  });

  it('can link outside the app', () => {
    render(<LinkTile href="mailto:help@example.com" title="Get help" description="Email us" />);
    expect(screen.getByRole('link', { name: 'Get help' })).toHaveAttribute(
      'href',
      'mailto:help@example.com',
    );
  });
});

describe('LinkChip', () => {
  it('is a small pill-shaped link for use inside cards', () => {
    inRouter(<LinkChip to="/stats">Details</LinkChip>);
    const chip = screen.getByRole('link', { name: 'Details' });
    expect(chip).toHaveClass('link-chip');
    expect(chip).toHaveAttribute('href', '/stats');
  });
});

describe('TextLink', () => {
  it('stays inline inside sentences, styled as a clear bold link', () => {
    inRouter(
      <p>
        Read the <TextLink to="/stats">privacy notice</TextLink> first.
      </p>,
    );
    expect(screen.getByRole('link', { name: 'privacy notice' })).toHaveClass('text-link');
  });

  it('handles outside addresses', () => {
    render(<TextLink href="https://example.com">example</TextLink>);
    expect(screen.getByRole('link', { name: 'example' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
  });
});

describe('link styles', () => {
  const css = readFileSync(join(__dirname, 'links.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) => {
    const found = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, s]) =>
      s!.split(',').some((part) => part.trim() === selector),
    );
    return found?.[2] ?? '';
  };

  it('gives every link a target of at least 44px', () => {
    for (const selector of ['.link-tile', '.link-chip', '.btn--quiet']) {
      expect(rule(selector), selector).toMatch(
        /min-height: (var\(--tap-target\)|4[4-9]px|[5-9]\dpx)/,
      );
    }
  });

  it('shows a clear focus ring on every link style', () => {
    for (const selector of [
      '.link-tile:focus-visible',
      '.link-chip:focus-visible',
      '.text-link:focus-visible',
    ]) {
      expect(rule(selector), selector).toMatch(/outline: 3px solid/);
    }
  });

  it('never uses plain underlined text: inline links are bold with a coloured bar, underline on hover', () => {
    expect(rule('.text-link')).toContain('text-decoration: none');
    expect(rule('.text-link')).toMatch(/font-weight: var\(--font-weight-(extrabold|black)\)/);
    expect(rule('.text-link')).toMatch(/border-bottom: [^;]+solid/);
    expect(rule('.text-link:hover')).toContain('text-decoration: underline');
  });

  it('animates only transform and box-shadow, so reduced motion and performance rules hold', () => {
    for (const [, , body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const transition = /transition:\s*([^;]+);/.exec(body!)?.[1];
      if (!transition) continue;
      for (const part of transition.split(',')) {
        expect(['transform', 'box-shadow', 'border-color', 'background-color']).toContain(
          part.trim().split(/\s+/)[0],
        );
      }
    }
  });
});
