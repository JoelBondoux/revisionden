// Loads the JSON Schemas in content/schemas/ and compiles one Ajv validator per kind.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

export const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../content/schemas');

const FILES = {
  subject: 'subject.schema.json',
  topicTree: 'topic-tree.schema.json',
  item: 'item.schema.json',
  markScheme: 'mark-scheme.schema.json',
  diagram: 'diagram.schema.json',
};
const SHARED = ['common.schema.json'];

const read = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

export function createValidators(schemaDir = SCHEMA_DIR) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictTypes: false,
    strictRequired: false,
  });
  for (const file of SHARED) ajv.addSchema(read(schemaDir, file));
  return Object.fromEntries(
    Object.entries(FILES).map(([kind, file]) => [kind, ajv.compile(read(schemaDir, file))]),
  );
}
