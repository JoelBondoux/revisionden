/**
 * Loads content/ into a database: `DATABASE_URL=... pnpm --filter @revisionden/api content:sync`.
 * Drafts are loaded with their status; the API only serves them with SERVE_DRAFT_CONTENT=true
 * in development.
 */
import { fileURLToPath } from 'node:url';
import { createNeonDatabase } from '@revisionden/db';
import { readContentDir } from './content-files';
import { syncContent } from './content-sync';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL');
const dir = fileURLToPath(new URL('../../../../content', import.meta.url));
const result = await syncContent(createNeonDatabase(url), await readContentDir(dir));
console.log(`Synced ${result.topics} topics and ${result.items} items`);
