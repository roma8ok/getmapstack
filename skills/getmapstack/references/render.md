# Showing what you found on a map

Two ways out: a page someone can pan and click, and a picture that goes into a report.

## Contents

- An interactive page
- The same page outside the container
- A static image
- Attribution

## An interactive page

Put the page and its data inside the container that is already running. It is served
immediately, from the same origin as the style, the tiles and the geocoder, so there is
no second server to start and nothing cross-origin to arrange:

```bash
cp assets/map.html page.html
docker cp page.html getmapstack:/data/explorer/page.html
docker cp found.json getmapstack:/data/explorer/found.json
```

Then open `http://localhost:4326/page.html`.

The template loads MapLibre GL JS from `/vendor/maplibre-gl.js`, which the image ships
for its own explorer, so the page needs no internet and its renderer is the version the
image was built with.

Three things in the template are load-bearing:

- `import * as maplibregl` - MapLibre GL JS 6 has no default export, and a default
  import fails outright with `does not provide an export named 'default'`.
- The style is `/martin/style/bright`, relative to the page's own origin.
- The view comes from `fitBounds` over the features. A zoom chosen in advance puts part
  of the answer outside the frame, which reads as a smaller answer.

## The same page outside the container

When the page has to live somewhere else - in a project's own repository, served by its
own application - serve it from there and import MapLibre from a CDN instead:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@6.1.0/dist/maplibre-gl.css">
<script type="module">
import * as maplibregl from "https://cdn.jsdelivr.net/npm/maplibre-gl@6.1.0/+esm";
</script>
```

The one edit the page needs is an absolute `style:`
(`http://localhost:4326/martin/style/bright`). Nothing else has to change: the style the
container serves already carries absolute addresses for its tiles, glyphs and sprite.
Cross-origin fetches work: the container answers every request with
`Access-Control-Allow-Origin: *`. This path needs the internet, which the first one does
not.

## A static image

For a picture rather than a browser, post the same FeatureCollection and get a PNG:

```bash
curl -s -X POST \
  "localhost:4326/martin/style/bright/static/33.3823,35.1856,13/800x600.png" \
  -H "Content-Type: application/json" --data-binary @found.json \
  -o map.png
```

The centre and zoom sit in the path, so compute them from the extent of the features
before building the URL. A plausible-looking zoom leaves part of the answer outside the
frame.

Feature properties control how each feature renders: `circle-radius`, `circle-color`,
`circle-stroke-width`, `circle-stroke-color` for points.

## Attribution

A page built on the shipped style displays the OpenMapTiles and OpenStreetMap credit by
itself. A static image comes back as bare pixels, so whatever carries it has to carry
the credit: `(c) OpenMapTiles (c) OpenStreetMap contributors`.
