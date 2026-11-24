#!/usr/bin/env node
// Usage: node scripts/bump-version.mjs [--show] [--type patch|minor|major] [--message "commit msg"]
import { readFileSync, writeFileSync } from 'node:fs';
import { bumpVersion, bumpTypeFromMessage, parseVersion } from './version.mjs';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const current = readFileSync('VERSION', 'utf8').trim();
parseVersion(current);
if (args.includes('--show')) {
  console.log(current);
  process.exit(0);
}
const type = get('--type') ?? bumpTypeFromMessage(get('--message') ?? '');
const next = bumpVersion(current, type);
writeFileSync('VERSION', `${next}\n`);
console.log(next);
