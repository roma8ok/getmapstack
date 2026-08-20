#!/bin/bash
# Orchestrate a throwaway Nominatim import and a Photon export.
# Runs on the host; coordinates two containers on a scratch Docker network.
set -euo pipefail

COUNTRY=""; REGION=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --country) COUNTRY="$2"; shift 2 ;;
    --region)  REGION="$2";  shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done
[[ -z "$COUNTRY" || -z "$REGION" ]] && { echo "Error: --country and --region required"; exit 1; }

# ISO 3166-1 alpha-2 for the -country-codes Photon filter (also the hook for a
# future per-region batch import).
case "$COUNTRY" in
  afghanistan) CC="af" ;;
  albania) CC="al" ;;
  algeria) CC="dz" ;;
  andorra) CC="ad" ;;
  angola) CC="ao" ;;
  armenia) CC="am" ;;
  austria) CC="at" ;;
  azerbaijan) CC="az" ;;
  bahrain) CC="bh" ;;
  bangladesh) CC="bd" ;;
  belgium) CC="be" ;;
  benin) CC="bj" ;;
  bhutan) CC="bt" ;;
  bosnia-herzegovina) CC="ba" ;;
  botswana) CC="bw" ;;
  brunei) CC="bn" ;;
  bulgaria) CC="bg" ;;
  burkina-faso) CC="bf" ;;
  burundi) CC="bi" ;;
  cabo-verde) CC="cv" ;;
  cambodia) CC="kh" ;;
  cameroon) CC="cm" ;;
  central-african-republic) CC="cf" ;;
  chad) CC="td" ;;
  comoros) CC="km" ;;
  congo) CC="cg" ;;
  croatia) CC="hr" ;;
  cyprus) CC="cy" ;;
  czech-republic) CC="cz" ;;
  djibouti) CC="dj" ;;
  dr-congo) CC="cd" ;;
  east-timor) CC="tl" ;;
  egypt) CC="eg" ;;
  equatorial-guinea) CC="gq" ;;
  eritrea) CC="er" ;;
  estonia) CC="ee" ;;
  eswatini) CC="sz" ;;
  ethiopia) CC="et" ;;
  gabon) CC="ga" ;;
  gambia) CC="gm" ;;
  georgia) CC="ge" ;;
  ghana) CC="gh" ;;
  greece) CC="gr" ;;
  guinea) CC="gn" ;;
  guinea-bissau) CC="gw" ;;
  hungary) CC="hu" ;;
  india) CC="in" ;;
  indonesia) CC="id" ;;
  iraq) CC="iq" ;;
  ireland) CC="ie" ;;
  israel) CC="il" ;;
  ivory-coast) CC="ci" ;;
  jordan) CC="jo" ;;
  kazakhstan) CC="kz" ;;
  kenya) CC="ke" ;;
  kuwait) CC="kw" ;;
  kyrgyzstan) CC="kg" ;;
  laos) CC="la" ;;
  latvia) CC="lv" ;;
  lebanon) CC="lb" ;;
  lesotho) CC="ls" ;;
  liberia) CC="lr" ;;
  libya) CC="ly" ;;
  liechtenstein) CC="li" ;;
  lithuania) CC="lt" ;;
  luxembourg) CC="lu" ;;
  madagascar) CC="mg" ;;
  malawi) CC="mw" ;;
  malaysia) CC="my" ;;
  maldives) CC="mv" ;;
  mali) CC="ml" ;;
  malta) CC="mt" ;;
  mauritania) CC="mr" ;;
  mauritius) CC="mu" ;;
  moldova) CC="md" ;;
  monaco) CC="mc" ;;
  mongolia) CC="mn" ;;
  montenegro) CC="me" ;;
  morocco) CC="ma" ;;
  mozambique) CC="mz" ;;
  namibia) CC="na" ;;
  nepal) CC="np" ;;
  netherlands) CC="nl" ;;
  niger) CC="ne" ;;
  nigeria) CC="ng" ;;
  north-macedonia) CC="mk" ;;
  oman) CC="om" ;;
  pakistan) CC="pk" ;;
  philippines) CC="ph" ;;
  portugal) CC="pt" ;;
  qatar) CC="qa" ;;
  romania) CC="ro" ;;
  rwanda) CC="rw" ;;
  sao-tome-and-principe) CC="st" ;;
  saudi-arabia) CC="sa" ;;
  senegal) CC="sn" ;;
  serbia) CC="rs" ;;
  seychelles) CC="sc" ;;
  sierra-leone) CC="sl" ;;
  singapore) CC="sg" ;;
  slovakia) CC="sk" ;;
  slovenia) CC="si" ;;
  somalia) CC="so" ;;
  south-africa) CC="za" ;;
  south-korea) CC="kr" ;;
  south-sudan) CC="ss" ;;
  sri-lanka) CC="lk" ;;
  sudan) CC="sd" ;;
  switzerland) CC="ch" ;;
  tajikistan) CC="tj" ;;
  tanzania) CC="tz" ;;
  thailand) CC="th" ;;
  togo) CC="tg" ;;
  tunisia) CC="tn" ;;
  turkey) CC="tr" ;;
  turkmenistan) CC="tm" ;;
  uganda) CC="ug" ;;
  united-arab-emirates) CC="ae" ;;
  uzbekistan) CC="uz" ;;
  vietnam) CC="vn" ;;
  zambia) CC="zm" ;;
  zimbabwe) CC="zw" ;;
  *) echo "Error: no ISO country code mapped for '$COUNTRY'. Add it to run-nominatim-import.sh."; exit 1 ;;
