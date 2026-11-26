// "Learn it first" and "Learn more" links (workstream Q): content/learn-links/<topic id>.json.
// learnLinkErrors checks the links against the subjects, topic trees and items; checkLinks requests
// every URL (the CI link check, scripts/content/check-links.mjs) and reports any that are broken or
// whose title changed since the match check; linkCoverage counts what has a link.

/**
 * Where each allowed provider's pages live (owner decision 2026-11-26: Oak, BBC Bitesize, Isaac).
 * A link's host must be one of these and its path start with that entry's `path`. Isaac: read on
 * 2026-11-26, isaacphysics.org redirects to isaacscience.org, which calls itself Isaac Science.
 */
export const PROVIDER_HOSTS = {
  oak: [{ host: 'www.thenational.academy', path: '/' }],
  bitesize: [{ host: 'www.bbc.co.uk', path: '/bitesize/' }],
  isaac: [{ host: 'isaacscience.org', path: '/' }],
};

/** Shown in the app with a full check: reachable (checked_at) and match-checked (match). */
export const isShownLink = (link) => link.checked_at !== null && Boolean(link.match);

/** In-house notes (provider revisionden, planned): refused until the notes exist. */
export const IN_HOUSE_NOTES_BUILT = false;

function* walkTopics(nodes) {
  for (const node of nodes ?? []) {
    yield node;
    yield* walkTopics(node.children);
  }
}

/** Problems with the learn links, given loaded content (subjects, topic trees, learn links). */
export function learnLinkErrors(content) {
  const errors = [];
  const levels = new Map(content.subjects.map(({ data }) => [data.id, data.level]));
  const topics = new Map();
  for (const { data: tree } of content.topicTrees) {
    for (const node of walkTopics(tree.topics)) {
      topics.set(node.id, { board: tree.board, level: levels.get(tree.subject) });
    }
  }
  const topicItems = new Map();
  for (const { data: item } of content.items ?? []) {
    if (!topicItems.has(item.topic))
      topicItems.set(item.topic, { ids: new Set(), points: new Set() });
    const t = topicItems.get(item.topic);
    t.ids.add(item.id);
    if (item.learning_point) t.points.add(item.learning_point);
  }
  for (const { file, data } of content.learnLinks ?? []) {
    const id = data.topic;
    const add = (message) => errors.push({ file, id, message });
    const name = file.split('/').pop();
    if (name !== `${id}.json`) add(`file name must be ${id}.json`);
    const topic = topics.get(id);
    if (!topic) {
      add(`topic ${id} does not exist`);
      continue;
    }
    const urls = new Set();
    for (const link of data.links) {
      if (link.provider === 'revisionden') {
        if (!IN_HOUSE_NOTES_BUILT) add(`in-house notes are not built yet (${link.route})`);
        continue;
      }
      if (urls.has(link.url)) add(`${link.url} is listed twice`);
      urls.add(link.url);
      if (link.checked_at !== null && !link.match) {
        add(`${link.url} is reachable but needs a match check before it can show`);
      }
      const where = PROVIDER_HOSTS[link.provider];
      let url;
      try {
        url = new URL(link.url);
      } catch {
        add(`${link.url} is not a valid URL`);
        continue;
      }
      if (where.length === 0) {
        add(`${link.provider} has no confirmed host yet (${link.url})`);
      } else if (!where.some((w) => url.host === w.host && url.pathname.startsWith(w.path))) {
        const hosts = where.map((w) => `${w.host}${w.path}`).join(' or ');
        add(`${link.provider} links must be on ${hosts} (${link.url})`);
      }
      const known = topicItems.get(id) ?? { ids: new Set(), points: new Set() };
      for (const point of link.learning_points ?? []) {
        if (!known.points.has(point))
          add(`learning point ${point} has no items in ${id}: ${link.url}`);
      }
      for (const itemId of link.items ?? []) {
        if (!known.ids.has(itemId)) add(`item ${itemId} is not in ${id}: ${link.url}`);
      }
      if (link.match && link.match.level !== link.level) {
        add(`match check says ${link.match.level} but the link is ${link.level}: ${link.url}`);
      }
      if (link.level !== topic.level) {
        add(`level ${link.level} does not match the subject (${topic.level}): ${link.url}`);
      }
      if (link.board && link.board !== topic.board) {
        add(`board ${link.board} does not match the topic tree (${topic.board}): ${link.url}`);
      }
    }
  }
  return errors;
}

