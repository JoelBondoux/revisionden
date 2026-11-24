// Writes updated content back to its JSON file, formatted like the rest of the repository.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prettier from 'prettier';
import { REPO_ROOT } from './sources.mjs';

/** Replaces the entry with data.id in root/file (an item array or a single object) and saves. */
export async function replaceInFile(root, file, data) {
  const path = join(root, file);
  const current = JSON.parse(await readFile(path, 'utf8'));
  let next;
  if (Array.isArray(current)) {
    const at = current.findIndex((e) => e.id === data.id);
    if (at < 0) throw new Error(`${data.id} is not in ${file}`);
    next = current.with(at, data);
  } else if (current.id === data.id) {
    next = data;
  } else {
    throw new Error(`${data.id} is not in ${file}`);
  }
  const options = (await prettier.resolveConfig(join(REPO_ROOT, 'package.json'))) ?? {};
  await writeFile(
    path,
    await prettier.format(JSON.stringify(next), { ...options, parser: 'json' }),
  );
}
