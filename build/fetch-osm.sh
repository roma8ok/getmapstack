#!/bin/bash
# Download a country's Geofabrik extract and record its snapshot date beside it.
# Runs on the host. artifacts/osm/<slug>.date pins the snapshot for the rest of a
# country build: build-valhalla.sh and run-nominatim-import.sh reuse the PBF without
# refreshing while it is present, and the push step turns it into the dated image tag.
set -euo pipefail

COUNTRY=""; REGION=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --country) COUNTRY="$2"; shift 2 ;;
    --region)  REGION="$2";  shift 2 ;;
    -h|--help) echo "Usage: fetch-osm.sh --country <name> --region <region>"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done
[[ -z "$COUNTRY" || -z "$REGION" ]] && { echo "Error: --country and --region are required"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SLUG_TABLE="$SCRIPT_DIR/pbf-slugs.txt"
[[ -f "$SLUG_TABLE" ]] || { echo "Error: slug table not found: $SLUG_TABLE"; exit 1; }

PBF_SLUG=$(awk -v c="$COUNTRY" '/^#/ { next } $1 == c { print $2; exit }' "$SLUG_TABLE")
PBF_SLUG="${PBF_SLUG:-$COUNTRY}"

ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OSM_DIR="$ROOT/artifacts/osm"
mkdir -p "$OSM_DIR"
PBF_FILE="$OSM_DIR/${PBF_SLUG}.osm.pbf"
DATE_FILE="$OSM_DIR/${PBF_SLUG}.date"
# Geofabrik files most countries under a continent, but a few extracts sit at the root of
# its download tree with no directory segment at all. The region "root" means exactly
# that: build the URL without one, rather than requesting a path that does not exist.
if [ "${REGION}" = "root" ]; then
  PBF_URL="https://download.geofabrik.de/${PBF_SLUG}-latest.osm.pbf"
else
  PBF_URL="https://download.geofabrik.de/${REGION}/${PBF_SLUG}-latest.osm.pbf"
fi

# The sidecar is a claim about the bytes on disk, and from here until it is rewritten
# below that claim may stop being true. Drop it up front: no sidecar is always safe
# (consumers fall back to their own conditional GET), a stale one is not. Without this,
# a refresh that succeeds followed by a header-parse failure would leave the old date
# sitting beside new bytes.
rm -f "$DATE_FILE"

# Headers go to a temp file so the snapshot date comes out of the very response that
# produced the bytes on disk. A separate HEAD probe could observe a different snapshot
# than the one we end up holding; reading the download's own headers closes that window
# and costs one request less. Geofabrik answers 304 with Last-Modified present, and on a
# 304 that header describes the copy we already hold - correct in both branches.
HEADER_FILE=$(mktemp)
trap 'rm -f "$HEADER_FILE"' EXIT

# Geofabrik sits behind a caching proxy that returns 502/503 in bursts lasting minutes, not
# seconds. curl's default backoff doubles from one second, so `--retry 3` gives up after
# about seven seconds - enough for a blip, nowhere near enough for the real thing, and the
# whole batch build dies at whichever country happened to ask during the burst. A fixed
# 30-second spacing bounded at fifteen minutes rides the burst out instead. Only transient
# failures are retried (curl's default set: 408, 429, 5xx and connection errors), so a real
# 404 from a wrong slug still fails immediately rather than costing fifteen minutes.
RETRY_OPTS=(--retry 10 --retry-delay 30 --retry-max-time 900)

echo "=== Fetching OSM extract: ${PBF_SLUG} ==="
if [[ -f "$PBF_FILE" ]]; then
  HTTP_CODE=$(curl -L --fail --progress-bar --remove-on-error "${RETRY_OPTS[@]}" -R -z "$PBF_FILE" -o "$PBF_FILE" -D "$HEADER_FILE" -w '%{response_code}' "$PBF_URL")
  if [[ "$HTTP_CODE" == "304" ]]; then
    echo "PBF up to date, reusing cached copy (HTTP 304)"
  else
    echo "PBF refreshed (HTTP ${HTTP_CODE})"
  fi
else
  curl -L --fail --progress-bar --remove-on-error "${RETRY_OPTS[@]}" -R -o "$PBF_FILE" -D "$HEADER_FILE" "$PBF_URL"
fi

# -L dumps the 302 block as well as the final one, hence tail -1. The `|| true` keeps
# `set -o pipefail` from killing the script with no diagnostic when the header is missing
# - the regex check below reports it properly.
LAST_MODIFIED=$(grep -i '^last-modified:' "$HEADER_FILE" | tail -1 | cut -d' ' -f2- || true)
SNAPSHOT=$(printf '%s\n' "$LAST_MODIFIED" | awk '
  BEGIN { split("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec", mn, " ")
          for (i in mn) m[mn[i]] = sprintf("%02d", i) }
  { gsub(/\r/, ""); if (m[$3] == "") exit 1; printf "%s-%s-%02d\n", $4, m[$3], $2 }' || true)

if ! printf '%s' "$SNAPSHOT" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "Error: could not read a snapshot date from ${PBF_URL} (Last-Modified: '${LAST_MODIFIED}')"
  exit 1
fi

printf '%s\n' "$SNAPSHOT" > "$DATE_FILE"
echo "OSM snapshot for ${COUNTRY}: ${SNAPSHOT} (${PBF_SLUG})"
