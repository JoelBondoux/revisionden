import { describe, expect, it } from 'vitest';
import okFixture from './fixtures/openai-check-ok.json';
import { createOpenAiProvider } from './openai';

function fakeFetch(status: number, body: unknown) {
  const calls: Request[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(new Request(input, init));
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const request = {
  model: 'checker-model',
  system: 'Check this.',
  user: '{"question":"q"}',
  jsonSchema: {
    type: 'object',
    properties: { agree: { type: 'boolean' } },
    required: ['agree'],
    additionalProperties: false,
  },
  maxTokens: 500,
};
const base = { apiKey: 'test-openai-key', gatewayUrl: 'https://gateway.example.com/v1/acct/gw/' };

describe('OpenAI second-checker provider', () => {
  it('sends a strict JSON-schema request through the AI Gateway', async () => {
    const { calls, fetch } = fakeFetch(200, okFixture);
    const result = await createOpenAiProvider({ ...base, gatewayToken: 'gw', fetch }).complete(
      request,
    );
    const req = calls[0]!;
    expect(req.url).toBe('https://gateway.example.com/v1/acct/gw/openai/chat/completions');
    expect(req.headers.get('authorization')).toBe('Bearer test-openai-key');
    expect(req.headers.get('cf-aig-authorization')).toBe('Bearer gw');
    expect(req.headers.get('cf-aig-collect-log-payload')).toBe('false');
    expect(await req.json()).toEqual({
      model: 'checker-model',
      max_completion_tokens: 500,
      messages: [
        { role: 'system', content: 'Check this.' },
        { role: 'user', content: '{"question":"q"}' },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'result', strict: true, schema: request.jsonSchema },
      },
    });
    expect(result).toEqual({
      output: { agree: true },
      usage: { inputTokens: 300, outputTokens: 20 },
    });
  });

  it('marks overload as worth retrying and bad requests as not', async () => {
    const busy = await createOpenAiProvider({ ...base, fetch: fakeFetch(503, {}).fetch })
      .complete(request)
      .catch((e) => e);
    expect(busy).toMatchObject({ retryable: true, status: 503 });
    const bad = await createOpenAiProvider({ ...base, fetch: fakeFetch(400, {}).fetch })
      .complete(request)
      .catch((e) => e);
    expect(bad).toMatchObject({ retryable: false, status: 400 });
  });

  it('treats a network failure as worth retrying', async () => {
    const fetch = (async () => {
      throw new TypeError('down');
    }) as typeof globalThis.fetch;
    expect(
      await createOpenAiProvider({ ...base, fetch })
        .complete(request)
        .catch((e) => e),
    ).toMatchObject({
      retryable: true,
    });
  });

  it('reports a refusal and non-JSON content with the billed usage', async () => {
    const refusal = structuredClone(okFixture);
    refusal.choices[0]!.message = {
      role: 'assistant',
      content: null as never,
      refusal: 'no' as never,
    };
    const err = await createOpenAiProvider({ ...base, fetch: fakeFetch(200, refusal).fetch })
      .complete(request)
      .catch((e) => e);
    expect(err).toMatchObject({ retryable: false, usage: { inputTokens: 300, outputTokens: 20 } });

    const junk = structuredClone(okFixture);
    junk.choices[0]!.message.content = 'not json';
    const err2 = await createOpenAiProvider({ ...base, fetch: fakeFetch(200, junk).fetch })
      .complete(request)
      .catch((e) => e);
    expect(err2).toMatchObject({ retryable: true });
  });
});
