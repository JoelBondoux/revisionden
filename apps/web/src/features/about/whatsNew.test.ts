import { parseWhatsNew } from './whatsNew';

const CHANGELOG = `# Changelog

Intro text.

## [Unreleased]

### What's new

- Coming soon: sound effects.

### Added

- Technical line that families never see.

## [00.02.000] - 2026-12-01

### Added

- Only technical lines here.

## [00.01.002] - 2026-11-24

### What's new

- You can now flip flashcards.
- Reminders can be switched off.

### Fixed

- A technical fix.
`;

describe('parseWhatsNew', () => {
  it('lists the What’s new lines per version, newest first', () => {
    expect(parseWhatsNew(CHANGELOG)).toEqual([
      { version: 'Unreleased', lines: ['Coming soon: sound effects.'] },
      {
        version: '00.01.002',
        date: '2026-11-24',
        lines: ['You can now flip flashcards.', 'Reminders can be switched off.'],
      },
    ]);
  });

  it('hides versions without a What’s new subsection', () => {
    expect(parseWhatsNew(CHANGELOG).map((v) => v.version)).not.toContain('00.02.000');
  });

  it('hides a What’s new subsection with no lines', () => {
    expect(
      parseWhatsNew("## [00.01.000] - 2026-11-01\n\n### What's new\n\n### Added\n\n- x\n"),
    ).toEqual([]);
  });

  it('accepts a curly apostrophe and joins wrapped lines', () => {
    const md = '## [00.01.001] - 2026-11-02\n\n### What’s new\n\n- A long line\n  that wraps.\n';
    expect(parseWhatsNew(md)).toEqual([
      { version: '00.01.001', date: '2026-11-02', lines: ['A long line that wraps.'] },
    ]);
  });
});
