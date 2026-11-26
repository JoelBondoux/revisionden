import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkLinks,
  isShownLink,
  isWorkingStatus,
  learnLinkErrors,
  linkCoverage,
  listLinks,
  pageTitle,
  probeProviders,
  PROVIDER_HOSTS,
} from './learn-links.mjs';
import { createValidators } from './schemas.mjs';

const subject = { file: 'subjects/maths.json', data: { id: 'gcse-maths', level: 'GCSE' } };
const tree = {
  file: 'topic-trees/t.json',
  data: {
    id: 'tree',
    subject: 'gcse-maths',
    board: 'edexcel',
    topics: [{ id: 'unit', title: 'U', children: [{ id: 'gcse-maths-h-a17', title: 'Linear' }] }],
  },
};
const link = (extra = {}) => ({
  title: 'Solving linear equations',
  url: 'https://www.bbc.co.uk/bitesize/guides/example/revision/1',
  provider: 'bitesize',
  level: 'GCSE',
  checked_at: '2026-11-25',
  match: match(),
  ...extra,
});
const unmatched = (extra = {}) => {
  const l = link(extra);
  delete l.match;
  return l;
};
const item = (id, learning_point) => ({
  file: 'items/a17.json',
  data: { id, topic: 'gcse-maths-h-a17', ...(learning_point ? { learning_point } : {}) },
});
const items = [
  item('gcse-maths-h-a17-0001', 'gcse-maths-h-a17-lp-solve-linear'),
  item('gcse-maths-h-a17-0002', 'gcse-maths-h-a17-lp-solve-linear'),
  item('gcse-maths-h-a17-0003', 'gcse-maths-h-a17-lp-fractions-negatives'),
];
const content = (data, file = 'learn-links/gcse-maths-h-a17.json') => ({
  subjects: [subject],
  topicTrees: [tree],
  items,
  learnLinks: [{ file, data }],
});
function match(extra = {}) {
  return {
    page_title: 'Solving linear equations - GCSE Maths Revision - BBC Bitesize',
    teaches: 'Solving linear equations with unknowns on both sides, at GCSE.',
    level: 'GCSE',
    checked_at: '2026-11-26',
    ...extra,
  };
}

test('the learn links schema accepts a well-formed file', () => {
  const { learnLinks } = createValidators();
  assert.equal(learnLinks({ topic: 'gcse-maths-h-a17', links: [link()] }), true);
  assert.equal(
    learnLinks({ topic: 'gcse-maths-h-a17', links: [link({ checked_at: null })] }),
    true,
  );
  assert.equal(
    learnLinks({ topic: 'gcse-maths-h-a17', links: [link({ board: 'edexcel' })] }),
    true,
  );
});

test('the learn links schema rejects missing fields, other providers and plain http', () => {
  const { learnLinks } = createValidators();
  assert.equal(learnLinks({ topic: 'x', links: [] }), false);
  assert.equal(learnLinks({ topic: 'x', links: [link({ provider: 'youtube' })] }), false);
  assert.equal(
    learnLinks({ topic: 'x', links: [link({ url: 'http://www.bbc.co.uk/bitesize' })] }),
    false,
  );
  assert.equal(learnLinks({ topic: 'x', links: [link({ checked_at: 'yesterday' })] }), false);
  const noTitle = link();
  delete noTitle.title;
  assert.equal(learnLinks({ topic: 'x', links: [noTitle] }), false);
});

test('a good learn links file has no errors', () => {
  assert.deepEqual(
    learnLinkErrors(content({ topic: 'gcse-maths-h-a17', links: [link({ match: match() })] })),
    [],
  );
});

test('links must belong to a real topic, named in the file name', () => {
  const errors = learnLinkErrors(
    content({ topic: 'gcse-maths-h-zz', links: [link()] }, 'learn-links/gcse-maths-h-zz.json'),
  );
  assert.match(errors[0].message, /topic gcse-maths-h-zz does not exist/);
  const named = learnLinkErrors(
    content({ topic: 'gcse-maths-h-a17', links: [link()] }, 'learn-links/other.json'),
  );
  assert.match(named[0].message, /file name must be gcse-maths-h-a17\.json/);
});

