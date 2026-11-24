// Model providers for the verification pipeline (blind answer, adversarial review, marking).
// Each provider has the same shape:
//   { provider, model, complete({ system, prompt, schema, schemaName }) => { output, modelVersion } }
// Output is always structured JSON, validated against the schema before it is used.
// Tests use recorded fixtures (fixtures/providers/); real models are never called in tests or CI.
import Ajv from 'ajv';

const ajv = new Ajv({ strict: false, allErrors: true });

function checked(provider, schemaName, schema, output) {
  const validate = ajv.compile(schema);
  if (!validate(output)) {
    throw new Error(
      `${provider} output does not match the ${schemaName} schema: ${ajv.errorsText(validate.errors)}`,
    );
  }
  return output;
}

function parseJson(provider, text) {
  try {
    if (typeof text !== 'string') throw new Error('no text');
    return JSON.parse(text);
  } catch {
    throw new Error(`${provider} did not return JSON`);
  }
}

async function post(provider, fetch, url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${provider} returned HTTP ${res.status}`);
  return res.json();
}

const trim = (url) => url.replace(/\/+$/, '');

export function createAnthropicProvider({
  apiKey,
  model,
  fetch = globalThis.fetch,
  baseUrl = 'https://api.anthropic.com',
  maxTokens = 2048,
}) {
  return {
    provider: 'anthropic',
    model,
    async complete({ system, prompt, schema, schemaName }) {
      const body = await post(
        'anthropic',
        fetch,
        `${trim(baseUrl)}/v1/messages`,
        { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        {
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: prompt }],
          tools: [{ name: schemaName, description: 'Record the result.', input_schema: schema }],
          tool_choice: { type: 'tool', name: schemaName },
        },
      );
      const call = body.content?.find((b) => b.type === 'tool_use' && b.name === schemaName);
      if (!call) throw new Error('anthropic did not return JSON');
      return {
        output: checked('anthropic', schemaName, schema, call.input),
        modelVersion: body.model ?? model,
      };
    },
  };
}

export function createOpenAIProvider({
  apiKey,
  model,
  fetch = globalThis.fetch,
  baseUrl = 'https://api.openai.com',
}) {
  return {
    provider: 'openai',
    model,
    async complete({ system, prompt, schema, schemaName }) {
      const body = await post(
        'openai',
        fetch,
        `${trim(baseUrl)}/v1/chat/completions`,
        { authorization: `Bearer ${apiKey}` },
        {
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: schemaName, schema, strict: true },
          },
        },
      );
      const output = parseJson('openai', body.choices?.[0]?.message?.content);
      return {
        output: checked('openai', schemaName, schema, output),
        modelVersion: body.model ?? model,
      };
    },
  };
}

export function createGeminiProvider({
  apiKey,
  model,
  fetch = globalThis.fetch,
  baseUrl = 'https://generativelanguage.googleapis.com',
}) {
  return {
    provider: 'gemini',
    model,
    async complete({ system, prompt, schema, schemaName }) {
      const url = `${trim(baseUrl)}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const body = await post(
        'gemini',
        fetch,
        url,
        { 'x-goog-api-key': apiKey },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
        },
      );
      const output = parseJson('gemini', body.candidates?.[0]?.content?.parts?.[0]?.text);
      return {
        output: checked('gemini', schemaName, schema, output),
        modelVersion: body.modelVersion ?? model,
      };
    },
  };
}

const FACTORIES = {
  anthropic: {
    create: createAnthropicProvider,
    key: 'ANTHROPIC_API_KEY',
    model: 'VERIFY_ANTHROPIC_MODEL',
    base: 'ANTHROPIC_BASE_URL',
  },
  openai: {
    create: createOpenAIProvider,
    key: 'OPENAI_API_KEY',
    model: 'VERIFY_OPENAI_MODEL',
    base: 'OPENAI_BASE_URL',
  },
  gemini: {
    create: createGeminiProvider,
    key: 'GEMINI_API_KEY',
    model: 'VERIFY_GEMINI_MODEL',
    base: 'GEMINI_BASE_URL',
  },
};

/** A provider configured from environment variables (keys live in .dev.vars, never in git). */
export function providerFromEnv(name, env = process.env, fetch = globalThis.fetch) {
  const f = FACTORIES[name];
  if (!f) throw new Error(`unknown provider ${name}; use ${Object.keys(FACTORIES).join(', ')}`);
  if (!env[f.key]) throw new Error(`${f.key} is not set`);
  if (!env[f.model]) throw new Error(`${f.model} is not set (the model id to use)`);
  return f.create({
    apiKey: env[f.key],
    model: env[f.model],
    fetch,
    ...(env[f.base] ? { baseUrl: env[f.base] } : {}),
  });
}
