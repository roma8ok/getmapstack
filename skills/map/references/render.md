# Showing GeoJSON on a map

Two ways out: a page someone can pan and click, and a picture that goes into a report.

## Contents

- An interactive page
- What the page reads from a feature
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
docker cp route.json getmapstack:/data/explorer/data.json
```

Then open `http://localhost:4326/page.html`. The page reads `./data.json`, so whatever
file is being shown is copied into the container under that name.

The template loads MapLibre GL JS from `/vendor/maplibre-gl.js`, which the image ships
for its own explorer, so the page needs no internet and its renderer is the version the
image was built with.

Four things in the template are load-bearing:

- `import * as maplibregl` - MapLibre GL JS 6 has no default export, and a default
  import fails outright with `does not provide an export named 'default'`.
- The style is `/martin/style/bright`, relative to the page's own origin.
- The view comes from `fitBounds` over every coordinate of every feature. A zoom chosen
  in advance puts part of the answer outside the frame, which reads as a smaller
  answer. The fit is animated: a screenshot taken the moment the page loads catches the
  fly-in, so wait for the map to settle first.
- The label font stack is the one the shipped style uses for its own regular labels.
  A font name the container does not know renders nothing.

## What the page reads from a feature

Every geometry type has a layer: points as circles, lines as lines, polygons as a
translucent fill with an outline. Five properties change how a feature is shown; every
other property is ignored:

| Property | Effect |
|---|---|
| `label` | Text over a point. A point with a label is rendered larger to hold it. |
| `color` | Colour of the circle, line or fill, as a hex string with the `#`. |
| `name` | A white tag beside the point from zoom 13 in, on whichever side is free, and the first line of the popup that opens when the point is clicked. Crowded names are hidden by the map, the number never is. |
| `leg_time_s`, `leg_length_m` | Second line of that popup, as minutes and kilometres. |

A file with none of these still renders: red points, blue lines and fills. A script that
writes GeoJSON for this page needs only to set the properties it wants read.

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

For a picture rather than a browser, post a FeatureCollection of points and get a PNG:

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
