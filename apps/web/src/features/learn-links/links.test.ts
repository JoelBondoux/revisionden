import {
  checkedLinksFor,
  isShown,
  learnMoreLinks,
  parseLearnLinkFiles,
  PROVIDER_NAMES,
} from './links';

const file = (topic: string, links: object[]) => ({ topic, links });
const link = (extra = {}) => ({
  title: 'Solving linear equations',
  url: 'https://www.thenational.academy/teachers/x',
  provider: 'oak',
  level: 'GCSE',
  checked_at: '2026-11-25',
  match: {
    page_title: 'Solving linear equations | Oak National Academy',
    teaches: 'Solving linear equations at GCSE.',
    level: 'GCSE',
    checked_at: '2026-11-26',
  },
  ...extra,
});

describe('Learn it first links', () => {
  it('only offer links that are both reachable and match-checked', () => {
    expect(isShown(link() as never)).toBe(true);
    expect(isShown(link({ checked_at: null }) as never)).toBe(false);
    expect(isShown(link({ match: undefined }) as never)).toBe(false);
    const byTopic = parseLearnLinkFiles([
      file('a', [link(), link({ url: 'https://www.thenational.academy/m', match: undefined })]),
    ]);
    expect(checkedLinksFor(byTopic, 'a').map((l) => l.url)).toEqual([
      'https://www.thenational.academy/teachers/x',
    ]);
  });

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
    expect(PROVIDER_NAMES).toEqual({
      oak: 'Oak National Academy',
      bitesize: 'BBC Bitesize',
      isaac: 'Isaac',
    });
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
    expect(learnLinksByTopic.get('gcse-maths-h-a17')?.length).toBeGreaterThan(0);
  });

  it('Learn it first keeps to the whole-topic links', () => {
    const byTopic = parseLearnLinkFiles([
      file('t', [
        link({ url: 'https://www.thenational.academy/topic' }),
        link({ url: 'https://www.thenational.academy/point', learning_points: ['t-lp-one'] }),
      ]),
    ]);
    expect(checkedLinksFor(byTopic, 't').map((l) => l.url)).toEqual([
      'https://www.thenational.academy/topic',
    ]);
  });

  it('Learn more gives the most specific links: the item, then its learning point, then the topic', () => {
    const byTopic = parseLearnLinkFiles([
      file('t', [
        link({ url: 'https://www.thenational.academy/topic' }),
        link({ url: 'https://www.thenational.academy/point', learning_points: ['t-lp-one'] }),
        link({ url: 'https://www.thenational.academy/item', items: ['t-0001'] }),
        link({
          url: 'https://www.thenational.academy/hidden',
          items: ['t-0002'],
          match: undefined,
        }),
      ]),
    ]);
    const urls = (where: Parameters<typeof learnMoreLinks>[1]) =>
      learnMoreLinks(byTopic, where).map((l) => l.url.split('/').pop());
    expect(urls({ topicId: 't', learningPoint: 't-lp-one', itemId: 't-0001' })).toEqual(['item']);
    expect(urls({ topicId: 't', learningPoint: 't-lp-one', itemId: 't-0009' })).toEqual(['point']);
    expect(urls({ topicId: 't', learningPoint: 't-lp-two' })).toEqual(['topic']);
    // An item whose only own link is not match-checked falls back too.
    expect(urls({ topicId: 't', itemId: 't-0002' })).toEqual(['topic']);
    expect(urls({ topicId: 'other' })).toEqual([]);
  });
});
