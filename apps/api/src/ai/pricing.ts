/** Models (docs/AI.md) and their prices. Costs are in millionths of a US dollar. */
export const MODELS = {
  /** Hints and short-answer marking. */
  quick: 'claude-haiku-5-5',
  /** Long answers, essays and homework (not live yet). */
  long: 'claude-opus-5-5',
} as const;

export interface ModelPrice {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Anthropic list prices (US dollars per million tokens). Haiku 5.5 is for prompts up to 100K
// tokens; our marking prompts are far smaller.
const PRICES: Record<string, ModelPrice> = {
  'claude-haiku-5-5': { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5 },
  'claude-opus-5-5': { inputUsdPerMTok: 4, outputUsdPerMTok: 20 },
};

/** Dollars per million tokens equals micro-dollars per token, so this is a plain multiply. */
export function costMicroUsd(
  model: string,
  usage: TokenUsage,
  extra: Record<string, ModelPrice> = {},
): number {
  const price = extra[model] ?? PRICES[model];
  if (!price) throw new Error(`No price for model ${model}`);
  return Math.ceil(
    usage.inputTokens * price.inputUsdPerMTok + usage.outputTokens * price.outputUsdPerMTok,
  );
}
