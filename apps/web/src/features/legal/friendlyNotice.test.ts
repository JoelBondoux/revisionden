import { parsePolicy } from './policy';
import { parseFriendlyNotice } from './friendlyNotice';

const md = `# Notice

Version: 1.1
Effective date: x

## In plain English

This is for you.

### The short version

- <!-- icon: mask --> We don't know your real name.
- <!-- icon: robot --> AI never knows it's you.

## Full text

### What we keep

<!-- icon: folder -->

**In short:**

- Your nickname.
- Your scores.

Longer paragraph one.

Longer paragraph two.

### No key points here

Just text.

## Changes

- 1.1: Easier to read.
`;

describe('parseFriendlyNotice', () => {
  const notice = parseFriendlyNotice(parsePolicy(md));

  it('reads the intro and the short version cards with their icons', () => {
    expect(notice.intro).toBe('This is for you.');
    expect(notice.shortVersion).toEqual([
      { icon: 'mask', text: "We don't know your real name." },
      { icon: 'robot', text: "AI never knows it's you." },
    ]);
  });

  it('splits each section into its icon, key points and the rest of the text', () => {
    expect(notice.sections[0]).toEqual({
      id: 'what-we-keep',
      title: 'What we keep',
      icon: 'folder',
      keyPoints: ['Your nickname.', 'Your scores.'],
      details: 'Longer paragraph one.\n\nLonger paragraph two.',
    });
  });

  it('keeps a section without key points as text only, with a default icon', () => {
    expect(notice.sections[1]).toMatchObject({
      icon: 'info',
      keyPoints: [],
      details: 'Just text.',
    });
  });
});
