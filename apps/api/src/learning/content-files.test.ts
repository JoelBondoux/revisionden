import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readContentDir } from './content-files';

const contentDir = fileURLToPath(new URL('../../../../content', import.meta.url));

describe('reading content/', () => {
  it('reads every topic tree and every item file', async () => {
    const content = await readContentDir(contentDir);
    expect(content.topicTrees.map((t) => t.id)).toContain('gcse-maths-edexcel-1ma1-higher');
    expect(content.items.length).toBeGreaterThan(0);
    expect(content.items.every((i) => typeof i.id === 'string' && i.verification)).toBe(true);
  });
});
