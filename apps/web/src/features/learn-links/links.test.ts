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
    // A reachable whole-topic link with no match record is a legacy Q5 link: still shown.
    expect(isShown(link({ match: undefined }) as never)).toBe(true);
    expect(isShown(link({ match: undefined, learning_points: ['p'] }) as never)).toBe(false);
    const byTopic = parseLearnLinkFiles([
      file('a', [
        link(),
        link({ url: 'https://www.thenational.academy/m', match: undefined, items: ['a-1'] }),
      ]),
    ]);
    expect(checkedLinksFor(byTopic, 'a').map((l) => l.url)).toEqual([
      'https://www.thenational.academy/teachers/x',
    ]);
    expect(learnMoreLinks(byTopic, { topicId: 'a', itemId: 'a-1' }).map((l) => l.url)).toEqual([
      'https://www.thenational.academy/teachers/x',
    ]);
  });

  it('keep legacy links (reachable, no match record yet) in Learn it first and the topic fallback', () => {
    const byTopic = parseLearnLinkFiles([file('a', [link({ match: undefined })])]);
    expect(checkedLinksFor(byTopic, 'a')).toHaveLength(1);
    expect(learnMoreLinks(byTopic, { topicId: 'a', learningPoint: 'a-lp' })).toHaveLength(1);
  });

  it('list an in-house note first and let it hide the external links it covers', () => {
    const inHouse = (extra = {}) => ({
      title: 'Our note',
      route: '/notes/t',
      provider: 'revisionden',
      level: 'GCSE',
      checked_at: null,
      ...extra,
    });
    const both = parseLearnLinkFiles([file('t', [link(), inHouse()])]);
    expect(checkedLinksFor(both, 't').map((l) => l.provider)).toEqual(['revisionden', 'oak']);
    const point = parseLearnLinkFiles([
      file('t', [
        link(),
        link({ url: 'https://www.thenational.academy/p', learning_points: ['t-lp'] }),
        inHouse({ learning_points: ['t-lp'], hide_external: true }),
      ]),
    ]);
    expect(
      learnMoreLinks(point, { topicId: 't', learningPoint: 't-lp' }).map((l) => l.provider),
    ).toEqual(['revisionden']);
    // Only the point it covers: the whole topic still has its external link.
    expect(checkedLinksFor(point, 't').map((l) => l.provider)).toEqual(['oak']);
    // A route must be an in-app path; a web link must be https.
    const bad = parseLearnLinkFiles([
      file('x', [inHouse({ route: 'https://evil.example' }), link({ url: 'http://x' })]),
    ]);
    expect(bad.get('x')).toEqual([]);
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
      revisionden: 'RevisionDen notes',
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
        expect(['www.thenational.academy', 'www.bbc.co.uk']).toContain(new URL(l.url!).host);
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
      learnMoreLinks(byTopic, where).map((l) => l.url!.split('/').pop());
    expect(urls({ topicId: 't', learningPoint: 't-lp-one', itemId: 't-0001' })).toEqual(['item']);
    expect(urls({ topicId: 't', learningPoint: 't-lp-one', itemId: 't-0009' })).toEqual(['point']);
    expect(urls({ topicId: 't', learningPoint: 't-lp-two' })).toEqual(['topic']);
    // An item whose only own link is not match-checked falls back too.
    expect(urls({ topicId: 't', itemId: 't-0002' })).toEqual(['topic']);
    expect(urls({ topicId: 'other' })).toEqual([]);
  });
});
