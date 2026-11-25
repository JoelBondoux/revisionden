// "Learn it first" links (workstream Q): content/learn-links/<topic id>.json.
// learnLinkErrors checks the links against the subjects and topic trees; checkLinks requests every
// URL (the CI link check, scripts/content/check-links.mjs) and reports any that are broken.

/** Where each provider's pages live. A link's host must match and its path start with `path`. */
export const PROVIDER_HOSTS = {
  oak: { host: 'www.thenational.academy', path: '/' },
  bitesize: { host: 'www.bbc.co.uk', path: '/bitesize/' },
};

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
      if (urls.has(link.url)) add(`${link.url} is listed twice`);
      urls.add(link.url);
      const where = PROVIDER_HOSTS[link.provider];
      let url;
      try {
        url = new URL(link.url);
      } catch {
        add(`${link.url} is not a valid URL`);
        continue;
      }
      if (url.host !== where.host || !url.pathname.startsWith(where.path)) {
        add(`${link.provider} links must be on ${where.host}${where.path} (${link.url})`);
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

/** Every link as { file, topic, url }. */
export function listLinks(learnLinks) {
  return learnLinks.flatMap(({ file, data }) =>
    data.links.map((link) => ({ file, topic: data.topic, url: link.url })),
  );
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
      results.push({ ...link, ok: isWorkingStatus(res.status), status: res.status });
    } catch (err) {
      results.push({ ...link, ok: false, status: err.message });
    }
  }
  return results;
}
