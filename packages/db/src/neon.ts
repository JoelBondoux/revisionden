import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { Database } from './client';
import * as schema from './schema';

/** Drizzle over Neon's HTTP driver: works in Cloudflare Workers without a TCP socket. */
export function createNeonDatabase(databaseUrl: string): Database {
  return drizzle(neon(databaseUrl), { schema }) as unknown as Database;
}
