#!/bin/bash
set -euo pipefail

COUNTRY=""
REGION=""
ARTIFACTS_DIR="/artifacts"

usage() {
  echo "Usage: build-planetiler.sh --country <name> --region <region>"
  echo ""
  echo "Examples:"
  echo "  build-planetiler.sh --country cyprus --region europe"
  echo "  build-planetiler.sh --country vietnam --region asia"
  echo ""
  echo "Any country with a Geofabrik extract works, not only the prebuilt images:"
  echo "pass its name and the region it sits in on download.geofabrik.de."
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --country) COUNTRY="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$COUNTRY" || -z "$REGION" ]]; then
  echo "Error: --country and --region are required"
  usage
fi

# Geofabrik bundles some countries into a single extract. build/pbf-slugs.txt is the
# single source of truth, baked into this image at build time.
SLUG_TABLE="/usr/local/share/getmapstack/pbf-slugs.txt"
[[ -f "$SLUG_TABLE" ]] || { echo "Error: slug table not found: $SLUG_TABLE"; exit 1; }
PBF_SLUG=$(awk -v c="$COUNTRY" '/^#/ { next } $1 == c { print $2; exit }' "$SLUG_TABLE")
PBF_SLUG="${PBF_SLUG:-$COUNTRY}"
# Geofabrik files most countries under a continent, but a few extracts sit at the root of
# its download tree with no directory segment at all. The region "root" means exactly
# that: build the URL without one, rather than requesting a path that does not exist.
if [ "${REGION}" = "root" ]; then
  PBF_URL="https://download.geofabrik.de/${PBF_SLUG}-latest.osm.pbf"
else
  PBF_URL="https://download.geofabrik.de/${REGION}/${PBF_SLUG}-latest.osm.pbf"
fi
PBF_FILE="${ARTIFACTS_DIR}/osm/${PBF_SLUG}.osm.pbf"
DATE_FILE="${ARTIFACTS_DIR}/osm/${PBF_SLUG}.date"
CACHE_DIR="${ARTIFACTS_DIR}/planetiler-cache"
OUTPUT="${ARTIFACTS_DIR}/tiles-${COUNTRY}.pmtiles"

echo "=== Planetiler Vector Tile Builder ==="
echo "Country: ${COUNTRY}"
echo "Region: ${REGION}"
echo "PBF URL: ${PBF_URL}"
echo ""

mkdir -p "${ARTIFACTS_DIR}/osm" "${CACHE_DIR}"

# Download PBF. A date file written by fetch-osm.sh pins the snapshot for the
# whole country build - refreshing here could advance the data mid-build and desync the
# vector tiles from routing and geocoding. Without it, fall back to a conditional GET.
echo "=== Downloading PBF ==="
if [[ -f "${DATE_FILE}" && -f "${PBF_FILE}" ]]; then
  echo "Using pinned PBF snapshot $(cat "${DATE_FILE}") - skipping refresh"
else
  # Not pinned, or the pin lost its PBF: any surviving sidecar no longer describes what
  # we are about to hold, so drop it before fetching. A sidecar must only ever exist
  # alongside the bytes it describes.
  rm -f "${DATE_FILE}"
  if [[ -f "${PBF_FILE}" ]]; then
    HTTP_CODE=$(curl -L --fail --progress-bar --remove-on-error --retry 10 --retry-delay 30 --retry-max-time 900 -R -z "${PBF_FILE}" -o "${PBF_FILE}" -w '%{response_code}' "${PBF_URL}")
    if [[ "${HTTP_CODE}" == "304" ]]; then
      echo "PBF up to date, reusing cached copy (HTTP 304)"
    else
      echo "PBF refreshed (HTTP ${HTTP_CODE})"
    fi
  else
    curl -L --fail --progress-bar --remove-on-error --retry 10 --retry-delay 30 --retry-max-time 900 -R -o "${PBF_FILE}" "${PBF_URL}"
  fi
fi
echo "PBF size: $(du -h "${PBF_FILE}" | cut -f1)"

# The default profile needs global helper datasets (water polygons, Natural Earth, lake
# centerlines - about 1.4 GB). --download fetches only what is missing into the shared
# cache; to refresh them, delete the cache directory.
echo "=== Building vector tiles ==="
java -cp @/app/jib-classpath-file com.onthegomap.planetiler.Main \
  --osm-path="${PBF_FILE}" \
  --output="${OUTPUT}" \
  --download --download-dir="${CACHE_DIR}" \
  --force

TILES_SIZE=$(du -h "${OUTPUT}" | cut -f1)

echo ""
echo "=== Done ==="
echo "Artifacts:"
echo "  ${OUTPUT} (${TILES_SIZE})"
