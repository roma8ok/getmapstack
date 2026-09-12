---
name: map
description: Use when GeoJSON - features a search found, a route, any FeatureCollection - should be shown on a map served by a getmapstack container on localhost:4326 - "show these on a map", "draw this GeoJSON", "put the route on a map". Not for finding the features or computing the route; those are their own skills.
license: MIT
compatibility: Requires Docker, bash, curl and jq
---

# Map

The container already serves a vector map, its style and a renderer on port 4326. A
page that shows your GeoJSON on it is one template and two copies away, and it needs no
internet and no second server.

## Show a file

```bash
cp assets/map.html page.html
docker cp page.html getmapstack:/data/explorer/page.html
docker cp found.json getmapstack:/data/explorer/data.json
```

Open `http://localhost:4326/page.html` and say so in the answer: a file written to disk
that nobody can open is not a map.

The page reads `./data.json`, whatever the file was called before the copy. Paths in
this skill are relative to the skill's own directory.

## What the page renders

Points as circles, lines as lines, polygons as a translucent fill, and the view fitted
to everything in the file. Five properties on a feature change how it is shown, and
every other property is ignored:

- `label` - text over a point (a stop number, a rank)
- `color` - the circle, line or fill colour, a hex string with the `#`
- `name` - a tag beside the point from zoom 13, and the popup that opens on click
- `leg_time_s`, `leg_length_m` - a second popup line, as minutes and kilometres

A file with none of these still renders. Do not edit the template to change colours or
labels: set the properties in the data instead, and the same page keeps working for the
next file.

## References

- The page in full, the same page outside the container, a static image, attribution:
  [references/render.md](references/render.md)
