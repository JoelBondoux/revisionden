import { describe, expect, it } from 'vitest';
import { TEST_CONFIG } from '../test/helpers';
import { createProviders } from './providers';

describe('createProviders', () => {
  it('switches on only the providers whose keys are set', () => {
    expect(Object.keys(createProviders(TEST_CONFIG))).toEqual([]);
    const both = createProviders({
      ...TEST_CONFIG,
      ai: { ...TEST_CONFIG.ai, anthropicApiKey: 'a', openaiApiKey: 'o' },
    });
    expect(Object.keys(both).sort()).toEqual(['anthropic', 'openai']);
    expect(both.anthropic!.name).toBe('anthropic');
  });
});
