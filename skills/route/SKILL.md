---
name: route
description: Use when a request needs a route from self-hosted map data - "how do I get from A to B", "how long is the drive", "visit these places in the best order", "plan a walking tour of what we found nearby" - and when the route should be shown on a map. Takes the stops a nearby search produced. Triggers on route or optimized_route requests to a getmapstack container on localhost:4326; not on travel-time areas, matrices, or building the images.
license: MIT
compatibility: Requires Docker, bash, curl and jq
---

# Route

One Docker image per country, carrying OpenStreetMap routing, geocoding and a vector
map. The container publishes a single port, 4326, and answers under three prefixes:
`/valhalla` routes, `/photon` geocodes, `/martin` serves tiles, styles and rendered
images. Nothing leaves the machine, and there is no API key.

## Start a container

Pick the country that contains every location of the route: an image covers one
country, so a route cannot cross a border. The image is
`ghcr.io/roma8ok/getmapstack/<slug>`, where the slug is the country's English name in
lower case with hyphens (`cyprus`, `south-korea`, `united-kingdom`); the README at
https://github.com/roma8ok/getmapstack lists the countries that have one, and is the
place to look when a pull fails.

```bash
docker run -d --name getmapstack -p 4326:4326 ghcr.io/roma8ok/getmapstack/cyprus
until curl -sf localhost:4326/healthz | grep -q ok; do sleep 2; done
```

The wait is not optional: the geocoder opens its index at startup, which takes seconds
for a small country and minutes for the largest. A container named `getmapstack` that
is already running for another country holds both the name and the port: remove it
first with `docker rm -f getmapstack`.

## Building a route

Copy this checklist and tick items off as you go.

```
- [ ] 1. Points - the start, and either an end with waypoints or a set of stops
- [ ] 2. Mode - named in the request, otherwise ASK
- [ ] 3. Order - fixed, or the best one
- [ ] 4. Run the script
- [ ] 5. Report
- [ ] 6. Render - the map skill
```

**1. Points.** The start is always the user's own point: the anchor of a search, a
hotel, an address. Coordinates as given, or a place name resolved through the geocoder:

```bash
curl -s "localhost:4326/photon/api?q=Nicosia&limit=1&lang=en" \
  | jq -r '.features[0].geometry.coordinates | "\(.[1]),\(.[0])"'
```

The stops are either the file a nearby search wrote (a FeatureCollection of points,
handed over as is) or addresses resolved one by one the same way.

**2. Mode.** `auto`, `bicycle`, `pedestrian`, `truck`, `motorcycle`, `bus`, `taxi` or
`motor_scooter`. When the request names one, or plainly implies one ("walking tour",
"drive"), use it. When it does not, ask - a walking tour and a drive are different
answers, and the cost of asking is one turn. Never pick one silently.

Two of the modes refuse locations the others accept: `truck` and `motor_scooter` answer
"no path" from many historic centres where `auto` routes without complaint. The only
probe that proves a location works for a mode is a route from it, on this container.

**3. Order.** "From X to Y via Z" is a fixed order: `--to` and `--via`. "Visit all of
these" is `--stops`: the engine orders them, and the script chooses the end by trying
every stop as the last one and keeping the fastest tour. `--end` fixes the end when
the user said where to finish; `--by length` prefers the shortest tour over the
fastest. The engine takes at most 50 locations in one optimized route, the start
included; over that the script refuses rather than trims, so narrow the search first.

**4. Run.** Paths are relative to the skill's own directory, so run the script from
there or give its full path.

```bash
scripts/route.sh --from 35.1739,33.3625 --costing pedestrian --stops found.json > route.json
scripts/route.sh --from 35.1856,33.3823 --costing auto --via 34.9229,33.6233 --to 34.6786,33.0413 > route.json
```

It writes a GeoJSON FeatureCollection to stdout: the route as a line, then one point
per location in visiting order. The line is real GeoJSON because the script asks the
engine for its OSRM-compatible answer; in the engine's own format `shape` is always an
encoded polyline at precision 6, whatever `shape_format` says. Its exit code separates
a bad argument (64) from a refused request or too many locations (65) from an
unreachable container (69) from locations the engine cannot reach (75). On 75 the
offending locations are listed on stderr with their index in the input, the engine's
code and their name: remove them, tell the user which were dropped and why, and run
again. The script never drops a location on its own.

**5. Report.** Everything the answer needs is in the properties:

```bash
jq -r '.features[] | select(.properties.kind == "stop") | .properties
       | "\(.order). \(.name)\(if .leg_time_s then " - \(.leg_time_s / 60 | round) min, \(.leg_length_m / 1000 * 10 | round / 10) km" else "" end)"' route.json
jq -r '.features[0].properties | "\(.time_s / 60 | round) min, \(.length_m / 1000 * 10 | round / 10) km by \(.costing)"' route.json
```

Every stop after the start also carries `instructions`, the turn-by-turn text for
reaching it, and `snapped_m`, how far the engine moved the point to reach a road. Name
any stop snapped more than a couple of hundred metres: it is a sign the point is a
large site's centroid, or an island, and the road is elsewhere. Say that the times carry
no traffic - the image has none - and repeat anything that was assumed.

**6. Render.** Hand `route.json` to the `map` skill. The line, the numbered stops and
the popups are already in the file's properties.

## References

- Building a route, in full: [references/route.md](references/route.md)
- Showing the route on a map: the `map` skill
- Finding the stops in the first place: the `nearby` skill
