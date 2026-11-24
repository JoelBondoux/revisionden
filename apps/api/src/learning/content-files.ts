import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContentItem, ContentTopicTree } from './content-sync';

async function jsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

const readJsonFile = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as unknown;

/** Reads topic trees and item files from a content/ folder (Node only, for the sync CLI). */
export async function readContentDir(
  dir: string,
): Promise<{ topicTrees: ContentTopicTree[]; items: ContentItem[] }> {
  const topicTrees = await Promise.all(
    (await jsonFiles(join(dir, 'topic-trees'))).map(
      async (f) => (await readJsonFile(f)) as ContentTopicTree,
    ),
  );
  const items = (
    await Promise.all(
      (await jsonFiles(join(dir, 'items'))).map(
        async (f) => (await readJsonFile(f)) as ContentItem[],
      ),
    )
  ).flat();
  return { topicTrees, items };
}
