#!/bin/bash
set -euo pipefail

# Defaults
COUNTRY=""
REGION=""
ARTIFACTS_DIR="/artifacts"
WORK_DIR="/tmp/photon_build"
JAVA_HEAP="4g"

usage() {
  echo "Usage: build-photon.sh --country <name> --region <region> [--java-heap <size>]"
  echo ""
  echo "Examples:"
  echo "  build-photon.sh --country cyprus --region europe"
  echo "  build-photon.sh --country germany --region europe --java-heap 12g"
  echo "  build-photon.sh --country philippines --region asia"
  exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --country) COUNTRY="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --java-heap) JAVA_HEAP="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$COUNTRY" || -z "$REGION" ]]; then
  echo "Error: --country and --region are required"
  usage
fi

# GraphHopper uses different names for some countries
case "$COUNTRY" in
  south-korea) PHOTON_COUNTRY="korea" ;;
  *) PHOTON_COUNTRY="$COUNTRY" ;;
esac

DUMP_URL="https://download1.graphhopper.com/public/${REGION}/${PHOTON_COUNTRY}/photon-dump-${PHOTON_COUNTRY}-1.0-latest.jsonl.zst"
DUMP_FILE="${WORK_DIR}/photon-dump.jsonl.zst"

echo "=== Photon Geocoding Builder ==="
echo "Country: ${COUNTRY}"
echo "Region: ${REGION}"
echo "Java heap: ${JAVA_HEAP}"
echo "Dump URL: ${DUMP_URL}"
echo ""

# Step 1: Setup
mkdir -p "${WORK_DIR}" "${ARTIFACTS_DIR}"

# Step 2: Download JSONL dump
echo "=== Downloading JSONL dump ==="
curl -L --fail --progress-bar -o "${DUMP_FILE}" "${DUMP_URL}"
echo "Dump size: $(du -h "${DUMP_FILE}" | cut -f1)"

# Step 3: Import into Photon
echo "=== Importing into Photon ==="
zstd -d --stdout "${DUMP_FILE}" | java -Xmx${JAVA_HEAP} -jar /opt/photon.jar import \
  -data-dir "${WORK_DIR}" \
  -import-file - \
  -languages en,de,fr,it,es,pt,ru,zh,ja,ko,ar,uk,pl,nl,sv,el,ca,he,fi,th,hi,fa,hu,ro,cs,sr,be,ga,lt,br,eu,oc,ka,kn,ur,ms,my
echo "Import complete"

# Step 4: Remove dump and stale lock files before tar
rm "${DUMP_FILE}"
find "${WORK_DIR}/photon_data" -name "*.lock" -delete

# Step 5: Package photon_data as artifact
echo "=== Packaging artifact ==="
tar -cf "${ARTIFACTS_DIR}/photon-${COUNTRY}.tar" -C "${WORK_DIR}" photon_data

TAR_SIZE=$(du -h "${ARTIFACTS_DIR}/photon-${COUNTRY}.tar" | cut -f1)

echo ""
echo "=== Done ==="
echo "Artifact:"
echo "  ${ARTIFACTS_DIR}/photon-${COUNTRY}.tar (${TAR_SIZE})"
