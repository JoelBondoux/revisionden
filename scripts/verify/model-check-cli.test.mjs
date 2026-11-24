import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './model-check-cli.mjs';
import { draftItem } from './test-content.mjs';

const fake = (provider, output) => ({
  provider,
  model: `${provider}-fixture-model`,
  calls: 0,
  async complete() {
    this.calls += 1;
    return { output, modelVersion: `${provider}-fixture-model-001` };
  },
});

async function contentDir(items) {
  const root = await mkdtemp(join(tmpdir(), 'rd-mc-'));
  await mkdir(join(root, 'items'), { recursive: true });
  await writeFile(join(root, 'items/f.json'), JSON.stringify(items));
  return root;
}
const io = () => {
  const lines = [];
  return { lines, out: (s) => lines.push(s), err: (s) => lines.push(s) };
};
const item = draftItem('fixture-a');

test('runs the blind answer and the adversarial review for every draft item', async () => {
  const root = await contentDir([item]);
  const providers = {
    openai: fake('openai', { answer: 'fixture answer', confidence: 'high', reasoning: '' }),
    gemini: fake('gemini', { problems: [], confidence: 'high' }),
  };
  const out = io();
  const code = await run(['--content', root, '--blind', 'openai', '--review', 'gemini'], {
    ...out,
    providerFor: (name) => providers[name],
  });
  assert.equal(code, 0);
  assert.match(out.lines.join('\n'), /pass {2}fixture-a {2}blind-answer/);
  assert.match(out.lines.join('\n'), /pass {2}fixture-a {2}adversarial-review/);
});

test('exits 1 when any check fails, and --write records both checks', async () => {
  const root = await contentDir([item]);
  const providers = {
    openai: fake('openai', { answer: 'something else', confidence: 'high', reasoning: '' }),
    anthropic: fake('anthropic', { problems: [], confidence: 'high' }),
  };
  const code = await run(
    ['--content', root, '--blind', 'openai', '--review', 'anthropic', '--write'],
    { ...io(), providerFor: (name) => providers[name] },
  );
  assert.equal(code, 1);
  const [saved] = JSON.parse(await readFile(join(root, 'items/f.json'), 'utf8'));
  assert.deepEqual(
    saved.verification.checks.map((c) => [c.name, c.result]),
    [
      ['blind-answer', 'fail'],
      ['adversarial-review', 'pass'],
    ],
  );
});

test('skips verified items, which are immutable', async () => {
  const verified = { ...item, verification: { ...item.verification, status: 'verified' } };
  const root = await contentDir([verified]);
  const openai = fake('openai', { answer: 'x', confidence: 'high', reasoning: '' });
  const out = io();
  const code = await run(['--content', root, '--blind', 'openai'], {
    ...out,
    providerFor: () => openai,
  });
  assert.equal(code, 1);
  assert.equal(openai.calls, 0);
  assert.match(out.lines.join('\n'), /No draft items to check/);
});

test('needs at least one of --blind or --review', async () => {
  const out = io();
  assert.equal(await run([], { ...out, providerFor: () => null }), 2);
  assert.match(out.lines.join('\n'), /--blind <provider> and\/or --review <provider>/);
});

test('reports a provider error for an item and carries on', async () => {
  const root = await contentDir([item, draftItem('fixture-b')]);
  let n = 0;
  const flaky = {
    provider: 'openai',
    model: 'm',
    async complete() {
      n += 1;
      if (n === 1) throw new Error('openai returned HTTP 500');
      return {
        output: { answer: 'fixture answer', confidence: 'high', reasoning: '' },
        modelVersion: 'v',
      };
    },
  };
  const out = io();
  const code = await run(['--content', root, '--blind', 'openai'], {
    ...out,
    providerFor: () => flaky,
  });
  assert.equal(code, 1);
  assert.match(out.lines.join('\n'), /ERROR fixture-a {2}blind-answer {2}openai returned HTTP 500/);
  assert.match(out.lines.join('\n'), /pass {2}fixture-b {2}blind-answer/);
});
