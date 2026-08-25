import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

// mapWorker.ts hands MapLibre its worker through `?url`, which copies the file
// verbatim - so every sibling chunk the worker imports has to be emitted beside
// it by the maplibre-worker-chunk plugin in vite.config.ts. The plugin knows
// about exactly one. A MapLibre upgrade that splits the worker further would
// ship a site whose map silently decodes nothing; this is the cheap warning.
//
// Static imports only, which is the whole of what a build can emit. The worker
// also carries one `import(e)` over a URL it is handed at runtime - that is how
// it loads worker plugins registered by the page, and no file sits next to it.
describe('the MapLibre worker bundle', () => {
  const require = createRequire(import.meta.url);
  const worker = readFileSync(require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs'), 'utf8');

  test('imports one sibling chunk, the one the build emits', () => {
    const siblings = [...worker.matchAll(/from\s*["'](\.\/[^"']+)["']/g)].map((m) => m[1]);
    expect([...new Set(siblings)]).toEqual(['./maplibre-gl-shared.mjs']);
  });

  test('that chunk is where the plugin reads it from', () => {
    expect(() => require.resolve('maplibre-gl/dist/maplibre-gl-shared.mjs')).not.toThrow();
  });
});
