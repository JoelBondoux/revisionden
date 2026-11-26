// Helpers for verification records (content/schemas/common.schema.json, docs/VERIFICATION.md).

export const KINDS = ['items', 'topicTrees', 'markSchemes', 'diagrams'];

function* walkTopics(nodes) {
  for (const node of nodes ?? []) {
    yield node;
    yield* walkTopics(node.children);
  }
}

/** Leaf topics of a topic tree. */
export const leavesOf = (tree) => [...walkTopics(tree.topics)].filter((n) => !n.children);

/** Every citation of a piece of content (topic trees: the citations of every leaf). */
export function citationsOf(kind, data) {
  if (kind === 'topicTrees') return leavesOf(data).flatMap((n) => n.citations ?? []);
  return data.citations ?? [];
}

/** Every piece of content with its kind, file and citations. only: limit to one id. */
export function* entriesOf(content, { only } = {}) {
  for (const kind of KINDS) {
    for (const { file, data } of content[kind] ?? []) {
      if (only && data.id !== only) continue;
      yield { kind, file, data, citations: citationsOf(kind, data) };
    }
  }
}

/** Timestamp in the record format (seconds, UTC). */
export const stamp = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Refuses to change a verified version: verified content is immutable. */
export function assertWritable(data) {
  const { status, version } = data.verification;
  if (status === 'verified') {
    throw new Error(
      `${data.id}: verified version ${version} is immutable; create version ${version + 1} first`,
    );
  }
}

// Control characters (U+0000 to U+001F except tab and newline) break the database sync
// (Postgres refuses \u0000 in jsonb: 22P05), so content never holds them.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f]/g;

/** Text with each control character (other than tab and newline) replaced by a space. */
export const cleanText = (text) => String(text).replace(CONTROL, ' ');

/** Where control characters are in a piece of content: [{ path, code }] (path like a.b[0].c). */
export function controlCharacters(value, path = '') {
  if (typeof value === 'string') {
    return [...new Set(value.match(CONTROL) ?? [])].map((ch) => ({
      path,
      code: `U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
    }));
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => controlCharacters(v, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      controlCharacters(v, path ? `${path}.${k}` : k),
    );
  }
  return [];
}

const cleanCheck = (check) =>
  Object.fromEntries(
    Object.entries(check).map(([k, v]) => [k, typeof v === 'string' ? cleanText(v) : v]),
  );

/**
 * A copy of the content with this check replacing any earlier check of the same name. Model
 * output in the check is cleaned of control characters first.
 */
export function withCheck(data, check) {
  assertWritable(data);
  const checks = data.verification.checks.filter((c) => c.name !== check.name);
  return {
    ...data,
    verification: { ...data.verification, checks: [...checks, cleanCheck(check)] },
  };
}
