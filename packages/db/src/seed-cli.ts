// Seeds a development database: DATABASE_URL=... pnpm --filter @revisionden/db db:seed
import { createNeonDatabase } from './neon';
import { seed } from './seed';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const result = await seed(createNeonDatabase(url));
console.log(`Seeded family ${result.familyId} with ${result.students.length} students.`);
