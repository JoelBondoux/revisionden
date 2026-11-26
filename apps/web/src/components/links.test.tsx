import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MapIcon } from './icons';
import { ButtonTile, ButtonTiles, LinkButton, LinkChip, LinkTile, TextLink } from './links';

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
    expect(link).toHaveClass('btn', 'btn--primary', 'btn-link');
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
    expect(link.querySelector('.btn-link__icon')).toHaveAttribute('aria-hidden', 'true');
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
    const link = screen.getByRole('link', { name: 'Stats dashboard' });
    expect(link).toHaveAttribute('href', '/stats');
    expect(link).toHaveAccessibleDescription('XP, accuracy and streaks by week');
    // The visible link text is exactly its name (WCAG 2.5.3); the whole card is still the target.
    expect(link).toHaveTextContent(/^Stats dashboard$/);
    const tile = link.closest('.link-tile')!;
    expect(tile.querySelector('.link-tile__chevron')).toHaveAttribute('aria-hidden', 'true');
    expect(tile.querySelector('.link-tile__icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('works without a description or icon', () => {
    inRouter(<LinkTile to="/stats" title="Stats" />);
    const link = screen.getByRole('link', { name: 'Stats' });
    expect(link).not.toHaveAttribute('aria-describedby');
    expect(link.closest('.link-tile')).not.toBeNull();
  });

  it('tells screen readers when a tile opens a new tab', () => {
    render(<LinkTile href="https://example.com/guide" newTab title="Guide" />);
    const link = screen.getByRole('link', { name: 'Guide (opens in a new tab)' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('can link outside the app', () => {
    render(<LinkTile href="mailto:help@example.com" title="Get help" description="Email us" />);
    expect(screen.getByRole('link', { name: 'Get help' })).toHaveAttribute(
      'href',
      'mailto:help@example.com',
    );
  });
});

// J15a (owner, 2026-11-26): "change the horizontal blocks to buttons that are in theme". Chunky
// tappable buttons in a grid, with an icon and a short label; each opens its page with the effect
// style's page transition.
describe('ButtonTile', () => {
  function StateProbe() {
    const location = useLocation();
    return <p data-testid="state">{JSON.stringify(location.state)}</p>;
  }
  const tilesThen = (ui: React.ReactNode) =>
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="*" element={<StateProbe />} />
        </Routes>
      </MemoryRouter>,
    );

  it('is a real link in a list, named by its short label, with the icon hidden', () => {
    tilesThen(
      <ButtonTiles label="Family">
        <ButtonTile to="/stats" icon={<MapIcon />} label="Stats" />
        <ButtonTile to="/kids" icon={<MapIcon />} label="Children" />
      </ButtonTiles>,
    );
    const list = screen.getByRole('list', { name: 'Family' });
    expect(list).toHaveClass('button-tiles');
    const link = screen.getByRole('link', { name: 'Stats' });
    expect(link).toHaveAttribute('href', '/stats');
    expect(link).toHaveClass('button-tile');
    expect(link.closest('li')!.parentElement).toBe(list);
    expect(link.querySelector('.button-tile__icon')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('can show a short badge as part of its name', () => {
    tilesThen(
      <ButtonTiles>
        <ButtonTile to="/legal/terms" icon={<MapIcon />} label="Terms" badge="Everyone" />
      </ButtonTiles>,
    );
    expect(screen.getByRole('link', { name: 'Terms Everyone' })).toBeInTheDocument();
  });

  it('opens its page with the page transition, keeping any state it was given', async () => {
    tilesThen(
      <ButtonTiles>
        <ButtonTile
          to="/feedback"
          state={{ from: '/settings' }}
          icon={<MapIcon />}
          label="Feedback"
        />
      </ButtonTiles>,
    );
    await userEvent.click(screen.getByRole('link', { name: 'Feedback' }));
    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({
      from: '/settings',
      via: 'tile',
    });
  });

  it('keeps Get help calm: no transition, and its own look', async () => {
    tilesThen(
      <ButtonTiles>
        <ButtonTile to="/help" icon={<MapIcon />} label="Get help" tone="help" />
      </ButtonTiles>,
    );
    const link = screen.getByRole('link', { name: 'Get help' });
    expect(link).toHaveClass('button-tile--help');
    await userEvent.click(link);
    expect(screen.getByTestId('state')).toHaveTextContent('null');
  });

  it('never adds the transition to a Get help page, whatever its tone', async () => {
    tilesThen(
      <ButtonTiles>
        <ButtonTile to="/parent/help" icon={<MapIcon />} label="Help" />
      </ButtonTiles>,
    );
    await userEvent.click(screen.getByRole('link', { name: 'Help' }));
    expect(screen.getByTestId('state')).toHaveTextContent('null');
  });

  it('can open an outside address in a new tab, safely and saying so', () => {
    render(
      <ButtonTiles>
        <ButtonTile href="https://example.com/guide" newTab icon={<MapIcon />} label="Guide" />
      </ButtonTiles>,
    );
    const link = screen.getByRole('link', { name: 'Guide (opens in a new tab)' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
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

  it('keeps tiles and chips readable inside the dark arena (beats the arena link colour)', () => {
    expect(rule('.arena .link-tile a.link-tile__link')).toMatch(/color: var\(--color-text\)/);
    expect(rule('.arena a.link-chip.link-chip')).toMatch(/color: var\(--color-primary-edge\)/);
  });

  it('stretches a tile link over the whole card so any part of it is tappable', () => {
    expect(rule('.link-tile__link::after')).toMatch(/position: absolute/);
    expect(rule('.link-tile__link::after')).toMatch(/inset: 0/);
  });

  it('gives every link a target of at least 44px', () => {
    for (const selector of ['.link-tile', '.link-chip', '.btn--quiet', '.button-tile']) {
      expect(rule(selector), selector).toMatch(
        /min-height: (var\(--tap-target\)|4[4-9]px|[5-9]\dpx|[3-9](\.\d+)?rem)/,
      );
    }
  });

  it('shows a clear focus ring on every link style', () => {
    for (const selector of [
      '.link-tile:focus-within',
      '.link-chip:focus-visible',
      '.text-link:focus-visible',
      '.button-tile:focus-visible',
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

describe('button tile styles', () => {
  const css = readFileSync(join(__dirname, 'links.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('lays tiles out two to a row on phones and more on wider screens, never sideways', () => {
    expect(css).toMatch(
      /\.button-tiles\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: [^)]+\)\s*\{\s*\.button-tiles\s*\{[^}]*repeat\((3|4|auto-fill)/,
    );
  });

  it('squishes when pressed, and holds still with reduced motion', () => {
    expect(css).toMatch(/\.button-tile:active\s*\{[^}]*transform:/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^@]*\.button-tile/);
  });

  it('wraps a long label instead of overflowing a 320px screen with text at 200%', () => {
    expect(css).toMatch(/\.button-tile\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/\.button-tile\s*\{[^}]*min-width:\s*0/);
  });
});

describe('class names', () => {
  it('do not clash with classes other screens already use', () => {
    const ours = [
      'btn-link',
      'btn-link__icon',
      'link-tile',
      'link-chip',
      'text-link',
      'link-tiles',
    ];
    const css: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith('.css') && !path.endsWith(join('components', 'links.css')))
          css.push(readFileSync(path, 'utf8'));
      }
    };
    walk(join(__dirname, '..'));
    for (const cls of ours) {
      const defined = css.some((text) => new RegExp(`\\.${cls}(?![\\w-])`).test(text));
      expect(defined, cls).toBe(false);
    }
  });
});
