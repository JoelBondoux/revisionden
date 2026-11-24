import Anthropic from '@anthropic-ai/sdk';
import { AiProviderError, isRetryableStatus, type AiProvider } from './types';

export interface AnthropicProviderOptions {
  apiKey: string;
  /** `https://gateway.ai.cloudflare.com/v1/<account>/<gateway>` */
  gatewayUrl: string;
  /** Set when the gateway requires authentication. */
  gatewayToken?: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * Claude through Cloudflare AI Gateway, using the official SDK. Retries are done by our
 * gateway (so every attempt is counted against the child's cap), not by the SDK.
 */
export function createAnthropicProvider(options: AnthropicProviderOptions): AiProvider {
  const client = new Anthropic({
    apiKey: options.apiKey,
    baseURL: `${options.gatewayUrl.replace(/\/$/, '')}/anthropic`,
    maxRetries: 0,
    timeout: 30_000,
    fetch: options.fetch,
    defaultHeaders: {
      // Keep metadata (tokens, cost) in gateway logs but never the prompt or the answer.
      'cf-aig-collect-log-payload': 'false',
      ...(options.gatewayToken ? { 'cf-aig-authorization': `Bearer ${options.gatewayToken}` } : {}),
    },
  });

  return {
    name: 'anthropic',
    async complete(request) {
      let message: Anthropic.Message;
      try {
        message = await client.messages.create({
          model: request.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: 'user', content: request.user }],
          output_config: {
            effort: 'low',
            format: { type: 'json_schema', schema: request.jsonSchema },
          },
        });
      } catch (err) {
        if (err instanceof Anthropic.APIConnectionError) {
          throw new AiProviderError('Could not reach the AI provider', true);
        }
        if (err instanceof Anthropic.APIError && typeof err.status === 'number') {
          throw new AiProviderError(
            `AI provider error ${err.status}`,
            isRetryableStatus(err.status),
            err.status,
          );
        }
        throw err;
      }

      const usage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };
      if (message.stop_reason === 'refusal') {
        throw new AiProviderError('The AI provider declined the request', false, 200, usage);
      }
      const text = message.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('');
      try {
        return { output: JSON.parse(text) as unknown, usage };
      } catch {
        throw new AiProviderError('The AI reply was not valid JSON', true, 200, usage);
      }
    },
  };
}
