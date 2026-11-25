import { describe, expect, it } from 'vitest';
import { createWorker } from './worker';

const fullEnv = {
  ENVIRONMENT: 'development',
  DATABASE_URL: 'postgres://user:pass@db.example.com/revisionden',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  API_ORIGIN: 'https://api-dev.revisionden.test',
  WEB_ORIGIN: 'https://dev.revisionden.test',
  GOOGLE_CLIENT_ID: 'g',
  GOOGLE_CLIENT_SECRET: 'g',
  MICROSOFT_CLIENT_ID: 'm',
  MICROSOFT_CLIENT_SECRET: 'm',
  AI_GATEWAY_URL: 'https://gateway.example.com/v1/x',
  UPLOADS: {},
};

const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined } as never;

describe('worker entry', () => {
  it('fails fast with a JSON 500 when bindings are missing', async () => {
    const worker = createWorker('00.01.000');
    const res = await worker.fetch(new Request('https://api.test/v1/me'), {}, ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      error: { code: 'server_misconfigured', ref: expect.stringMatching(/^RD-[0-9A-Z]{6}$/) },
    });
  });

  it('still answers health with the version when the environment is incomplete', async () => {
    const worker = createWorker('00.01.000');
    const res = await worker.fetch(new Request('https://api.test/health'), {}, ctx);
    expect(res.status).toBe(503);
    // Names nothing secret: the missing keys are only written to the Worker log.
    expect(await res.json()).toEqual({ status: 'misconfigured', version: '00.01.000' });
  });

  it('reports ok with only Google sign-in set up', async () => {
    const worker = createWorker('00.01.000');
    const env = {
      ENVIRONMENT: 'development',
      DATABASE_URL: 'postgres://user:pass@db.example.com/revisionden',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      API_ORIGIN: 'https://api-dev.revisionden.test',
      WEB_ORIGIN: 'https://dev.revisionden.test',
      GOOGLE_CLIENT_ID: 'g',
      GOOGLE_CLIENT_SECRET: 'g',
      AI_GATEWAY_URL: 'https://gateway.example.com/v1/x',
      UPLOADS: {},
    };
    const res = await worker.fetch(new Request('https://api.test/health'), env, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', version: '00.01.000' });
    const providers = await worker.fetch(
      new Request('https://api.test/v1/auth/providers'),
      env,
      ctx,
    );
    expect(await providers.json()).toEqual({ providers: ['google'] });
  });

  it('serves health once the environment is complete', async () => {
    const worker = createWorker('00.01.000');
    const env = {
      ENVIRONMENT: 'development',
      DATABASE_URL: 'postgres://user:pass@db.example.com/revisionden',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      API_ORIGIN: 'https://api-dev.revisionden.test',
      WEB_ORIGIN: 'https://dev.revisionden.test',
      GOOGLE_CLIENT_ID: 'g',
      GOOGLE_CLIENT_SECRET: 'g',
      MICROSOFT_CLIENT_ID: 'm',
      MICROSOFT_CLIENT_SECRET: 'm',
      AI_GATEWAY_URL: 'https://gateway.example.com/v1/x',
      UPLOADS: {},
    };
    const res = await worker.fetch(new Request('https://api.test/health'), env, ctx);
    expect(await res.json()).toEqual({ status: 'ok', version: '00.01.000' });
    // Same env object: the app is reused rather than rebuilt.
    const again = await worker.fetch(new Request('https://api.test/health'), env, ctx);
    expect(again.status).toBe(200);
  });

  describe('cron trigger', () => {
    const controller = { scheduledTime: Date.parse('2026-11-24T19:00:00Z'), cron: '*/15 * * * *' };

    function recordingRunner() {
      const calls: { now: Date }[] = [];
      return {
        calls,
        run: async (deps: { now: Date }) => {
          calls.push({ now: deps.now });
          return { students: 0, reminders: 0, pushes: 0, removed: 0 };
        },
      };
    }

    it('sends no reminders while web push is not configured', async () => {
      const runner = recordingRunner();
      const worker = createWorker('00.01.000', {
        runReminders: runner.run,
        cleanUp: async () => ({ feedbackDeleted: 0 }),
      });
      await worker.scheduled(controller as never, fullEnv);
      expect(runner.calls).toHaveLength(0);
    });

    it('deletes expired data on every run, even without web push', async () => {
      const cleaned: Date[] = [];
      const worker = createWorker('00.01.000', {
        runReminders: recordingRunner().run,
        cleanUp: async ({ now }) => {
          cleaned.push(now);
          return { feedbackDeleted: 0 };
        },
      });
      await worker.scheduled(controller as never, fullEnv);
      expect(cleaned).toEqual([new Date('2026-11-24T19:00:00Z')]);
    });

    it('sends reminders at the scheduled time once VAPID keys are set', async () => {
      const runner = recordingRunner();
      const worker = createWorker('00.01.000', {
        runReminders: runner.run,
        runParentRewardNotifications: async () => ({ rewards: 0, pushes: 0, removed: 0 }),
        runFamilyEventNotifications: async () => ({ events: 0, pushes: 0, removed: 0 }),
        cleanUp: async () => ({ feedbackDeleted: 0 }),
      });
      await worker.scheduled(controller as never, {
        ...fullEnv,
        VAPID_PUBLIC_KEY: 'BPUB',
        VAPID_PRIVATE_KEY: 'priv',
      });
      expect(runner.calls).toEqual([{ now: new Date('2026-11-24T19:00:00Z') }]);
    });

    it('tells parents about met reward targets in the same run, once VAPID keys are set', async () => {
      const parentRuns: Date[] = [];
      const options = {
        runReminders: recordingRunner().run,
        runParentRewardNotifications: async ({ now }: { now: Date }) => {
          parentRuns.push(now);
          return { rewards: 0, pushes: 0, removed: 0 };
        },
        runFamilyEventNotifications: async () => ({ events: 0, pushes: 0, removed: 0 }),
        cleanUp: async () => ({ feedbackDeleted: 0 }),
      };
      await createWorker('00.01.000', options).scheduled(controller as never, fullEnv);
      expect(parentRuns).toHaveLength(0);
      await createWorker('00.01.000', options).scheduled(controller as never, {
        ...fullEnv,
        VAPID_PUBLIC_KEY: 'BPUB',
        VAPID_PRIVATE_KEY: 'priv',
      });
      expect(parentRuns).toEqual([new Date('2026-11-24T19:00:00Z')]);
    });

    it('tells a parent about the other parent’s important changes, once VAPID keys are set', async () => {
      const runs: Date[] = [];
      const options = {
        runReminders: recordingRunner().run,
        runParentRewardNotifications: async () => ({ rewards: 0, pushes: 0, removed: 0 }),
        runFamilyEventNotifications: async ({ now }: { now: Date }) => {
          runs.push(now);
          return { events: 0, pushes: 0, removed: 0 };
        },
        cleanUp: async () => ({ feedbackDeleted: 0 }),
      };
      await createWorker('00.01.000', options).scheduled(controller as never, fullEnv);
      expect(runs).toHaveLength(0);
      await createWorker('00.01.000', options).scheduled(controller as never, {
        ...fullEnv,
        VAPID_PUBLIC_KEY: 'BPUB',
        VAPID_PRIVATE_KEY: 'priv',
      });
      expect(runs).toEqual([new Date('2026-11-24T19:00:00Z')]);
    });

    it('logs instead of throwing when the environment is incomplete', async () => {
      const runner = recordingRunner();
      const worker = createWorker('00.01.000', { runReminders: runner.run });
      await expect(worker.scheduled(controller as never, {})).resolves.toBeUndefined();
      expect(runner.calls).toHaveLength(0);
    });
  });
});
