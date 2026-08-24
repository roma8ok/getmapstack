#!/usr/bin/env node
// Regenerates src/data/countries.json from the explorer's country list, which is
// the same set the build and the integration tests use. Run it after a country
// is added to the catalog: npm run sync-countries
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../../build/server/explorer/countries.js');
const target = resolve(here, '../src/data/countries.json');

const src = readFileSync(source, 'utf8');
const entries = [...src.matchAll(/\{\s*name:\s*"([^"]+)",\s*slug:\s*"([^"]+)"/g)].map(
  ([, name, slug]) => ({ name, slug }),
);
if (entries.length < 100) {
  console.error(`sync-countries: parsed only ${entries.length} countries - the source layout changed`);
  process.exit(1);
}
entries.sort((a, b) => a.slug.localeCompare(b.slug));
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(entries, null, 2) + '\n');
console.log(`sync-countries: wrote ${entries.length} countries`);
