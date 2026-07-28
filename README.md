# Getmapstack

<div align="center">

**[Quick start](#quick-start)** · **[Hosted API](#hosted-api)** · **[Countries](#countries)** · **[What you get](#what-you-get)** · **[Build it yourself](#build-it-yourself)**

</div>

**Self-hosted mapping stack. One command per country.**

Replace Google Maps API - no API keys, no rate limits, no vendor lock-in.

Routing via [Valhalla](https://valhalla.github.io/valhalla/) 3.8.3, geocoding via [Photon](https://github.com/komoot/photon) 1.2.1.

<img src="https://raw.githubusercontent.com/roma8ok/getmapstack/main/assets/how-it-works.svg" width="880" alt="One docker run command starts a container with Valhalla routing on port 8002 and Photon geocoding on port 2322, backed by OSM data baked into the image; your application talks to both.">

## Quick start

```bash
docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/cyprus
```

Images are multi-arch: linux/amd64 and linux/arm64 (Apple Silicon, AWS Graviton).

Give it a moment to start - Photon opens its search index in a few seconds for a country
this size, several minutes for the largest ones. Then check that it answers, a car route
from Nicosia to Limassol:

```bash
curl localhost:8002/route \
  -d '{"locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],"costing":"auto"}'
```

```json
{"trip":{"summary":{"length":84.736,"time":3770.219,"has_highway":true}}}
```

Every other method is in [What you get](#what-you-get).

## Hosted API

Try the stack without installing - the same services for all supported countries at `https://api.getmapstack.com` (`/valhalla` and `/photon` prefixes):

```bash
curl https://api.getmapstack.com/valhalla/route \
  -d '{"locations":[{"lat":35.18,"lon":33.38},{"lat":34.67,"lon":33.04}],"costing":"auto"}'
```

```bash
curl "https://api.getmapstack.com/photon/api?q=Nicosia&limit=1"
```

Please keep your usage fair. No SLA - this is a demo that may change or disappear; run your own container for unlimited use.

## Countries

| | Country | Size | Run |
|---|---------|------|-----|
| 🇧🇪 | Belgium | 1.9 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/belgium` |
| 🇧🇳 | Brunei | 0.5 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/brunei` |
| 🇨🇾 | Cyprus | 0.3 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/cyprus` |
| 🇮🇩 | Indonesia | 1.5 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/indonesia` |
| 🇰🇿 | Kazakhstan | 1.0 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/kazakhstan` |
| 🇲🇾 | Malaysia | 0.8 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/malaysia` |
| 🇸🇬 | Singapore | 0.6 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/singapore` |
| 🇰🇷 | South Korea | 1.5 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/south-korea` |
| 🇻🇳 | Vietnam | 0.9 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/vietnam` |

## What you get

Both engines serve their full API, not a trimmed subset - see [Not included](#not-included)
for the handful of features these images don't have the data to answer. Everything below
runs against a plain `docker run` of a country image, with no configuration.

| Task | Request | Service |
|------|---------|---------|
| Route between two or more points | [`POST /route`](#route) | `/valhalla` (:8002) |
| Route for a given departure or arrival time | [`POST /route`](#time-dependent-route) | `/valhalla` (:8002) |
| Visit many stops in the best order | [`POST /optimized_route`](#optimized-route) | `/valhalla` (:8002) |
| Time and distance for many pairs at once | [`POST /sources_to_targets`](#time-and-distance-matrix) | `/valhalla` (:8002) |
| Area reachable within N minutes | [`POST /isochrone`](#isochrone) | `/valhalla` (:8002) |
| Meeting point for several starting points | [`POST /centroid`](#meeting-point) | `/valhalla` (:8002) |
| Snap a GPS track to the road network | [`POST /trace_route`](#map-matching) | `/valhalla` (:8002) |
| Per-segment attributes of a snapped track | [`POST /trace_attributes`](#map-matching) | `/valhalla` (:8002) |
| Inspect what the router explored | [`POST /expansion`](#expansion) | `/valhalla` (:8002) |
| Nearest road to a coordinate | [`POST /locate`](#locate) | `/valhalla` (:8002) |
| Road network as vector tiles | [`POST /tile`](#road-network-tiles) | `/valhalla` (:8002) |
| Coordinates from a place name, search and autocomplete | [`GET /api?q=`](#search) | `/photon` (:2322) |
| Coordinates from address fields | [`GET /structured`](#structured-search) | `/photon` (:2322) |
| Address from coordinates | [`GET /reverse`](#reverse-geocoding) | `/photon` (:2322) |
| Versions and how old the data is | [`GET /status`](#data-freshness) | both |

Self-hosted, call the port directly: `localhost:8002/route`. On the hosted API the same
paths sit behind a prefix: `https://api.getmapstack.com/valhalla/route`.

Parameter-level reference for both engines:
[Valhalla API](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/) ·
[Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)

### Routing

#### Route

Cost options shape the result. This one avoids highways and tolls, asks for two
alternatives and kilometers:

```bash
curl localhost:8002/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto",
  "costing_options":{"auto":{"use_highways":0.2,"use_tolls":0}},
  "units":"kilometers",
  "alternates":2
}'
```

```json
{"trip":{"summary":{"length":90.545,"time":5700.343,"has_highway":false}},"alternates":[...]}
```

The default car route between the same points is 84.7 km in 63 minutes over the highway;
avoiding it costs 5.8 km and 32 minutes.

Costing profiles: `auto`, `bicycle`, `pedestrian`, `truck`, `motorcycle`, `bus`, `taxi`,
`motor_scooter`. Truck costing takes vehicle dimensions:

```bash
curl localhost:8002/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"truck",
  "costing_options":{"truck":{"height":4.11,"weight":21.77,"axle_load":9.07}}
}'
```

To route around an area, pass `exclude_polygons` - all polygons in one request may total
at most 10 km of perimeter, summed across every polygon rather than measured per polygon.
Each vertex is a `[lon, lat]` pair, the reverse of the `lat`/`lon` keys `locations` uses
in the same request:

```bash
curl localhost:8002/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto",
  "exclude_polygons":[[[33.36,35.15],[33.38,35.15],[33.38,35.17],[33.36,35.17],[33.36,35.15]]]
}'
```

```json
{"trip":{"summary":{"length":88.282,"time":4004.178}}}
```

**Decoding the shape:** every leg carries `shape` as an encoded polyline at **precision
6**, while Google's algorithm and most off-the-shelf decoders default to precision 5.
Decoded at precision 5, the route lands roughly ten times away from where it belongs.
Use a precision-6 decoder, or ask for GeoJSON instead:

```bash
curl localhost:8002/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto",
  "shape_format":"geojson"
}'
```

#### Time-dependent route

`date_time` accepts `type: 0` for "depart now", `type: 1` for "depart at", `type: 2`
for "arrive by", and `type: 3` for "invariant" - the clock does not advance along the
route, so every road is evaluated at the same moment. The answer carries local times
and time zones per location:

```bash
curl localhost:8002/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto",
  "date_time":{"type":1,"value":"2026-08-03T08:00"}
}'
```

```json
{"trip":{"locations":[
  {"lat":35.1856,"lon":33.3823,"date_time":"2026-08-03T08:00","time_zone_offset":"+03:00","time_zone_name":"Asia/Nicosia"},
  {"lat":34.6786,"lon":33.0413,"date_time":"2026-08-03T09:01","time_zone_offset":"+03:00","time_zone_name":"Asia/Nicosia"}]}}
```

Departure time picks up time-of-day access restrictions and daylight-saving arithmetic,
including routes that cross a time zone. It does not change travel speeds: the images
carry no traffic data, so travel time is the same at rush hour and at night.

#### Optimized route

Reorders the stops between the first and the last to make the trip shortest. Nicosia,
Paphos, Larnaca, Limassol in that order is 350.4 km:

```bash
curl localhost:8002/optimized_route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.7754,"lon":32.4245},
               {"lat":34.9229,"lon":33.6233},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto"
}'
```

```json
{"trip":{"summary":{"length":249.218},"locations":[{"original_index":0},{"original_index":2},{"original_index":1},{"original_index":3}]}}
```

`original_index` maps each stop back to its position in the request - here the optimizer
saved 101 km.

#### Time and distance matrix

Travel time and distance for every source-target pair, in one request:

```bash
curl localhost:8002/sources_to_targets -d '{
  "sources":[{"lat":35.1856,"lon":33.3823}],
  "targets":[{"lat":34.9229,"lon":33.6233},{"lat":35.0333,"lon":33.2000}],
  "costing":"auto"
}'
```

```json
{"sources_to_targets":[[{"from_index":0,"to_index":0,"time":2259,"distance":47.447},
                        {"from_index":0,"to_index":1,"time":3975,"distance":32.935}]]}
```

Keep the pairs regional: distant pairs come back with `null` time and distance even
though a direct route request between the same points succeeds.

#### Isochrone

How far you get in 10 and 20 minutes by car, as polygons:

```bash
curl localhost:8002/isochrone -d '{
  "locations":[{"lat":35.1856,"lon":33.3823}],
  "costing":"auto",
  "contours":[{"time":10,"color":"ff0000"},{"time":20,"color":"0000ff"}],
  "polygons":true,
  "denoise":0.5,
  "generalize":50
}'
```

```json
{"type":"FeatureCollection","features":[{"properties":{"contour":20.0,"metric":"time","color":"#0000ff"},"geometry":{"type":"Polygon","coordinates":[...]}}]}
```

Drop the coordinates straight into any map library. Contours can be distances instead of
times (`{"distance":1.5}`). Limits: up to 4 contours, 120 minutes or 200 km per contour,
one location per request.

#### Meeting point

Where several people should meet, by travel time rather than by geometry:

```bash
curl localhost:8002/centroid -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413},{"lat":34.9229,"lon":33.6233}],
  "costing":"auto"
}'
```

```json
{"trip":{"locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.83793,"lon":33.40012}],"summary":{"length":42.461,"time":929.531}}}
```

With three input stops, the top-level `trip` only carries the route from the first stop
(`trip.locations[0]`) to the converging point (`trip.locations[1]`). The routes from the
other input stops to that same point come back as full route objects - each with its own
`trip.locations` and `summary` - in the `alternates` array, one per remaining stop in
input order.

#### Map matching

Snap a raw GPS trace onto the road network and get a normal route back:

```bash
curl localhost:8002/trace_route -d '{
  "shape":[{"lat":35.1856,"lon":33.3823},{"lat":35.1860,"lon":33.3830},
           {"lat":35.1869,"lon":33.3841},{"lat":35.1880,"lon":33.3855}],
  "costing":"auto",
  "shape_match":"map_snap"
}'
```

```json
{"trip":{"summary":{"length":0.584,"time":79.172},"legs":[{"maneuvers":[{"street_names":["Agiou Dimitriou"]}]}]}}
```

`/trace_attributes` returns the matched road segments instead of driving instructions,
and `filters` keeps the response to the attributes you asked for:

```bash
curl localhost:8002/trace_attributes -d '{
  "shape":[{"lat":35.1856,"lon":33.3823},{"lat":35.1860,"lon":33.3830},
           {"lat":35.1869,"lon":33.3841},{"lat":35.1880,"lon":33.3855}],
  "costing":"auto",
  "shape_match":"map_snap",
  "filters":{"attributes":["edge.names","edge.speed","edge.road_class","edge.length"],"action":"include"}
}'
```

```json
{"edges":[{"names":["Agiou Dimitriou"],"speed":30,"road_class":"residential","length":0.039},
          {"names":["Plapouta"],"speed":30,"road_class":"residential","length":0.007}]}
```

#### Expansion

The search tree the router walked, as GeoJSON - useful for debugging a surprising route
or visualizing reachability:

```bash
curl localhost:8002/expansion -d '{
  "locations":[{"lat":35.1856,"lon":33.3823}],
  "costing":"auto",
  "action":"isochrone",
  "contours":[{"time":1}],
  "expansion_properties":["edge_id","cost","distance","edge_status"]
}'
```

```json
{"type":"FeatureCollection","properties":{"algorithm":"dijkstras"},
 "features":[{"properties":{"distance":161,"cost":21,"edge_status":"s","edge_id":3473392795306}}]}
```

`action` can also be `route`; expect a large response, since it contains every edge the
search touched.

#### Locate

What road a coordinate belongs to:

```bash
curl localhost:8002/locate -d '{
  "locations":[{"lat":35.1856,"lon":33.3823}],
  "costing":"auto",
  "verbose":true
}'
```

```json
[{"input_lat":35.1856,"input_lon":33.3823,"edges":[{"edge_info":{"names":["Zappeiou"],"way_id":21056849,"speed_limit":0}}]}]
```

`speed_limit` is 0 where OSM carries no `maxspeed` tag - routing still uses the profile's
default speed for that road class.

#### Road network tiles

The routing graph itself, as Mapbox Vector Tiles - layers `edges`, `nodes`, `shortcuts`
and `access_restrictions`, with per-edge attributes like road class and speed. Not a
basemap: no buildings, land use or labels, just every road the router knows about. The
tile address goes in a nested `tile` object; the common `/z/x/y.mvt` path form is not
supported:

```bash
curl localhost:8002/tile -d '{"tile":{"z":14,"x":9711,"y":6479}}' -o nicosia.mvt
```

The same request as a GET with URL-encoded JSON works as a tile template - point
MapLibre at it and the road network renders like any vector source:

```js
sources: {
  valhalla: {
    type: "vector",
    tiles: ["http://localhost:8002/tile?json=%7B%22tile%22%3A%7B%22z%22%3A{z}%2C%22x%22%3A{x}%2C%22y%22%3A{y}%7D%7D"],
    minzoom: 7
  }
}
```

Style the `edges` source-layer to see the network. Low zoom levels carry only the bigger
road classes; the endpoint is marked beta upstream.

### Geocoding

#### Search

Place name to coordinates. `lang` picks the language of the returned names:

```bash
curl "localhost:2322/api?q=Nicosia&limit=1&lang=en"
```

```json
{"features":[{"geometry":{"type":"Point","coordinates":[33.3638783,35.1746503]},
  "properties":{"name":"Nicosia","type":"district","country":"Cyprus","state":"Cyprus"}}]}
```

Without `lang` the same query returns local names - `Λευκωσία - Lefkoşa`, `Κύπρος -
Kıbrıs`.

The index is built for prefix matching, so autocomplete is the same endpoint with a
partial query:

```bash
curl "localhost:2322/api?q=Limas&limit=5&lang=en"
```

```json
{"features":[{"properties":{"name":"Limassol","type":"district"}},
             {"properties":{"name":"Limassol District","type":"county"}},
             {"properties":{"name":"Limassol","type":"city"}},
             {"properties":{"name":"Limassol Medieval Castle","type":"house"}},
             {"properties":{"name":"Limassol Salt Lake","type":"other"}}]}
```

Narrow the results by proximity, by bounding box, by result layer, by country, or by
OSM tag - `bbox` takes `minLon,minLat,maxLon,maxLat`, the reverse order of the
`lat`/`lon` query parameters on the same endpoint:

```bash
curl "localhost:2322/api?q=Agios&limit=3&lat=34.6786&lon=33.0413&lang=en"
curl "localhost:2322/api?q=Agios&limit=3&bbox=32.9,34.6,33.2,34.8&lang=en"
curl "localhost:2322/api?q=Larnaca&limit=3&layer=city&lang=en"
curl "localhost:2322/api?q=Nicosia&limit=3&countrycode=CY&lang=en"
curl "localhost:2322/api?q=hospital&limit=3&osm_tag=amenity:hospital&lang=en"
```

The last one turns the geocoder into a POI search:

```json
{"features":[{"properties":{"name":"Nicosia General Hospital","osm_value":"hospital","city":"Apostolos Varnavas & Agios Makarios"}},
             {"properties":{"name":"Paphos General Hospital","osm_value":"hospital","city":"Paphos"}},
             {"properties":{"name":"Lito Private Hospital","osm_value":"hospital","city":"Paralimni"}}]}
```

A few more dials: `zoom` and `location_bias_scale` tune how strongly the `lat`/`lon`
bias pulls results toward the focus point, `dedupe=0` keeps near-duplicate entries the
geocoder would otherwise fold, and `include`/`exclude` filter by category
(`osm.<key>.<value>`). A category with no `q` at all is pure discovery - everything of
one kind near a point:

```bash
curl "localhost:2322/api?include=osm.amenity.hospital&limit=3&lat=35.1856&lon=33.3823&lang=en"
```

#### Structured search

When the address already comes split into fields - a checkout form, a CRM record - skip
free-text guessing and pass the fields directly. Any subset of `street`, `housenumber`,
`city`, `district`, `county`, `state`, `postcode` and `countrycode` works:

```bash
curl "localhost:2322/structured?street=Zappeiou&housenumber=21&city=Nicosia&lang=en"
```

```json
{"features":[{"geometry":{"type":"Point","coordinates":[33.3824628,35.1852708]},
  "properties":{"housenumber":"21","street":"Zappeiou","city":"Nicosia","postcode":"1036","type":"house"}}]}
```

At least one field is required, and `q` is not accepted here - free text and structured
fields cannot mix in one request.

#### Reverse geocoding

Coordinates to address:

```bash
curl "localhost:2322/reverse?lat=35.1853&lon=33.3825&limit=1"
```

```json
{"features":[{"properties":{"street":"Zappeiou","housenumber":"21","city":"Λευκωσία","postcode":"1036"}}]}
```

`radius` (km) widens the search, `layer` restricts what comes back - streets only, for
example:

```bash
curl "localhost:2322/reverse?lat=35.1853&lon=33.3825&radius=5&limit=3&layer=street&lang=en"
```

```json
{"features":[{"properties":{"name":"Perikleous","type":"street"}},
             {"properties":{"name":"Zappeiou","type":"street"}},
             {"properties":{"name":"Gianni Tsiatala","type":"street"}}]}
```

Buildings come back without a `name` - they carry `housenumber` and `street` instead, so
check the number of features rather than the presence of a name.

### Data freshness

Each engine reports its version and when its data was built:

```bash
curl localhost:8002/status
```

```json
{"version":"3.8.3","tileset_last_modified":1785100041,"available_actions":[...]}
```

```bash
curl localhost:2322/status
```

```json
{"status":"Ok","import_date":"2026-07-25T18:00:19Z","version":"1.2.1","git_commit":"b9d6ab92"}
```

Both timestamps are build times, not the OpenStreetMap snapshot date. Every published
image also carries a date tag matching the OSM extract it was built from, next to
`latest`.

### Not included

- **Elevation.** Tiles are built without elevation data: `/height` answers with `null`
  values and routes carry no grade. Adding it means changing how the tiles are built and
  supplying a separate elevation dataset - it is not a flag on these images.
- **Traffic.** No live or historical traffic. Travel times use free-flow speeds, so a
  route takes the same time at 08:00 and at 23:00.
- **Public transport.** No GTFS feed is imported. `costing: multimodal` fails with
  "Locations are in unconnected regions" rather than falling back to walking, and
  `/transit_available` always answers `false`.
- **Full geometries.** The geocoding index stores points only: `geometry=1` answers
  HTTP 400. Area features still carry an `extent` bounding box where OSM has one.
- **Basemap tiles.** [`/tile`](#road-network-tiles) draws the road network, but there is
  no general-purpose basemap - no buildings, land use, water or place labels.
- **One country per image.** A route that leaves the country in the image has no data to
  follow - run the image for the country you need, or run several.

## Build it yourself

Requires Docker. Build a country image locally instead of pulling from GHCR:

```bash
git clone https://github.com/roma8ok/getmapstack.git
cd getmapstack
make build-valhalla-builder
make build-photon-builder
make create-valhalla-tiles COUNTRY=cyprus
make create-photon-data COUNTRY=cyprus
make build-server COUNTRY=cyprus
docker run -p 8002:8002 -p 2322:2322 getmapstack/cyprus
```

Intermediate artifacts (routing tiles, geocoding index) land in `artifacts/`. Images build for linux/amd64 and linux/arm64 by default - pass `PLATFORMS=linux/arm64` (or your platform) for a faster single-arch build. `make help` lists all targets and available countries.

## License

Code: [MIT](LICENSE). Map data: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), sourced from [Geofabrik](https://download.geofabrik.de/) extracts.

The images embed OSM-derived databases (routing tiles, geocoding index) redistributed under ODbL 1.0 - see [NOTICE](NOTICE) for full attribution. If you publicly use routing or geocoding results from these images, credit OpenStreetMap: "© OpenStreetMap contributors" linked to [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright).
