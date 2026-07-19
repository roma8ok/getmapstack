# Getmapstack

Self-hosted mapping stack. One command per country.

Replace Google Maps API — no API keys, no rate limits, no vendor lock-in.

Routing via [Valhalla](https://valhalla.github.io/valhalla/), geocoding via [Photon](https://github.com/komoot/photon).

<img src="https://raw.githubusercontent.com/roma8ok/getmapstack/main/assets/how-it-works.svg" width="880" alt="One docker run command starts a container with Valhalla routing on port 8002 and Photon geocoding on port 2322, backed by OSM data baked into the image; your application talks to both.">

## Quick start

```
docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/cyprus
```

Images are multi-arch: linux/amd64 and linux/arm64 (Apple Silicon, AWS Graviton).

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

Full API docs: [Valhalla API](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/) · [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)

## Countries

| | Country | Size | Run |
|---|---------|------|-----|
| 🇧🇪 | Belgium | 2.2 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/belgium` |
| 🇧🇳 | Brunei | 0.5 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/brunei` |
| 🇨🇾 | Cyprus | 0.3 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/cyprus` |
| 🇮🇩 | Indonesia | 1.5 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/indonesia` |
| 🇲🇾 | Malaysia | 0.8 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/malaysia` |
| 🇸🇬 | Singapore | 0.5 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/singapore` |
| 🇰🇷 | South Korea | 1.4 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/south-korea` |
| 🇻🇳 | Vietnam | 0.8 GB | `docker run -p 8002:8002 -p 2322:2322 ghcr.io/roma8ok/getmapstack/vietnam` |

## Build it yourself

Requires Docker. Build a country image locally instead of pulling from GHCR:

```
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

[MIT](LICENSE)