esac

# Resource knobs, env-tunable; defaults sized for an ~8GB host - raise them on a bigger machine for large countries.
: "${NOMI_SHARED_BUFFERS:=256MB}"
: "${NOMI_MAINTENANCE_WORK_MEM:=512MB}"
: "${NOMI_READY_ATTEMPTS:=900}"
: "${PHOTON_HEAP:=4g}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Geofabrik bundles some countries into a single extract. build/pbf-slugs.txt is the
# single source of truth, shared with build/fetch-osm.sh and the valhalla builder.
SLUG_TABLE="$ROOT/build/pbf-slugs.txt"
[[ -f "$SLUG_TABLE" ]] || { echo "Error: slug table not found: $SLUG_TABLE"; exit 1; }
PBF_SLUG=$(awk -v c="$COUNTRY" '/^#/ { next } $1 == c { print $2; exit }' "$SLUG_TABLE")
PBF_SLUG="${PBF_SLUG:-$COUNTRY}"
# CACHE_DIR: reserved for a future per-region importance-dump cache; unused today.
OSM_DIR="$ROOT/artifacts/osm"; CACHE_DIR="$ROOT/artifacts/cache"; ART_DIR="$ROOT/artifacts"
mkdir -p "$OSM_DIR" "$CACHE_DIR" "$ART_DIR"
PBF_FILE="$OSM_DIR/${PBF_SLUG}.osm.pbf"
DATE_FILE="$OSM_DIR/${PBF_SLUG}.date"
PBF_URL="https://download.geofabrik.de/${REGION}/${PBF_SLUG}-latest.osm.pbf"

# NET/NOMI are fixed container/network names - concurrent runs on one host are
# unsupported; run one import at a time.
NET="gms-build"; NOMI="gms-nominatim"
DB_USER="nominatim"; DB_PASS="gmsbuild"; DB_NAME="nominatim"

