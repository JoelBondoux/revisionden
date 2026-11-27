#!/usr/bin/env node
// Changelog fragments (G13). Each pull request adds one file, changes/unreleased/<branch>.md,
// instead of editing the shared "## [Unreleased]" block of CHANGELOG.md, so pull requests no
// longer conflict there. `assemble` folds the fragments into CHANGELOG.md and deletes them
// (the release workflow runs it on main; deploys run it with --keep so the About page shows
// unreleased lines). `check-pr` fails a pull request that adds no fragment.
//
//   node scripts/changelog.mjs assemble [--keep] [--check]
//   node scripts/changelog.mjs check-pr --base <ref> [--labels '<json array>']
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const FRAGMENT_DIR = 'changes/unreleased';
/** The headings a fragment may use, in the order a new Unreleased block lists them. */
export const SECTIONS = ["What's new", 'Added', 'Changed', 'Fixed'];
export const NO_CHANGELOG_LABEL = 'no-changelog';

/** Reads one fragment into its sections; each entry is one bullet with its continuation lines. */
export function parseFragment(text, name) {
  const sections = {};
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      const title = heading[1].replace('’', "'");
      const known = SECTIONS.find((s) => s.toLowerCase() === title.toLowerCase());
      if (!known) {
        throw new Error(`${name}: unknown heading "${heading[1]}" (use ${SECTIONS.join(', ')})`);
      }
      current = known;
      sections[current] ??= [];
      continue;
    }
    if (line.trim() === '') continue;
    if (!current) throw new Error(`${name}: "${line}" is outside a ### heading`);
    if (/^[-*]\s+\S/.test(line)) sections[current].push(line.replace(/^\*/, '-'));
    else if (/^\s+\S/.test(line) && sections[current].length) {
      sections[current][sections[current].length - 1] += `\n${line}`;
    } else throw new Error(`${name}: "${line}" is not a "- " bullet`);
  }
  for (const [title, lines] of Object.entries(sections)) {
    if (!lines.length) throw new Error(`${name}: ### ${title} has no lines`);
  }
  if (!Object.keys(sections).length) throw new Error(`${name}: no lines`);
  return { name, sections };
}

/**
 * Puts every fragment's lines at the top of their section under "## [Unreleased]", in file name
 * order. Only inserts lines: everything else in the file stays exactly as it was.
 */
export function assembleChangelog(changelog, fragments) {
  if (!fragments.length) return changelog;
  const lines = changelog.split('\n');
  const start = lines.findIndex((l) => /^## \[Unreleased\]\s*$/.test(l));
  if (start === -1) throw new Error('CHANGELOG.md has no "## [Unreleased]" heading');
  const blockEnd = () => {
    const i = lines.findIndex((l, n) => n > start && /^## /.test(l));
    return i === -1 ? lines.length : i;
  };
  const same = (heading, title) =>
    heading.replace('\u2019', "'").toLowerCase() === `### ${title}`.toLowerCase();

  const sorted = [...fragments].sort((a, b) => a.name.localeCompare(b.name));
  for (const title of SECTIONS) {
    const added = sorted.flatMap((f) => f.sections[title] ?? []).flatMap((e) => e.split('\n'));
    if (!added.length) continue;
    const end = blockEnd();
    const at = lines.findIndex((l, n) => n > start && n < end && same(l.trim(), title));
    if (at !== -1) {
      // After the heading and its blank line.
      const first = lines[at + 1]?.trim() === '' ? at + 2 : at + 1;
      lines.splice(first, 0, ...added);
      continue;
    }
    // A new section: What's new goes first, the others after the existing sections.
    if (title === "What's new") lines.splice(start + 1, 0, '', `### ${title}`, '', ...added);
    else {
      const gap = lines[end - 1]?.trim() === '' ? [] : [''];
      lines.splice(end, 0, ...gap, `### ${title}`, '', ...added, '');
    }
  }
  return lines.join('\n');
}

/** The changelog fragments among a list of repository paths. */
export function fragmentPathsIn(paths) {
  return paths.filter((p) => p.startsWith(`${FRAGMENT_DIR}/`) && p.endsWith('.md'));
}

const TEST_OR_CI = [
  /^\.github\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /^e2e\//,
  /(^|\/)__tests__\//,
  /(^|\/)tests?\//,
];

/** Reads `git diff --name-status` output into `{ status, path }` (a rename gives its new path). */
export function parseNameStatus(text) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [code, ...paths] = line.split('\t');
      return { status: code[0], path: paths[paths.length - 1] };
    });
}

/**
 * Whether a pull request's changes (`{ status, path }`, from `parseNameStatus`) need a changelog
 * fragment, and why not if not. Only an added (or renamed-in) fragment counts: editing or deleting
 * another change's fragment does not.
 */
export function needsFragment(changes, labels) {
  if (labels.includes(NO_CHANGELOG_LABEL)) {
    return { ok: true, reason: `labelled ${NO_CHANGELOG_LABEL}` };
  }
  const added = changes.filter((c) => c.status === 'A' || c.status === 'R').map((c) => c.path);
  if (fragmentPathsIn(added).length) return { ok: true, reason: 'adds a fragment' };
  if (changes.every((c) => TEST_OR_CI.some((re) => re.test(c.path)))) {
    return { ok: true, reason: 'only tests or CI' };
  }
  return {
    ok: false,
    reason:
      `add a new changelog fragment, ${FRAGMENT_DIR}/<your-branch>.md (see changes/README.md), ` +
      `or label the pull request ${NO_CHANGELOG_LABEL}`,
  };
}

function readFragments(root) {
  const dir = join(root, FRAGMENT_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseFragment(readFileSync(join(dir, f), 'utf8'), f));
}

function main(argv) {
  const [command, ...rest] = argv;
  const flag = (n) => rest.includes(n);
  const value = (n) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : undefined);
  const root = process.cwd();
  if (command === 'assemble') {
    const fragments = readFragments(root);
    const path = join(root, 'CHANGELOG.md');
    const out = assembleChangelog(readFileSync(path, 'utf8'), fragments);
    if (flag('--check')) {
      console.log(`${fragments.length} changelog fragment(s) are valid.`);
      return 0;
    }
    writeFileSync(path, out);
    if (!flag('--keep')) {
      for (const f of fragments) rmSync(join(root, FRAGMENT_DIR, f.name));
    }
    console.log(`Folded ${fragments.length} changelog fragment(s) into CHANGELOG.md.`);
    return 0;
  }
  if (command === 'check-pr') {
    const base = value('--base') ?? 'origin/dev';
    const labels = JSON.parse(value('--labels') ?? '[]');
    const changed = parseNameStatus(
      execFileSync('git', ['diff', '--name-status', '-M', `${base}...HEAD`], { encoding: 'utf8' }),
    );
    readFragments(root); // every fragment must parse
    const result = needsFragment(changed, labels);
    if (!result.ok) {
      console.error(`::error::Changelog: ${result.reason}`);
      return 1;
    }
    if (changed.some((c) => c.path === 'CHANGELOG.md')) {
      console.log(
        `::warning::This pull request edits CHANGELOG.md directly; move its lines into ${FRAGMENT_DIR}/ so it stops conflicting.`,
      );
    }
    console.log(`Changelog: ok (${result.reason}).`);
    return 0;
  }
  console.error(
    'usage: changelog.mjs assemble [--keep] [--check] | check-pr --base <ref> [--labels <json>]',
  );
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
