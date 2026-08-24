// MapLibre resolves its worker relative to its own module URL; any bundler
// moves the entry and the worker 404s WITHOUT an error - the map paints its
// background and never decodes a tile. Hand it the address explicitly.
//
// maplibre-gl 6.5.0 ships ESM-only, with no default export (the UMD bundle is
// gone): setWorkerUrl is a named export, not a method on a default import.
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(workerUrl);
