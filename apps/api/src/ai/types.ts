import type { TokenUsage } from './pricing';

export type ProviderName = 'anthropic' | 'openai';

export interface AiRequest {
  model: string;
  system: string;
  /** The only user content: question, answer, topic and mark scheme, as JSON text. */
  user: string;
  /** JSON Schema the provider must answer in (structured outputs). */
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
}

export interface AiResponse {
  /** Parsed JSON; the gateway validates it with Zod before anyone uses it. */
  output: unknown;
  usage: TokenUsage;
}

export interface AiProvider {
  readonly name: ProviderName;
  complete(request: AiRequest): Promise<AiResponse>;
}

/** A failed provider call. `usage` is set when tokens were still billed. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
    readonly usage?: TokenUsage,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

/** Retryable HTTP statuses: timeouts, conflicts, rate limits, overload and server errors. */
export const isRetryableStatus = (status: number) =>
  status === 408 || status === 409 || status === 429 || status >= 500;
