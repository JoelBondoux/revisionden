import { AiProviderError, isRetryableStatus, type AiProvider } from './types';

export interface OpenAiProviderOptions {
  apiKey: string;
  gatewayUrl: string;
  gatewayToken?: string;
  fetch?: typeof globalThis.fetch;
}

interface ChatCompletion {
  choices?: { message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Second checker (a different provider from the marker), via AI Gateway's OpenAI route. */
export function createOpenAiProvider(options: OpenAiProviderOptions): AiProvider {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const url = `${options.gatewayUrl.replace(/\/$/, '')}/openai/chat/completions`;

  return {
    name: 'openai',
    async complete(request) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${options.apiKey}`,
            'cf-aig-collect-log-payload': 'false',
            ...(options.gatewayToken
              ? { 'cf-aig-authorization': `Bearer ${options.gatewayToken}` }
              : {}),
          },
          body: JSON.stringify({
            model: request.model,
            max_completion_tokens: request.maxTokens,
            messages: [
              { role: 'system', content: request.system },
              { role: 'user', content: request.user },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'result', strict: true, schema: request.jsonSchema },
            },
          }),
        });
      } catch {
        throw new AiProviderError('Could not reach the AI provider', true);
      }
      if (!res.ok) {
        throw new AiProviderError(
          `AI provider error ${res.status}`,
          isRetryableStatus(res.status),
          res.status,
        );
      }
      const body = (await res.json()) as ChatCompletion;
      const usage = {
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      };
      const message = body.choices?.[0]?.message;
      if (message?.refusal) {
        throw new AiProviderError('The AI provider declined the request', false, 200, usage);
      }
      try {
        return { output: JSON.parse(message?.content ?? '') as unknown, usage };
      } catch {
        throw new AiProviderError('The AI reply was not valid JSON', true, 200, usage);
      }
    },
  };
}
