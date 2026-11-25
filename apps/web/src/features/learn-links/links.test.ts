import { checkedLinksFor, parseLearnLinkFiles, PROVIDER_NAMES } from './links';

const file = (topic: string, links: object[]) => ({ topic, links });
const link = (extra = {}) => ({
  title: 'Solving linear equations',
  url: 'https://www.thenational.academy/teachers/x',
  provider: 'oak',
  level: 'GCSE',
  checked_at: '2026-11-25',
  ...extra,
});

describe('Learn it first links', () => {
  it('only offer links that have been checked', () => {
    const byTopic = parseLearnLinkFiles([
      file('a', [link(), link({ url: 'https://www.thenational.academy/y', checked_at: null })]),
      file('b', [link({ checked_at: null })]),
    ]);
    expect(checkedLinksFor(byTopic, 'a').map((l) => l.url)).toEqual([
      'https://www.thenational.academy/teachers/x',
    ]);
    expect(checkedLinksFor(byTopic, 'b')).toEqual([]);
    expect(checkedLinksFor(byTopic, 'unknown')).toEqual([]);
  });

  it('name the providers in plain English', () => {
    expect(PROVIDER_NAMES).toEqual({ oak: 'Oak National Academy', bitesize: 'BBC Bitesize' });
  });

  it('skip files that are not in the expected shape', () => {
    const byTopic = parseLearnLinkFiles([
      { nope: true },
      file('a', [{ url: 1 }]),
      file('c', [link()]),
    ]);
    expect(checkedLinksFor(byTopic, 'a')).toEqual([]);
    expect(checkedLinksFor(byTopic, 'c')).toHaveLength(1);
  });

  it('come from the real content files, every one on an allowed host', async () => {
    const { learnLinksByTopic } = await import('./links');
    for (const links of learnLinksByTopic.values()) {
      for (const l of links) {
        expect(['www.thenational.academy', 'www.bbc.co.uk']).toContain(new URL(l.url).host);
      }
    }
    expect(learnLinksByTopic.has('gcse-maths-h-a17')).toBe(true);
  });
});
