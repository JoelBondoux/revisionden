import { describe, expect, it } from 'vitest';
import { costMicroUsd, MODELS } from './pricing';

describe('AI pricing', () => {
  it('uses Claude Haiku 5.5 for quick marking and Claude Opus 5.5 for long answers', () => {
    expect(MODELS.quick).toBe('claude-haiku-5-5');
    expect(MODELS.long).toBe('claude-opus-5-5');
  });

  it('prices calls in millionths of a dollar, rounding up', () => {
    // Haiku 5.5: $0.10 in, $0.50 out per million tokens.
    expect(costMicroUsd('claude-haiku-5-5', { inputTokens: 1000, outputTokens: 200 })).toBe(200);
    expect(costMicroUsd('claude-haiku-5-5', { inputTokens: 3, outputTokens: 0 })).toBe(1);
    // Opus 5.5: $4 in, $20 out.
    expect(costMicroUsd('claude-opus-5-5', { inputTokens: 1000, outputTokens: 100 })).toBe(6000);
  });

  it('prices a configured second-checker model', () => {
    const extra = { 'checker-model': { inputUsdPerMTok: 0.2, outputUsdPerMTok: 0.8 } };
    expect(costMicroUsd('checker-model', { inputTokens: 1000, outputTokens: 1000 }, extra)).toBe(
      1000,
    );
  });

  it('refuses to price an unknown model, so the cap can never be skipped', () => {
    expect(() => costMicroUsd('mystery-model', { inputTokens: 1, outputTokens: 1 })).toThrow(
      /No price for model mystery-model/,
    );
  });
});
