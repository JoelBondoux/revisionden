import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { replaceInFile } from './content-files.mjs';

async function setup(name, data) {
  const root = await mkdtemp(join(tmpdir(), 'rd-content-'));
  await mkdir(join(root, 'items'), { recursive: true });
  await writeFile(join(root, name), JSON.stringify(data));
  return root;
}

test('replaces one item in an item file and keeps the others', async () => {
  const root = await setup('items/a.json', [
    { id: 'one', v: 1 },
    { id: 'two', v: 1 },
  ]);
  await replaceInFile(root, 'items/a.json', { id: 'two', v: 2 });
  const saved = JSON.parse(await readFile(join(root, 'items/a.json'), 'utf8'));
  assert.deepEqual(saved, [
    { id: 'one', v: 1 },
    { id: 'two', v: 2 },
  ]);
});

test('replaces a single-object file such as a topic tree', async () => {
  const root = await setup('items/tree.json', { id: 'tree', v: 1 });
  await replaceInFile(root, 'items/tree.json', { id: 'tree', v: 2 });
  assert.deepEqual(JSON.parse(await readFile(join(root, 'items/tree.json'), 'utf8')), {
    id: 'tree',
    v: 2,
  });
});

test('formats the file the way the repository formatter does', async () => {
  const root = await setup('items/a.json', [{ id: 'one', tags: ['a', 'b'] }]);
  await replaceInFile(root, 'items/a.json', { id: 'one', tags: ['a', 'b'] });
  const text = await readFile(join(root, 'items/a.json'), 'utf8');
  assert.match(text, /"tags": \["a", "b"\]/);
  assert.ok(text.endsWith('\n'));
});

test('refuses to write when the id is not in the file', async () => {
  const root = await setup('items/a.json', [{ id: 'one' }]);
  await assert.rejects(
    replaceInFile(root, 'items/a.json', { id: 'missing' }),
    /missing is not in items\/a.json/,
  );
});
