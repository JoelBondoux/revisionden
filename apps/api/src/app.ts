import { Hono } from 'hono';

export interface AppConfig {
  version: string;
}

export function createApp(config: AppConfig) {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok', version: config.version }));
  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  return app;
}
