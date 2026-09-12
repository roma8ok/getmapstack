# Building a route

The six steps of the loop in SKILL.md, in full.

## Contents

- The three shapes of a request
- Why the end is swept
- The OSRM-compatible answer
- Limits
- When the script stops without an answer
- Modes
- Departure and arrival times
- What the answer cannot promise

## The three shapes of a request

Every request starts at the user's own point and is one of:

- **From A to B, perhaps via C.** The order is the request's. One `/route` call.
- **Through a set of stops, in the best order.** The engine orders the stops between a
  fixed first and a fixed last location. One `/optimized_route` call per candidate end.
- **Through a set of stops, finishing at a named place.** One `/optimized_route` call.

The raw calls, for a reader without the script:

```bash
curl -s localhost:4326/valhalla/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.9229,"lon":33.6233},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto","format":"osrm","shape_format":"geojson"}'

curl -s localhost:4326/valhalla/optimized_route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.7754,"lon":32.4245},{"lat":34.9229,"lon":33.6233},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto","format":"osrm","shape_format":"geojson"}'
```

## Why the end is swept

`optimized_route` keeps the first and the last location where they are and reorders
only what lies between. A tour has a natural start - where the user is - but no natural
end, and the end the request happens to list last is a choice nobody made. The script
therefore tries every stop as the last location, one call each, and keeps the tour with
the least time (or the least distance, with `--by length`). On a handful of stops the
difference between the best and the worst end is a large fraction of the whole tour.

The calls run four at a time. A tour of a dozen stops is over in seconds; the widest
sweep the ceiling allows, 49 stops by car, takes about a minute.

## The OSRM-compatible answer

The script asks for `"format":"osrm"` on every call, for one reason: it is the only
answer format in which `shape_format` does anything. In the engine's own JSON format
the shape is always an encoded polyline at precision 6 - `"shape_format":"geojson"`,
`"polyline5"` and even `"no_shape"` change nothing - and decoders default to precision 5,
which lands the route roughly ten times away from where it belongs. With `format: osrm`
and `shape_format: geojson`, `routes[0].geometry` is a GeoJSON `LineString`.

The same answer carries everything else the script reads:

- `waypoints[i].waypoint_index` - the position in the trip of the i-th location as
  sent. `optimized_route` sets it; `/route` leaves it null, and the order is then the
  order sent. (The engine's own JSON format says the same thing the other way round, as
  `original_index` on each location in trip order.)
- `waypoints[i].distance` - how far the location was moved to reach a road, in metres.
- `routes[0].legs[j].duration` and `.distance` - seconds and metres from location j to
  location j+1 in trip order.
- `routes[0].legs[j].steps[].maneuver.instruction` - the turn-by-turn text, in the
  language of `language`.

## Limits

| What | Limit | Where it comes from |
|---|---|---|
| Locations in `optimized_route`, including the start | 50, every mode | The matrix behind it: n^2 location pairs must stay under 2500. The profile's own `max_locations` (20 for `auto`) does not apply here. |
| Locations in a single route (`--to` with `--via`), including the start and the end | 20 on `auto`, `taxi` and `truck`; 50 on the others | The profile's own `max_locations`. Past it the engine answers `InvalidValue` (OSRM) / `error_code` 150 `Exceeded max locations` (JSON), and the script exits 65 quoting it. |
| Distance from a location to the nearest road | 1000 m, set by the script | `search_cutoff` on every location. Without it the engine snaps to any road within 35 km and says nothing. |
| A single route | 5000 km by car, 250 km on foot, 500 km by bicycle | `service_limits` in the image's configuration. |

Over 50 locations the script refuses and says so; it never trims. Narrow the search, or
split the stops into two tours.

## When the script stops without an answer

Four distinct exits, and the difference tells you where to look:

- **64** - an argument is wrong: a location that is not `LAT,LON`, an unknown mode, a
  flag from the other form of the request. The message names the argument at fault.
- **65** - the input is not a FeatureCollection of points, or holds no features, or
  makes more than 50 locations; or the engine refused the request with a code the
  script cannot diagnose. The message says which.
- **69** - the container could not be reached at all. The message gives the health check
  to run.
- **75** - the engine refused the set, and the script found which locations it cannot
  reach from the start. They are listed on stderr, one per line: the index in the
  input (`-` for a location given on the command line: the end, or a waypoint), the
  engine's code (`NoSegment` - no road within the cutoff; `NoRoute` - a road, but not
  connected to the start's), and the name. Remove them and run again; which to lose is
  the user's decision, so the script does not decide it.

The engine's own JSON format reports the same two failures as `error_code` 171
("No suitable edges near location") and 442 ("No path could be found for input"),
without naming the location either.

## Modes

`auto`, `bicycle`, `pedestrian`, `truck`, `motorcycle`, `bus`, `taxi`, `motor_scooter`.

- `pedestrian` is the safe mode for a tour of a city centre: it uses paths and squares
  the others cannot, and has the widest single-route limit relative to the distances a
  tour covers.
- `truck` and `motor_scooter` refuse locations the others accept, most often in historic
  centres, and the refusal is "no path", not a longer route. Nothing short of a route
  from the location proves it works for the mode. `truck` also takes vehicle dimensions
  (`height`, `weight`, `axle_load`, in `costing_options.truck`), which the script does
  not pass; add them by hand when they matter.
- The images carry no elevation data, so `use_hills` and its relatives never change a
  route.

## Departure and arrival times

`date_time` is passed by hand, not by the script. `{"type":1,"value":"2026-08-03T08:00"}`
departs at a local time, `type: 2` arrives by one, `type: 0` departs now, `type: 3`
holds the clock still along the route. It changes which roads are open (time-of-day
restrictions) and does the daylight-saving arithmetic, including across a time zone. It
does not change speeds: the images carry no traffic, so a route takes the same time at
rush hour and at night, and the times the script reports are those.

## What the answer cannot promise

- Times are free-flow times. Say so.
- A stop is where the data put it. A large site's centroid, a feature on an island, a
  point in a pedestrian zone for a car: the engine reaches the nearest road within the
  cutoff and reports how far that was in `snapped_m`. Name the large ones.
- The order is the engine's best, not a proven optimum; on a handful of stops it is
  the optimum in practice.
- The route is on one OSM snapshot: a road closed last week is open here.
