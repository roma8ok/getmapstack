# Getmapstack

Self-hosted mapping stack. One command per country.

Replace Google Maps API — no API keys, no rate limits, no vendor lock-in.

Routing via [Valhalla](https://valhalla.github.io/valhalla/), geocoding via [Photon](https://github.com/komoot/photon), Google Directions API and Routes API compatibility via built-in proxy.

## Quick start

```
docker run -p 8002:8002 -p 2322:2322 -p 8443:8443 ghcr.io/roma8ok/getmapstack/cyprus
```

## Verify

Routing — Nicosia to Limassol:

```
curl localhost:8002/route \
  -d '{"locations":[{"lat":35.18,"lon":33.38},{"lat":34.67,"lon":33.04}],"costing":"auto"}'
```

```json
{"trip":{"summary":{"length":84.737,"time":3770.235,"has_highway":true}}}
```

Geocoding — search for "Nicosia":

```
curl "localhost:2322/api?q=Nicosia&limit=1"
```

```json
{"features":[{"properties":{"name":"Λευκωσία - Lefkoşa","type":"city","country":"Κύπρος - Kıbrıs"}}]}
```

Reverse geocoding — coordinates to address:

```
curl "localhost:2322/reverse?lon=33.38&lat=35.18&limit=1"
```

```json
{"features":[{"properties":{"street":"Zappeiou","housenumber":"21","city":"Λευκωσία - Lefkoşa"}}]}
```

## Google Directions API

Drop-in replacement for the [Google Directions API](https://developers.google.com/maps/documentation/directions/overview). Switch your base URL — no code changes needed.

Route from Nicosia to Limassol:

```
curl "localhost:8443/maps/api/directions/json?origin=35.18,33.38&destination=34.67,33.04&mode=driving"
```

```json
{"status":"OK","routes":[{"summary":"Lemesou","legs":[{"distance":{"text":"84.7 km"},"duration":{"text":"1 hour 3 mins"},"steps":[...]}],"overview_polyline":{"points":"..."}}]}
```

Supports `driving`, `walking`, `bicycling` modes, `waypoints`, `alternatives`, `units`, `avoid` (tolls, highways, ferries), `departure_time`, and `language`. Returns routes, legs, steps with maneuver types and `html_instructions`, distances, durations, encoded polylines, bounds, and copyrights — same structure as Google's response.

## Google Routes API

Drop-in replacement for the [Google Routes API](https://developers.google.com/maps/documentation/routes/overview). Same request/response format — just change the base URL.

Route from Nicosia to Limassol:

```
curl -X POST localhost:8443/directions/v2:computeRoutes \
  -H 'Content-Type: application/json' \
  -d '{"origin":{"location":{"latLng":{"latitude":35.18,"longitude":33.38}}},"destination":{"location":{"latLng":{"latitude":34.67,"longitude":33.04}}}}'
```

```json
{"routes":[{"distanceMeters":84737,"duration":"3770s","legs":[{"distanceMeters":84737,"duration":"3770s","steps":[...]}]}]}
```

Supports `DRIVE`, `WALK`, `BICYCLE` travel modes, `intermediates` (waypoints), `computeAlternativeRoutes`, `units`, `routeModifiers` (avoidTolls, avoidHighways, avoidFerries), `departureTime`, and `languageCode`. Returns routes, legs, steps, distances, durations, and encoded polylines.

Full API docs: [Valhalla API](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/) · [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)

## Countries

| | Country | Size | Run |
|---|---------|------|-----|
| 🇧🇪 | Belgium | 4.4 GB | `docker run -p 8002:8002 -p 2322:2322 -p 8443:8443 ghcr.io/roma8ok/getmapstack/belgium` |
| 🇨🇾 | Cyprus | 0.6 GB | `docker run -p 8002:8002 -p 2322:2322 -p 8443:8443 ghcr.io/roma8ok/getmapstack/cyprus` |
| 🇰🇷 | South Korea | 2.8 GB | `docker run -p 8002:8002 -p 2322:2322 -p 8443:8443 ghcr.io/roma8ok/getmapstack/south-korea` |
| 🇻🇳 | Vietnam | 1.9 GB | `docker run -p 8002:8002 -p 2322:2322 -p 8443:8443 ghcr.io/roma8ok/getmapstack/vietnam` |

## License

[MIT](LICENSE)
