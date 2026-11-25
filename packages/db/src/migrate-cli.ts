// Applies the migrations in ./migrations over HTTPS (deploy workflows, workstream G):
// DATABASE_URL=... pnpm --filter @revisionden/db db:migrate:deploy
// Uses Neon's HTTP driver, so no Postgres port or WebSocket is needed. Prints no secrets.
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const sql = neon(url);
await migrate(drizzle(sql), {
  migrationsFolder: new URL('../migrations', import.meta.url).pathname,
});
const [row] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
console.log(`Migrations applied: ${(row as { n: number }).n} in total.`);
