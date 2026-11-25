// After a deploy: checks the API's /health answers with the version just deployed (workstream G).
// node scripts/check-deploy.mjs --url https://api-dev.revisionden.com --environment dev
// Retries for up to two minutes while the new version rolls out. Prints no secrets.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

/**
 * Decides whether a /health answer is good enough for this environment. Dev and staging may
 * still be missing sign-in secrets (the API then says "misconfigured"); production may not.
 */
export function judgeHealth({ httpStatus, body }, { version, environment }) {
  if (!body || typeof body.version !== 'string' || typeof body.status !== 'string') {
    return { pass: false, message: `Health check answered ${httpStatus} without a version` };
  }
  if (body.version !== version) {
    return { pass: false, message: `API is on ${body.version}, expected ${version}` };
  }
  if (body.status === 'ok') return { pass: true, message: `API is healthy on ${version}` };
  if (body.status === 'misconfigured' && environment !== 'production') {
    return {
      pass: true,
      message: `API is on ${version}; some secrets still missing (see the Worker log)`,
    };
  }
  return {
    pass: false,
    message: `API is on ${version} but reports ${body.status}: missing secrets?`,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      environment: { type: 'string' },
      tries: { type: 'string' },
    },
  });
  const version = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
  const tries = Number(values.tries ?? 12);
  let result = { pass: false, message: 'not checked' };
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${values.url}/health`, { headers: { accept: 'application/json' } });
      const body = await res.json().catch(() => undefined);
      result = judgeHealth(
        { httpStatus: res.status, body },
        { version, environment: values.environment },
      );
      if (result.pass) break;
    } catch (err) {
      result = { pass: false, message: `Health check failed: ${err.message}` };
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log(result.message);
  if (!result.pass) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