test("a link's host must match its provider", () => {
  const errors = learnLinkErrors(
    content({
      topic: 'gcse-maths-h-a17',
      links: [
        link({ provider: 'oak' }),
        link({ url: 'https://www.bbc.co.uk.example.com/bitesize/x' }),
      ],
    }),
  );
  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /oak links must be on www\.thenational\.academy/);
  assert.deepEqual(PROVIDER_HOSTS.oak, [{ host: 'www.thenational.academy', path: '/' }]);
});

test("a link's level and board must match the topic's subject and topic tree", () => {
  const errors = learnLinkErrors(
    content({
      topic: 'gcse-maths-h-a17',
      links: [
        link({ level: 'A-Level', match: match({ level: 'A-Level' }) }),
        link({ url: 'https://www.bbc.co.uk/bitesize/b', board: 'aqa' }),
      ],
    }),
  );
  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /level A-Level does not match the subject \(GCSE\)/);
  assert.match(errors[1].message, /board aqa does not match the topic tree \(edexcel\)/);
});

test('the same URL is not listed twice for a topic', () => {
  const errors = learnLinkErrors(content({ topic: 'gcse-maths-h-a17', links: [link(), link()] }));
  assert.match(errors[0].message, /listed twice/);
});

test('2xx and 3xx count as working; anything else is broken', () => {
  assert.equal(isWorkingStatus(200), true);
  assert.equal(isWorkingStatus(301), true);
  assert.equal(isWorkingStatus(399), true);
  assert.equal(isWorkingStatus(404), false);
  assert.equal(isWorkingStatus(500), false);
  assert.equal(isWorkingStatus(199), false);
});

test('the link check requests every URL and reports broken ones and network errors', async () => {
  const seen = [];
  const fakeFetch = async (url, init) => {
    seen.push([url, init.method, init.redirect]);
    if (url.endsWith('/gone')) return { status: 404 };
    if (url.endsWith('/down')) throw new Error('getaddrinfo ENOTFOUND');
    return { status: url.endsWith('/moved') ? 301 : 200 };
  };
  const results = await checkLinks(
    [
      { file: 'a.json', url: 'https://x/ok' },
      { file: 'a.json', url: 'https://x/moved' },
      { file: 'b.json', url: 'https://x/gone' },
      { file: 'b.json', url: 'https://x/down' },
    ],
    { fetch: fakeFetch },
  );
  assert.deepEqual(
    results.map((r) => [r.url, r.ok, r.status]),
    [
      ['https://x/ok', true, 200],
      ['https://x/moved', true, 301],
      ['https://x/gone', false, 404],
      ['https://x/down', false, 'getaddrinfo ENOTFOUND'],
    ],
  );
  assert.deepEqual(seen[0], ['https://x/ok', 'GET', 'manual']);
});

test('listLinks flattens every file into one list of URLs', () => {
  assert.deepEqual(
    listLinks([
      {
        file: 'f.json',
        data: { topic: 't', links: [unmatched(), unmatched({ url: 'https://u' })] },
      },
    ]),
    [
      { file: 'f.json', topic: 't', url: link().url },
      { file: 'f.json', topic: 't', url: 'https://u' },
    ],
  );
});

