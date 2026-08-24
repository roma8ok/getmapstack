#!/usr/bin/env node
// Records one city's wave from a RUNNING container of that city's country:
//   npm run record -- --city amsterdam [--base http://localhost:4326]
// Start the container yourself first:
//   docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/netherlands
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COSTINGS, CHUNKS, assertCountry, buildFixture, collectGeometries, isoDate } from './record-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cities = JSON.parse(readFileSync(resolve(here, '../src/data/cities.json'), 'utf8'));

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const slug = arg('city');
const base = (arg('base') ?? 'http://localhost:4326').replace(/\/+$/, '');
const city = cities.find((c) => c.slug === slug);
if (!city) {
  console.error(`record: --city is required, one of: ${cities.map((c) => c.slug).join(', ')}`);
  process.exit(1);
}

const getJson = async (path, init) => {
  const r = await fetch(`${base}${path}`, init);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
};

assertCountry(await getJson('/countries.json'), city.country);
const status = await getJson('/valhalla/status');
const meta = { snapshot: isoDate(status.tileset_last_modified), valhalla: status.version };

const modes = {};
for (const [mode, costing] of Object.entries(COSTINGS)) {
  const responses = [];
  for (const chunk of CHUNKS)
    responses.push(
      await getJson('/valhalla/isochrone', {
        method: 'POST',
        body: JSON.stringify({
          locations: [{ lat: city.origin.lat, lon: city.origin.lon }],
          costing,
          contours: chunk.map((time) => ({ time })),
          polygons: true,
        }),
      }),
    );
  modes[mode] = collectGeometries(responses);
  const empty = modes[mode].filter((g) => !g.coordinates?.length).length;
  if (empty) throw new Error(`${mode}: ${empty} empty contours - pick another origin for ${city.name}`);
  console.log(`  ${mode}: 15 contours`);
}

const out = resolve(here, '../public/recorded', `${city.slug}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(buildFixture(city, meta, modes)) + '\n');
const kb = Math.round(readFileSync(out).length / 1024);
console.log(`record: wrote ${out} (${kb} KB raw, snapshot ${meta.snapshot}, valhalla ${meta.valhalla})`);
