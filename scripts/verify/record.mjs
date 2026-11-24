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

/** A copy of the content with this check replacing any earlier check of the same name. */
export function withCheck(data, check) {
  assertWritable(data);
  const checks = data.verification.checks.filter((c) => c.name !== check.name);
  return { ...data, verification: { ...data.verification, checks: [...checks, check] } };
}
