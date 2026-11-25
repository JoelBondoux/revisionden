import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Owner request (J7): no plain underlined text links anywhere in the app. Navigation uses
 * LinkButton, LinkTile, LinkChip or (inside sentences and policies) TextLink. This scans the
 * source for raw <Link> and <a> elements and fails on any that is not one of the allowed,
 * deliberately styled exceptions below.
 */
const SRC = join(__dirname, '..');

/** A raw link is fine when it carries one of these classes (each already styled as a control). */
const STYLED_CLASSES = [
  'btn', // ButtonLink-style buttons, e.g. the family data download
  'skip-link', // keyboard "Skip to content"
  'icon-button', // round icon buttons (close lesson)
  'profile', // avatar cards on "Who's revising?"
  'profile__action', // round icon actions on "Who's revising?"
  'hex', // topic map hexagons
  'public-header__brand', // the logo
  'help-action', // big call/text/email actions on Get help
  'help-topic', // topic pills on Get help (styled by .help-topics-nav a)
  'get-help-link', // the Get help pill
  'learn-first__link', // "Learn it first" resource cards
  'main-nav__link', // bottom/side navigation
];

/** Files owned by other workstreams that convert their own links (see docs/GAME_FEEL.md "Links"). */
const OWNED_ELSEWHERE = [
  'features/stats/', // K
  'features/legal/acceptance.tsx', // L
  'pages/WelcomePage.tsx', // I
];

const LINK_COMPONENTS = new Set(['components/links.tsx', 'components/Button.tsx']);

/** Links whose class is built in a variable from one of the styled classes above. */
const STYLED_BY_VARIABLE = ['map/TopicHex.tsx']; // className = 'hex hex--…'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

interface RawLink {
  file: string;
  line: number;
  tag: string;
}

function rawLinks(): RawLink[] {
  const found: RawLink[] = [];
  for (const path of sourceFiles(SRC)) {
    const file = relative(SRC, path);
    if (LINK_COMPONENTS.has(file) || OWNED_ELSEWHERE.some((p) => file.startsWith(p))) continue;
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(/<(Link|NavLink|a)(\s[^>]*)?>/gs)) {
      const attrs = match[2] ?? '';
      const classAttr = /className=(\{[^}]*\}|"[^"]*")/.exec(attrs)?.[1] ?? '';
      const words = classAttr.match(/[\w-]+/g) ?? [];
      if (words.some((c) => STYLED_CLASSES.includes(c))) continue;
      if (STYLED_BY_VARIABLE.includes(file) && /className=\{className\}/.test(attrs)) continue;
      const line = text.slice(0, match.index).split('\n').length;
      found.push({ file, line, tag: match[0].replace(/\s+/g, ' ').slice(0, 80) });
    }
  }
  return found;
}

describe('no plain text links (J7)', () => {
  it('uses the link components for every link in the app', () => {
    expect(rawLinks().map((l) => `${l.file}:${l.line} ${l.tag}`)).toEqual([]);
  });
});
