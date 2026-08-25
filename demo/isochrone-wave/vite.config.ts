import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// maplibre-gl-worker.mjs arrives here through `?url`, which copies the file
// verbatim - including its one import, the literal `./maplibre-gl-shared.mjs`.
// Nothing else in the graph reaches that chunk, so the build never emits it and
// the worker 404s next to the copy of itself. A worker that cannot load is the
// silent failure the worker URL exists to prevent: the map paints its
// background, decodes no tile and parses no GeoJSON, without one console error.
// The dev server hides it, serving both files straight out of node_modules.
//
// So emit the shared chunk beside whatever name the worker was given.
function maplibreWorkerChunk(): Plugin {
  const WORKER = /maplibre-gl-worker.*\.mjs$/;
  return {
    name: 'maplibre-worker-chunk',
    apply: 'build',
    generateBundle(_options, bundle) {
      const worker = Object.keys(bundle).find((f) => WORKER.test(f));
      if (!worker) {
        this.error('maplibre-gl-worker.mjs is not in the bundle - did the ?url import move?');
        return;
      }
      const dir = worker.includes('/') ? `${worker.slice(0, worker.lastIndexOf('/'))}/` : '';
      const require = createRequire(import.meta.url);
      this.emitFile({
        type: 'asset',
        fileName: `${dir}maplibre-gl-shared.mjs`,
        source: readFileSync(require.resolve('maplibre-gl/dist/maplibre-gl-shared.mjs')),
      });
    },
  };
}

// On Pages the demo answers where its source lives, under
// /getmapstack/demo/isochrone-wave/; the root of the site redirects there. The
// dev server stays at /, where a base path would only make local URLs longer.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/getmapstack/demo/isochrone-wave/' : '/',
  plugins: [react(), maplibreWorkerChunk()],
  test: { environment: 'jsdom' },
}));
