#!/bin/bash
set -euo pipefail

# Defaults
COUNTRY=""
REGION=""
ARTIFACTS_DIR="/artifacts"
WORK_DIR="/tmp/valhalla_build"
CONCURRENCY=$(nproc)

usage() {
  echo "Usage: build-valhalla.sh --country <name> --region <region>"
  echo ""
  echo "Examples:"
  echo "  build-valhalla.sh --country cyprus --region europe"
  echo "  build-valhalla.sh --country vietnam --region asia"
  echo ""
  echo "Any country with a Geofabrik extract works, not only the prebuilt images:"
  echo "pass its name and the region it sits in on download.geofabrik.de."
  exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --country) COUNTRY="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --concurrency) CONCURRENCY="$2"; shift 2 ;;
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
TILE_DIR="${WORK_DIR}/valhalla_tiles"
CONFIG_FILE="${WORK_DIR}/valhalla.json"

echo "=== Valhalla Tile Builder ==="
echo "Country: ${COUNTRY}"
echo "Region: ${REGION}"
echo "PBF URL: ${PBF_URL}"
echo "Concurrency: ${CONCURRENCY}"
echo ""

# Step 1: Setup
mkdir -p "${TILE_DIR}" "${ARTIFACTS_DIR}" "${ARTIFACTS_DIR}/osm"

# Step 2: Download PBF. A date file written by fetch-osm.sh pins the snapshot for the
# whole country build - refreshing here could advance the data mid-build and desync the
# routing tiles from the geocoding index. Without it, fall back to a conditional GET.
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

# Step 3: Generate config
echo "=== Generating config ==="
valhalla_build_config \
  --mjolnir-tile-dir "${TILE_DIR}" \
  --mjolnir-tile-extract "${TILE_DIR}/valhalla_tiles.tar" \
  --mjolnir-timezone "${TILE_DIR}/timezones.sqlite" \
  --mjolnir-admin "${TILE_DIR}/admins.sqlite" \
  --mjolnir-concurrency "${CONCURRENCY}" \
  > "${CONFIG_FILE}"

# Step 4: Build timezone database. valhalla_build_timezones downloads the timezone
# shapefile from GitHub releases with a single unretried curl, and that download fails
# intermittently - so retry the whole call, and accept only a non-empty database.
echo "=== Building timezone database ==="
for ATTEMPT in 1 2 3 4 5; do
  if valhalla_build_timezones > "${TILE_DIR}/timezones.sqlite" && [[ -s "${TILE_DIR}/timezones.sqlite" ]]; then
    break
  fi
  if [[ "${ATTEMPT}" -eq 5 ]]; then
    echo "valhalla_build_timezones failed after ${ATTEMPT} attempts"
    exit 1
  fi
  echo "valhalla_build_timezones failed (attempt ${ATTEMPT}/5), retrying in 60s"
  sleep 60
done

# Step 5: Build admin database
echo "=== Building admin database ==="
valhalla_build_admins --config "${CONFIG_FILE}" "${PBF_FILE}"

# Step 6: Build tiles (initial graph)
echo "=== Building tiles (initial) ==="
valhalla_build_tiles -c "${CONFIG_FILE}" -e build "${PBF_FILE}"

# Step 7: Build tiles (enhance)
echo "=== Building tiles (enhance) ==="
valhalla_build_tiles -c "${CONFIG_FILE}" -s enhance "${PBF_FILE}"

# Step 8: Extract tar
echo "=== Extracting tar archive ==="
valhalla_build_extract -c "${CONFIG_FILE}" -v

# Step 9: Copy artifacts
echo "=== Copying artifacts ==="
cp "${TILE_DIR}/valhalla_tiles.tar" "${ARTIFACTS_DIR}/valhalla-${COUNTRY}.tar"
cp "${CONFIG_FILE}" "${ARTIFACTS_DIR}/valhalla-${COUNTRY}.json"

TAR_SIZE=$(du -h "${ARTIFACTS_DIR}/valhalla-${COUNTRY}.tar" | cut -f1)

echo ""
echo "=== Done ==="
echo "Artifacts:"
echo "  ${ARTIFACTS_DIR}/valhalla-${COUNTRY}.tar (${TAR_SIZE})"
echo "  ${ARTIFACTS_DIR}/valhalla-${COUNTRY}.json"