/** Every link as { file, topic, url } (and its match check, when it has one). */
export function listLinks(learnLinks) {
  return learnLinks.flatMap(({ file, data }) =>
    data.links
      .filter((link) => link.url)
      .map((link) => ({
        file,
        topic: data.topic,
        url: link.url,
        ...(link.match ? { match: link.match } : {}),
      })),
  );
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** The page's <title>, with entities decoded and runs of spaces squashed, or null. */
export function pageTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html ?? '');
  if (!m) return null;
  return m[1]
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (all, name) => ENTITIES[name.toLowerCase()] ?? all)
    .replace(/\s+/g, ' ')
    .trim();
}

/** 2xx and 3xx mean the page is there (a redirect is not followed). */
export const isWorkingStatus = (status) => status >= 200 && status < 400;

/**
 * Requests every URL once (GET, redirects not followed) and returns
 * { ...link, ok, status } with the status code or the network error message.
 */
export async function checkLinks(links, { fetch = globalThis.fetch, timeoutMs = 20_000 } = {}) {
  const results = [];
  for (const link of links) {
    try {
      const res = await fetch(link.url, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': 'RevisionDen link check' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const working = isWorkingStatus(res.status);
      // A match-checked page that answers 200 must still have the title it had when it was read.
      if (working && link.match && res.status < 300) {
        const title = pageTitle(await res.text());
        if (title !== link.match.page_title) {
          const status = `title changed to "${title}": re-check the match`;
          results.push({ ...link, ok: false, status });
          continue;
        }
      }
      results.push({ ...link, ok: working, status: res.status });
    } catch (err) {
      results.push({ ...link, ok: false, status: err.message });
    }
  }
  return results;
}

/** Requests each provider's home page once and reports the status or error (never fails). */
export async function probeProviders({ fetch = globalThis.fetch, timeoutMs = 20_000 } = {}) {
  const results = [];
  for (const [provider, hosts] of Object.entries(PROVIDER_HOSTS)) {
    for (const { host, path } of hosts) {
      const url = `https://${host}${path}`;
      try {
        const res = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          headers: { 'user-agent': 'RevisionDen link check' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        results.push({ provider, url, status: res.status });
      } catch (err) {
        results.push({ provider, url, status: err.message });
      }
    }
  }
  return results;
}

/**
 * How much of the content has a shown link: topics with items, and learning points with items
 * (with a link of their own, or covered by a topic-wide one).
 */
export function linkCoverage(content) {
  const topics = new Map();
  for (const { data: item } of content.items ?? []) {
    if (!topics.has(item.topic)) topics.set(item.topic, new Set());
    if (item.learning_point) topics.get(item.topic).add(item.learning_point);
  }
  const shown = new Map();
  for (const { data } of content.learnLinks ?? []) {
    shown.set(data.topic, data.links.filter(isShownLink));
  }
  const missingTopics = [];
  const missingPoints = [];
  let points = 0;
  let own = 0;
  let any = 0;
  for (const [topic, topicPoints] of [...topics].sort(([a], [b]) => a.localeCompare(b))) {
    const links = shown.get(topic) ?? [];
    if (links.length === 0) missingTopics.push(topic);
    const wide = links.some((l) => !l.learning_points && !l.items);
    for (const point of [...topicPoints].sort()) {
      points += 1;
      const hasOwn = links.some((l) => l.learning_points?.includes(point));
      if (hasOwn) own += 1;
      if (hasOwn || wide) any += 1;
      else missingPoints.push(point);
    }
  }
  return {
    topics: {
      withItems: topics.size,
      withLink: topics.size - missingTopics.length,
      missing: missingTopics,
    },
    points: { withItems: points, withOwnLink: own, withAnyLink: any, missing: missingPoints },
  };
}
