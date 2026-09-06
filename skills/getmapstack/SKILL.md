---
name: getmapstack
description: Use when a request needs to find places or points of interest near a location from self-hosted map data - "every pharmacy within 2 km", "supermarkets near this address", "what is around these coordinates" - and when what you find should be shown on a map. Covers starting the getmapstack container that answers these queries. Triggers when a getmapstack container is being started or used, on localhost:4326, and on nearby-search requests where no external map API is wanted; not on building, publishing or maintaining the images themselves.
license: MIT
compatibility: Requires Docker, bash, curl and jq
---

# Getmapstack

One Docker image per country, carrying OpenStreetMap routing, geocoding and a vector
map. The container publishes a single port, 4326, and answers under three prefixes:
`/valhalla` routes, `/photon` geocodes, `/martin` serves tiles, styles and rendered
images. Nothing leaves the machine, and there is no API key.

## Start a container

Pick the country that contains the place in question. The README at
https://github.com/roma8ok/getmapstack lists the countries that have an image.

```bash
docker run -d --name getmapstack -p 4326:4326 ghcr.io/roma8ok/getmapstack/cyprus
until curl -sf localhost:4326/healthz | grep -q ok; do sleep 2; done
```

The wait is not optional: the geocoder opens its index at startup, which takes seconds
for a small country and minutes for the largest.

## Finding features near a point

Copy this checklist and tick items off as you go.

```
- [ ] 1. Anchor - the point the search is centred on
- [ ] 2. Tag - an OSM key:value, proposed and then verified
- [ ] 3. Coverage - one call, or the whole area
- [ ] 4. Render
```

**1. Anchor.** Coordinates as given, or a place name resolved through the geocoder:

```bash
curl -s "localhost:4326/photon/api?q=Nicosia&limit=1&lang=en" \
  | jq '.features[0].geometry.coordinates'
```

**2. Tag.** Features are found by their OSM tag, never by putting the kind of thing
you want into a text search. `q=supermarket` matches the word in a name: it returns
shops called "... Supermarket" and misses every chain whose name does not contain the
word. Propose the tag from what you know about OSM tagging, then verify it against
this container before trusting it:

```bash
curl -s "localhost:4326/photon/reverse?lat=35.1856&lon=33.3823&radius=2&limit=50&osm_tag=shop:supermarket&lang=en" \
  | jq '[.features[].properties.name]'
```

**An empty answer means the tag is wrong far more often than it means the area is
empty.** `amenity:kindergarden` returns nothing; `amenity:kindergarten` returns
kindergartens. Correct the tag and verify again before reporting that there is nothing
nearby.

The tag is typed by a contributor, so the answer also carries the occasional feature that
plainly is not the thing asked for. Report those with the rest and say which look
mistagged; never filter the answer by words in a name.

**3. Coverage.** Photon 1.2.1 returns at most 50 features per call whatever `limit`
asks for, on both `/photon/api` and `/photon/reverse`, and nothing in the response says
it truncated. An answer of exactly 50 is a truncated answer, not a count.

Run the bundled script rather than assembling the calls by hand. It queries the radius,
and where the ceiling is hit it re-covers that area with smaller overlapping queries
until the ceiling is clear, then deduplicates and sorts by distance:

```bash
scripts/nearby.sh --lat 35.1856 --lon 33.3823 --radius 2 --tag shop:supermarket > found.json
```

It writes a GeoJSON FeatureCollection to stdout. Paths in this skill are relative to the
skill's own directory, so run the script from there or give its full path. `--help` has
the rest, and its exit code separates a bad argument from a refused request from an
unreachable container.

**4. Render.** See [references/render.md](references/render.md).

## References

- Finding features near a point, in full: [references/nearby.md](references/nearby.md)
- Showing what you found on a map: [references/render.md](references/render.md)

Every other method the container serves - routes, travel-time areas, matrices, static
images, the tile and style endpoints - is documented in that same README:
https://github.com/roma8ok/getmapstack
