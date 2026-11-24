import { describe, expect, it } from 'vitest';
import okFixture from './fixtures/anthropic-marking-ok.json';
import { createAnthropicProvider } from './anthropic';
import { AiProviderError } from './types';

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function fakeFetch(...responses: (() => Response)[]) {
  const calls: Captured[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    calls.push({
      url: req.url,
      headers: req.headers,
      body: (await req.json()) as Record<string, unknown>,
    });
    const next = responses.shift();
    if (!next) throw new Error('No more fixture responses');
    return next();
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const request = {
  model: 'claude-haiku-5-5',
  system: 'You mark answers.',
  user: '{"question":"What does the cell membrane do?"}',
  jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
  maxTokens: 2000,
};

const base = {
  apiKey: 'test-key-not-real',
  gatewayUrl: 'https://gateway.example.com/v1/acct/revisionden',
};

describe('Anthropic provider', () => {
  it('sends a structured-output request through the AI Gateway', async () => {
    const { calls, fetch } = fakeFetch(json(okFixture));
    const provider = createAnthropicProvider({ ...base, gatewayToken: 'gw-token', fetch });
    const result = await provider.complete(request);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://gateway.example.com/v1/acct/revisionden/anthropic/v1/messages');
    expect(call.headers.get('authorization')).toBe('Bearer test-key-not-real');
    expect(call.headers.get('cf-aig-authorization')).toBe('Bearer gw-token');
    // The gateway must not keep prompts or answers in its logs.
    expect(call.headers.get('cf-aig-collect-log-payload')).toBe('false');
    expect(call.body).toMatchObject({
      model: 'claude-haiku-5-5',
      max_tokens: 2000,
      system: 'You mark answers.',
      messages: [{ role: 'user', content: request.user }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: request.jsonSchema } },
    });

    expect(result).toEqual({
      output: {
        points: [{ code: 'B1', met: true, evidence: 'controls what goes in and out' }],
        sure: true,
        feedback: 'Good: you described what the membrane does.',
      },
      usage: { inputTokens: 412, outputTokens: 96 },
    });
  });

  it('leaves out the gateway token header when the gateway is not authenticated', async () => {
    const { calls, fetch } = fakeFetch(json(okFixture));
    await createAnthropicProvider({ ...base, fetch }).complete(request);
    expect(calls[0]!.headers.get('cf-aig-authorization')).toBeNull();
  });

  it.each([429, 500, 529])('marks a %i as worth retrying', async (status) => {
    const { fetch } = fakeFetch(
      json({ type: 'error', error: { type: 'x', message: 'busy' } }, status),
    );
    const err = await createAnthropicProvider({ ...base, fetch })
      .complete(request)
      .catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err).toMatchObject({ retryable: true, status });
  });

  it('does not retry a bad request', async () => {
    const { calls, fetch } = fakeFetch(
      json({ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }, 400),
    );
    const err = await createAnthropicProvider({ ...base, fetch })
      .complete(request)
      .catch((e) => e);
    expect(err).toMatchObject({ retryable: false, status: 400 });
    expect(calls).toHaveLength(1);
  });

  it('treats a network failure as worth retrying', async () => {
    const fetch = (async () => {
      throw new TypeError('network down');
    }) as typeof globalThis.fetch;
    const err = await createAnthropicProvider({ ...base, fetch })
      .complete(request)
      .catch((e) => e);
    expect(err).toMatchObject({ retryable: true });
  });

  it('reports a refusal without retrying, and keeps the usage for the spend record', async () => {
    const { fetch } = fakeFetch(json({ ...okFixture, content: [], stop_reason: 'refusal' }));
    const err = await createAnthropicProvider({ ...base, fetch })
      .complete(request)
      .catch((e) => e);
    expect(err).toMatchObject({ retryable: false, usage: { inputTokens: 412, outputTokens: 96 } });
  });

  it('reports text that is not JSON as worth retrying', async () => {
    const { fetch } = fakeFetch(
      json({ ...okFixture, content: [{ type: 'text', text: 'Sure! Here' }] }),
    );
    const err = await createAnthropicProvider({ ...base, fetch })
      .complete(request)
      .catch((e) => e);
    expect(err).toMatchObject({ retryable: true, usage: { inputTokens: 412, outputTokens: 96 } });
  });
});