cleanup() {
  docker rm -f "$NOMI" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Step A: shared PBF. A date file written by fetch-osm.sh pins the snapshot for the whole
# country build - refreshing here could pull a newer extract than the routing tiles were
# built from. Without it, fall back to a conditional GET.
if [[ -f "$DATE_FILE" && -f "$PBF_FILE" ]]; then
  echo "Using pinned PBF snapshot $(cat "$DATE_FILE") - skipping refresh"
else
  # Not pinned, or the pin lost its PBF: any surviving sidecar no longer describes what
  # we are about to hold, so drop it before fetching. A sidecar must only ever exist
  # alongside the bytes it describes.
  rm -f "$DATE_FILE"
  echo "Ensuring PBF is fresh: $PBF_SLUG"
  if [[ -f "$PBF_FILE" ]]; then
    HTTP_CODE=$(curl -L --fail --progress-bar --remove-on-error --retry 3 -R -z "$PBF_FILE" -o "$PBF_FILE" -w '%{response_code}' "$PBF_URL")
    if [[ "$HTTP_CODE" == "304" ]]; then
      echo "PBF up to date, reusing cached copy (HTTP 304)"
    else
      echo "PBF refreshed (HTTP $HTTP_CODE)"
    fi
  else
    curl -L --fail --progress-bar --remove-on-error --retry 3 -R -o "$PBF_FILE" "$PBF_URL"
  fi
fi

# Step B: scratch network + transient Nominatim with throwaway-DB tuning.
docker network create "$NET" >/dev/null 2>&1 || true
docker rm -f "$NOMI" >/dev/null 2>&1 || true
docker run -d --name "$NOMI" --network "$NET" \
  -e PBF_PATH=/data.osm.pbf \
  -e IMPORT_WIKIPEDIA=true \
  -e FREEZE=true -e UPDATE_MODE=none \
  -e NOMINATIM_PASSWORD="$DB_PASS" \
  -e POSTGRES_SHARED_BUFFERS="$NOMI_SHARED_BUFFERS" -e POSTGRES_MAINTENANCE_WORK_MEM="$NOMI_MAINTENANCE_WORK_MEM" \
  -e POSTGRES_SYNCHRONOUS_COMMIT=off \
  -v "$PBF_FILE":/data.osm.pbf:ro \
  mediagis/nominatim:5.3 >/dev/null
echo "Nominatim container started; importing $PBF_SLUG ..."

# Step C: wait for import to finish and the service to report OK.
# Checked from inside the container (not the published host port) so a host-side
# port conflict on 8080 can never masquerade as "not ready".
ready=""
for _ in $(seq 1 "$NOMI_READY_ATTEMPTS"); do
  if [ "$(docker inspect -f '{{.State.Running}}' "$NOMI" 2>/dev/null)" != "true" ]; then
    echo "ERROR: Nominatim container exited during import"; docker logs --tail 40 "$NOMI" 2>&1 || true
    exit 1
  fi
  if docker exec "$NOMI" curl -sf http://localhost:8080/status 2>/dev/null | grep -qi 'ok'; then ready=1; break; fi
  sleep 2
done
[[ -z "$ready" ]] && { echo "Nominatim did not become ready in time"; docker logs --tail 50 "$NOMI"; exit 1; }
echo "Nominatim ready."

# Step D: Photon needs an index on placex(country_code).
# -h localhost forces a TCP connection with password auth; the exec'd shell's OS
# user does not match the "nominatim" DB role, so the default Unix socket
# (peer auth) fails.
docker exec -e PGPASSWORD="$DB_PASS" "$NOMI" psql -h localhost -U "$DB_USER" -d "$DB_NAME" \
  -c 'CREATE INDEX IF NOT EXISTS idx_placex_country_code ON placex(country_code);'
echo "placex(country_code) index ensured."

if [[ "${GMS_DB_ONLY:-}" == "1" ]]; then
  echo "GMS_DB_ONLY set - stopping after DB bring-up."
  exit 0
fi

# Step E: run the photon-builder on the same network; it imports from placex and tars.
echo "=== Running Photon import ==="
docker run --rm --network "$NET" \
  -v "$ART_DIR":/artifacts \
  getmapstack/photon-builder \
  --country "$COUNTRY" --country-code "$CC" \
  --db-host "$NOMI" --db-password "$DB_PASS" \
  --db-user "$DB_USER" --db-name "$DB_NAME" \
  --java-heap "$PHOTON_HEAP"

echo "=== Done: artifacts/photon-${COUNTRY}.tar ==="
