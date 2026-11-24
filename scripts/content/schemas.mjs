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
};

export function createValidators(schemaDir = SCHEMA_DIR) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictTypes: false,
    strictRequired: false,
  });
  return Object.fromEntries(
    Object.entries(FILES).map(([kind, file]) => [
      kind,
      ajv.compile(JSON.parse(readFileSync(join(schemaDir, file), 'utf8'))),
    ]),
  );
}
