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
  echo "  build-valhalla.sh --country germany --region europe"
  echo "  build-valhalla.sh --country philippines --region asia"
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

PBF_URL="https://download.geofabrik.de/${REGION}/${COUNTRY}-latest.osm.pbf"
PBF_FILE="${WORK_DIR}/${COUNTRY}.osm.pbf"
TILE_DIR="${WORK_DIR}/valhalla_tiles"
CONFIG_FILE="${WORK_DIR}/valhalla.json"

echo "=== Valhalla Tile Builder ==="
echo "Country: ${COUNTRY}"
echo "Region: ${REGION}"
echo "PBF URL: ${PBF_URL}"
echo "Concurrency: ${CONCURRENCY}"
echo ""

# Step 1: Setup
mkdir -p "${TILE_DIR}" "${ARTIFACTS_DIR}"

# Step 2: Download PBF
echo "=== Downloading PBF ==="
if [[ -f "${PBF_FILE}" ]]; then
  echo "PBF already exists, skipping download"
else
  curl -L --fail --progress-bar -o "${PBF_FILE}" "${PBF_URL}"
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

# Step 4: Build timezone database
echo "=== Building timezone database ==="
valhalla_build_timezones > "${TILE_DIR}/timezones.sqlite"

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
