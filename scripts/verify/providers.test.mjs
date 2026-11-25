import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createAnthropicProvider,
  createGeminiProvider,
  createOpenAIProvider,
  providerFromEnv,
} from './providers.mjs';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/providers/${name}.json`, import.meta.url), 'utf8'));

const SCHEMA = {
  type: 'object',
  properties: {
    option: { type: 'integer' },
    confidence: { enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string' },
  },
  required: ['option', 'confidence', 'reasoning'],
  additionalProperties: false,
};
const REQUEST = {
  system: 'You are a checker.',
  prompt: 'Which option?',
  schema: SCHEMA,
  schemaName: 'answer',
};

function recorder(body, status = 200) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}

test('Anthropic: forces a tool call with the schema and returns its input', async () => {
  const { fetch, calls } = recorder(fixture('anthropic-tool-use'));
  const p = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-opus-5-5', fetch });
  const r = await p.complete(REQUEST);
  assert.deepEqual(r.output, { option: 2, confidence: 'high', reasoning: 'Fixture reasoning.' });
  assert.equal(r.modelVersion, 'claude-opus-5-5-fixture');
  assert.equal(p.provider, 'anthropic');
  const [call] = calls;
  assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(call.init.headers['x-api-key'], 'test-key');
  assert.equal(call.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(call.body.model, 'claude-opus-5-5');
  assert.equal(call.body.system, 'You are a checker.');
  assert.deepEqual(call.body.messages, [{ role: 'user', content: 'Which option?' }]);
  assert.deepEqual(call.body.tools[0].input_schema, SCHEMA);
  assert.deepEqual(call.body.tool_choice, { type: 'tool', name: 'answer' });
});

test('OpenAI: asks for strict JSON schema output and parses the message', async () => {
  const { fetch, calls } = recorder(fixture('openai-chat'));
  const p = createOpenAIProvider({ apiKey: 'test-key', model: 'openai-fixture-model', fetch });
  const r = await p.complete(REQUEST);
  assert.equal(r.output.option, 2);
  assert.equal(r.modelVersion, 'openai-fixture-model-2026-11-01');
  const [call] = calls;
  assert.equal(call.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(call.init.headers.authorization, 'Bearer test-key');
  assert.deepEqual(call.body.messages, [
    { role: 'system', content: 'You are a checker.' },
    { role: 'user', content: 'Which option?' },
  ]);
  assert.deepEqual(call.body.response_format, {
    type: 'json_schema',
    json_schema: { name: 'answer', schema: SCHEMA, strict: true },
  });
});

test('Gemini: asks for JSON matching the schema and parses the first candidate', async () => {
  const { fetch, calls } = recorder(fixture('gemini-generate'));
  const p = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-fixture-model', fetch });
  const r = await p.complete(REQUEST);
  assert.equal(r.output.confidence, 'high');
  assert.equal(r.modelVersion, 'gemini-fixture-model-001');
  const [call] = calls;
  assert.equal(
    call.url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-fixture-model:generateContent',
  );
  assert.equal(call.init.headers['x-goog-api-key'], 'test-key');
  assert.deepEqual(call.body.systemInstruction, { parts: [{ text: 'You are a checker.' }] });
  assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(call.body.generationConfig.responseJsonSchema, SCHEMA);
});

test('a base URL can route calls through an AI gateway', async () => {
  const { fetch, calls } = recorder(fixture('anthropic-tool-use'));
  const p = createAnthropicProvider({
    apiKey: 'k',
    model: 'm',
    fetch,
    baseUrl: 'https://gateway.example/anthropic',
  });
  await p.complete(REQUEST);
  assert.equal(calls[0].url, 'https://gateway.example/anthropic/v1/messages');
});

test('an HTTP error from a provider is reported with its status', async () => {
  const { fetch } = recorder({ error: { message: 'overloaded' } }, 529);
  const p = createAnthropicProvider({ apiKey: 'k', model: 'm', fetch });
  await assert.rejects(p.complete(REQUEST), /anthropic returned HTTP 529/);
});

test('output that does not match the schema is rejected, never used', async () => {
  const body = fixture('openai-chat');
  body.choices[0].message.content = '{"option":"two","confidence":"sure"}';
  const p = createOpenAIProvider({ apiKey: 'k', model: 'm', fetch: recorder(body).fetch });
  await assert.rejects(p.complete(REQUEST), /does not match the answer schema/);
});

test('output that is not JSON is rejected', async () => {
  const body = fixture('gemini-generate');
  body.candidates[0].content.parts[0].text = 'I think it is B';
  const p = createGeminiProvider({ apiKey: 'k', model: 'm', fetch: recorder(body).fetch });
  await assert.rejects(p.complete(REQUEST), /gemini did not return JSON/);
});

test('a refusal or missing tool call is rejected', async () => {
  const body = { ...fixture('anthropic-tool-use'), content: [{ type: 'text', text: 'no' }] };
  const p = createAnthropicProvider({ apiKey: 'k', model: 'm', fetch: recorder(body).fetch });
  await assert.rejects(p.complete(REQUEST), /anthropic did not return JSON/);
});

test('providers are configured from environment variables, and a missing key is an error', () => {
  const env = { OPENAI_API_KEY: 'k', VERIFY_OPENAI_MODEL: 'openai-fixture-model' };
  const p = providerFromEnv('openai', env, async () => {});
  assert.equal(p.provider, 'openai');
  assert.equal(p.model, 'openai-fixture-model');
  assert.throws(() => providerFromEnv('gemini', env), /GEMINI_API_KEY is not set/);
  assert.throws(
    () => providerFromEnv('openai', { OPENAI_API_KEY: 'k' }),
    /VERIFY_OPENAI_MODEL is not set/,
  );
  assert.throws(() => providerFromEnv('mystery', env), /unknown provider mystery/);
});

const GATEWAY = 'https://gateway.ai.cloudflare.com/v1/fixture-account/revisionden/provider';

test('with an AI gateway token, every provider sends it as cf-aig-authorization and asks the gateway not to log payloads', async () => {
  const cases = [
    [createAnthropicProvider, 'anthropic-tool-use'],
    [createOpenAIProvider, 'openai-chat'],
    [createGeminiProvider, 'gemini-generate'],
  ];
  for (const [create, name] of cases) {
    const { fetch, calls } = recorder(fixture(name));
    const p = create({
      apiKey: 'k',
      model: 'm',
      fetch,
      gatewayToken: 'gw-token',
      baseUrl: GATEWAY,
    });
    await p.complete(REQUEST);
    const headers = calls[0].init.headers;
    assert.equal(headers['cf-aig-authorization'], 'Bearer gw-token', name);
    assert.equal(headers['cf-aig-collect-log-payload'], 'false', name);
  }
});

test('without a gateway token, no gateway headers are sent', async () => {
  const { fetch, calls } = recorder(fixture('openai-chat'));
  await createOpenAIProvider({ apiKey: 'k', model: 'm', fetch }).complete(REQUEST);
  assert.equal(calls[0].init.headers['cf-aig-authorization'], undefined);
  assert.equal(calls[0].init.headers['cf-aig-collect-log-payload'], undefined);
});

test('the gateway token is never sent anywhere but the Cloudflare AI Gateway', async () => {
  for (const baseUrl of [
    undefined,
    'https://gateway.example/anthropic',
    'http://gateway.ai.cloudflare.com/v1/x',
  ]) {
    const { fetch, calls } = recorder(fixture('anthropic-tool-use'));
    const p = createAnthropicProvider({
      apiKey: 'k',
      model: 'm',
      fetch,
      gatewayToken: 'gw',
      baseUrl,
    });
    await p.complete(REQUEST);
    assert.equal(calls[0].init.headers['cf-aig-authorization'], undefined, String(baseUrl));
  }
});

test('providerFromEnv passes AI_GATEWAY_TOKEN only to a provider routed through the gateway', async () => {
  const env = { GEMINI_API_KEY: 'k', VERIFY_GEMINI_MODEL: 'm', AI_GATEWAY_TOKEN: 'gw' };
  const direct = recorder(fixture('gemini-generate'));
  await providerFromEnv('gemini', env, direct.fetch).complete(REQUEST);
  assert.equal(direct.calls[0].init.headers['cf-aig-authorization'], undefined);
  const viaGateway = recorder(fixture('gemini-generate'));
  await providerFromEnv('gemini', { ...env, GEMINI_BASE_URL: GATEWAY }, viaGateway.fetch).complete(
    REQUEST,
  );
  assert.equal(viaGateway.calls[0].init.headers['cf-aig-authorization'], 'Bearer gw');
});
