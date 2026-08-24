# isochrone-wave

How far can 15 minutes take you? The page opens on a recorded wave for one of seven
cities - a car, a bicycle, your own two feet racing across the map together.
Connect a getmapstack image running on your machine and click a point of your own
to watch it race for real. Fifteen one-minute contours per mode, prefetched in
twelve requests, animated from memory.

## Running it

Node 22.4 or newer (the test scripts pass a flag that older versions reject).

```bash
npm install
npm run dev            # http://localhost:5173
```

The page opens on a recorded wave for one of seven cities, with basemap tiles from
OpenFreeMap. No container is needed to look at it.

To drive your own points, run a country image and press "I started it - connect":

```bash
docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/cyprus
```

## Re-recording a city

Start that city's country image, then:

```bash
npm run record -- --city amsterdam
```

The recorder checks the container serves the right country, reads the snapshot date from
the routing engine, and writes `public/recorded/<city>.json`. Cities live in
`src/data/cities.json`; the recorder only accepts a slug listed there.

`public/og.png` is the card link previews show. It is a 1200x630 shot of this page
playing the Seoul recording at 15:00, taken by hand - re-take it when the page's
furniture changes.

## What it asks the engine

| Step | Request |
|---|---|
| Is anything there | `GET /healthz` - 503 means the container is up and its engines are not yet |
| Which country it is | `GET /countries.json` (the image's own list, shown as the badge) |
| Where the country is | `GET /martin/basemap` (TileJSON bounds) |
| Tiles, glyphs, sprite | fetched by MapLibre from `/martin/...` on the container, as the style directs |
| The waves | 12 x `POST /valhalla/isochrone` - per costing (auto, bicycle, pedestrian), 15 one-minute contours in chunks of 4, `polygons: true` |

The basemap style itself is not fetched from the container: the OpenFreeMap
Dark style is vendored in `src/styles/dark.json`, copied verbatim from
[openfreemap-styles](https://github.com/hyperknot/openfreemap-styles) at the
same commit the server image pins, and adapted on the client the same way the
image adapts Bright (container source, glyphs, the bright sprite, the
composite-fontstack prepend, no uppercase transform). The wave draws in its
dark-tuned colors on top.

Neither binding writes its own attribution: both tile servers state theirs in their
TileJSON, and MapLibre renders that in the disc at the bottom right. A source that
spells one out replaces the served one rather than adding to it, which is how the
required "(c) OpenMapTiles" credit would go missing.

## Tests

```bash
npm test
```

Everything decidable without a GPU is unit-tested (vitest); the map itself is
verified by eye against a running image.

The test scripts set NODE_OPTIONS=--no-experimental-webstorage inline (Node 26's global localStorage shadows jsdom's); on native Windows run them through WSL or set the variable manually.