test('content validation includes the learn links checks', async () => {
  const { validateContent } = await import('./validate.mjs');
  const { loadContent } = await import('./validate.mjs');
  const { mkdtempSync, mkdirSync, writeFileSync, cpSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const repoContent = join(dirname(fileURLToPath(import.meta.url)), '../../content');
  const root = mkdtempSync(join(tmpdir(), 'learn-links-'));
  cpSync(join(repoContent, 'subjects'), join(root, 'subjects'), { recursive: true });
  cpSync(join(repoContent, 'topic-trees'), join(root, 'topic-trees'), { recursive: true });
  mkdirSync(join(root, 'learn-links'));
  writeFileSync(
    join(root, 'learn-links', 'gcse-maths-h-a17.json'),
    JSON.stringify({ topic: 'gcse-maths-h-a17', links: [link({ provider: 'oak' })] }),
  );
  const loaded = await loadContent(root);
  assert.equal(loaded.learnLinks.length, 1);
  const errors = await validateContent(loaded, { checkMaths: null });
  assert.ok(
    errors.some((e) => /oak links must be on/.test(e.message)),
    JSON.stringify(errors),
  );
});

test('the schema accepts Isaac, links for learning points or items, and a recorded match check', () => {
  const { learnLinks } = createValidators();
  const ok = (l) => learnLinks({ topic: 'gcse-maths-h-a17', links: [l] });
  assert.equal(ok(link({ provider: 'isaac' })), true);
  assert.equal(ok(link({ learning_points: ['gcse-maths-h-a17-lp-solve-linear'] })), true);
  assert.equal(ok(link({ items: ['gcse-maths-h-a17-0001'] })), true);
  assert.equal(ok(link({ match: match() })), true);
  assert.equal(ok(link({ learning_points: [] })), false);
  assert.equal(ok(link({ match: match({ page_title: '' }) })), false);
  assert.equal(ok(link({ match: match({ level: 'KS3' }) })), false);
  assert.equal(ok(link({ match: match({ checked_at: null }) })), false);
  const noTeaches = match();
  delete noTeaches.teaches;
  assert.equal(ok(link({ match: noTeaches })), false);
});

test('a link for a learning point or item must belong to its topic and have items', () => {
  const errors = learnLinkErrors(
    content({
      topic: 'gcse-maths-h-a17',
      links: [
        link({ learning_points: ['gcse-maths-h-a17-lp-solve-linear'] }),
        link({
          url: 'https://www.bbc.co.uk/bitesize/b',
          learning_points: ['gcse-maths-h-a17-lp-made-up'],
        }),
        link({ url: 'https://www.bbc.co.uk/bitesize/c', items: ['gcse-maths-h-a17-0003'] }),
        link({ url: 'https://www.bbc.co.uk/bitesize/d', items: ['gcse-maths-h-n1-0001'] }),
      ],
    }),
  );
  assert.deepEqual(
    errors.map((e) => e.message),
    [
      'learning point gcse-maths-h-a17-lp-made-up has no items in gcse-maths-h-a17: https://www.bbc.co.uk/bitesize/b',
      'item gcse-maths-h-n1-0001 is not in gcse-maths-h-a17: https://www.bbc.co.uk/bitesize/d',
    ],
  );
});

test('Isaac links live on isaacscience.org (isaacphysics.org now redirects there)', () => {
  assert.deepEqual(PROVIDER_HOSTS.isaac, [{ host: 'isaacscience.org', path: '/' }]);
  assert.deepEqual(
    learnLinkErrors(
      content({
        topic: 'gcse-maths-h-a17',
        links: [link({ provider: 'isaac', url: 'https://isaacscience.org/concepts/x' })],
      }),
    ),
    [],
  );
  const errors = learnLinkErrors(
    content({
      topic: 'gcse-maths-h-a17',
      links: [link({ provider: 'isaac', url: 'https://isaacphysics.org/concepts/x' })],
    }),
  );
  assert.match(errors[0].message, /isaac links must be on isaacscience\.org\//);
});

test("the match check's level must be the link's level", () => {
  const errors = learnLinkErrors(
    content({ topic: 'gcse-maths-h-a17', links: [link({ match: match({ level: 'A-Level' }) })] }),
  );
  assert.match(errors[0].message, /match check says A-Level but the link is GCSE/);
});

test('a link is shown only when it is both reachable and match-checked', () => {
  assert.equal(isShownLink(link({ match: match() })), true);
  assert.equal(isShownLink(unmatched()), false);
  assert.equal(isShownLink(link({ checked_at: null, match: match() })), false);
});

test('pageTitle reads the <title>, decoding entities and squashing spaces', () => {
  assert.equal(
    pageTitle('<html><head><TITLE>\n  Ratio &amp; proportion &#8211; GCSE\n</TITLE></head>'),
    'Ratio & proportion – GCSE',
  );
  assert.equal(pageTitle('<html><body>no title</body></html>'), null);
});

test('the link check fails a match-checked page whose title has changed since it was read', async () => {
  const pages = {
    'https://x/same': `<title>${match().page_title}</title>`,
    'https://x/changed': '<title>Something else entirely</title>',
  };
  const fakeFetch = async (url) => ({ status: 200, text: async () => pages[url] ?? '' });
  const results = await checkLinks(
    [
      { file: 'a.json', url: 'https://x/same', match: match() },
      { file: 'a.json', url: 'https://x/changed', match: match() },
      { file: 'a.json', url: 'https://x/unchecked' },
    ],
    { fetch: fakeFetch },
  );
  assert.deepEqual(
    results.map((r) => [r.url, r.ok, r.status]),
    [
      ['https://x/same', true, 200],
      [
        'https://x/changed',
        false,
        'title changed to "Something else entirely": re-check the match',
      ],
      ['https://x/unchecked', true, 200],
    ],
  );
});

test('listLinks keeps the match check so the title can be compared', () => {
  const [one] = listLinks([
    { file: 'f.json', data: { topic: 't', links: [link({ match: match() })] } },
  ]);
  assert.deepEqual(one.match, match());
});

test('the provider probe requests each provider home page and reports what it got', async () => {
  const fakeFetch = async (url) => {
    if (url.includes('bbc')) throw new Error('fetch failed');
    return { status: 200 };
  };
  assert.deepEqual(await probeProviders({ fetch: fakeFetch }), [
    { provider: 'oak', url: 'https://www.thenational.academy/', status: 200 },
    { provider: 'bitesize', url: 'https://www.bbc.co.uk/bitesize/', status: 'fetch failed' },
    { provider: 'isaac', url: 'https://isaacscience.org/', status: 200 },
  ]);
});

test('coverage counts topics and learning points with items that have a shown link', () => {
  const shown = (extra) => link({ match: match(), ...extra });
  const report = linkCoverage({
    ...content({
      topic: 'gcse-maths-h-a17',
      links: [
        shown({ learning_points: ['gcse-maths-h-a17-lp-solve-linear'] }),
        unmatched({ url: 'https://www.bbc.co.uk/bitesize/unmatched', checked_at: null }),
      ],
    }),
    items: [
      ...items,
      {
        file: 'items/n1.json',
        data: {
          id: 'gcse-maths-h-n1-0001',
          topic: 'gcse-maths-h-n1',
          learning_point: 'gcse-maths-h-n1-lp-order',
        },
      },
    ],
  });
  assert.deepEqual(report, {
    topics: { withItems: 2, withLink: 1, missing: ['gcse-maths-h-n1'] },
    points: {
      withItems: 3,
      withOwnLink: 1,
      withAnyLink: 1,
      missing: ['gcse-maths-h-a17-lp-fractions-negatives', 'gcse-maths-h-n1-lp-order'],
    },
  });
  // A topic-wide link covers every point in the topic, though not with a link of its own.
  const wide = linkCoverage(content({ topic: 'gcse-maths-h-a17', links: [shown()] }));
  assert.deepEqual(wide.points, { withItems: 2, withOwnLink: 0, withAnyLink: 2, missing: [] });
});

test('a reachable link needs a full match check (no legacy links remain)', () => {
  const errors = learnLinkErrors(content({ topic: 'gcse-maths-h-a17', links: [unmatched()] }));
  assert.match(errors[0].message, /needs a match check/);
  // Not yet reachable: no match check needed yet.
  assert.deepEqual(
    learnLinkErrors(
      content({ topic: 'gcse-maths-h-a17', links: [unmatched({ checked_at: null })] }),
    ),
    [],
  );
});

const note = (extra = {}) => ({
  title: 'Solving linear equations',
  route: '/notes/gcse-maths-h-a17',
  provider: 'revisionden',
  level: 'GCSE',
  checked_at: null,
  ...extra,
});

test('the schema leaves room for in-house notes: an internal route, never a URL', () => {
  const { learnLinks } = createValidators();
  const ok = (l) => learnLinks({ topic: 'gcse-maths-h-a17', links: [l] });
  assert.equal(ok(note()), true);
  assert.equal(
    ok(note({ hide_external: true, learning_points: ['gcse-maths-h-a17-lp-solve-linear'] })),
    true,
  );
  assert.equal(ok(note({ route: 'https://revisionden.com/notes/x' })), false);
  assert.equal(ok({ ...note(), url: 'https://www.thenational.academy/x' }), false);
  assert.equal(ok(link({ provider: 'oak', route: '/notes/x' })), false);
  assert.equal(ok(link({ hide_external: true })), false);
});

test('in-house notes are refused until they are built', () => {
  const errors = learnLinkErrors(content({ topic: 'gcse-maths-h-a17', links: [note()] }));
  assert.match(errors[0].message, /in-house notes are not built yet/);
});

test('the link check only requests web links, never an in-house route', () => {
  assert.deepEqual(
    listLinks([{ file: 'f.json', data: { topic: 't', links: [note(), link()] } }]).map(
      (l) => l.url,
    ),
    [link().url],
  );
});

const oakPupil = (extra = {}) =>
  link({
    provider: 'oak',
    url: 'https://www.thenational.academy/pupils/lessons/solving-linear-equations/overview',
    match: match({ page_title: 'Solving linear equations | Oak National Academy' }),
    ...extra,
  });
const oakTeacher =
  'https://www.thenational.academy/teachers/programmes/maths-secondary-ks4-higher/units/u/lessons/solving-linear-equations';

test('Oak links point to the pupil lesson page, not the teacher page', () => {
  assert.deepEqual(
    learnLinkErrors(content({ topic: 'gcse-maths-h-a17', links: [oakPupil()] })),
    [],
  );
  const errors = learnLinkErrors(
    content({ topic: 'gcse-maths-h-a17', links: [oakPupil({ url: oakTeacher })] }),
  );
  assert.deepEqual(
    errors.map((e) => e.message),
    [
      `oak links must be the pupil lesson page (/pupils/lessons/<lesson>/overview), or marked no_pupil_page: ${oakTeacher}`,
    ],
  );
});

test('a teacher page is allowed only for a lesson marked as having no pupil page', () => {
  assert.deepEqual(
    learnLinkErrors(
      content({
        topic: 'gcse-maths-h-a17',
        links: [oakPupil({ url: oakTeacher, no_pupil_page: true })],
      }),
    ),
    [],
  );
  const errors = learnLinkErrors(
    content({
      topic: 'gcse-maths-h-a17',
      links: [oakPupil({ no_pupil_page: true }), link({ no_pupil_page: true })],
    }),
  );
  assert.deepEqual(
    errors.map((e) => e.message),
    [
      `no_pupil_page is only for an Oak teacher page: ${oakPupil().url}`,
      `no_pupil_page is only for an Oak teacher page: ${link().url}`,
    ],
  );
});

test('an Oak pupil link is the overview page, which answers 200 so the title check runs', () => {
  // The bare /pupils/lessons/<lesson> answers 308 to /overview, and the link check reads the
  // title only on a 200, so a bare link would never have its match re-checked.
  const bare = 'https://www.thenational.academy/pupils/lessons/solving-linear-equations';
  const errors = learnLinkErrors(
    content({ topic: 'gcse-maths-h-a17', links: [oakPupil({ url: bare })] }),
  );
  assert.match(errors[0].message, /must be the pupil lesson page/);
});

test('the schema accepts no_pupil_page as true only', () => {
  const { learnLinks } = createValidators();
  const ok = (l) => learnLinks({ topic: 'gcse-maths-h-a17', links: [l] });
  assert.equal(ok(oakPupil({ url: oakTeacher, no_pupil_page: true })), true);
  assert.equal(ok(oakPupil({ url: oakTeacher, no_pupil_page: false })), false);
  assert.equal(ok(oakPupil({ url: oakTeacher, no_pupil_page: 'yes' })), false);
});

test('the link check reads the title of an Oak pupil page', async () => {
  const url = oakPupil().url;
  const html = `<html><head><title>${oakPupil().match.page_title}</title></head></html>`;
  const fakeFetch = async () => ({ status: 200, text: async () => html });
  const [r] = await checkLinks([{ file: 'a.json', url, match: oakPupil().match }], {
    fetch: fakeFetch,
  });
  assert.deepEqual([r.ok, r.status], [true, 200]);
});
