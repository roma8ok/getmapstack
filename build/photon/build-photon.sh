#!/bin/bash
set -euo pipefail

COUNTRY=""; COUNTRY_CODE=""
DB_HOST=""; DB_PASSWORD=""; DB_USER="nominatim"; DB_NAME="nominatim"; DB_PORT="5432"
ARTIFACTS_DIR="/artifacts"; WORK_DIR="/tmp/photon_build"; JAVA_HEAP="4g"
# Every language whose name:<code> tag should reach the index. A code absent from this list
# is silently not indexed: the importer looks up exactly these keys and drops the rest, so a
# missing code costs the country its local-language names. Codes are taken verbatim - three
# letter ones work the same way, which is how Tamazight (ber, zgh, kab, shi, tzm) gets in.
LANGUAGES="en,de,fr,it,es,pt,ru,zh,ja,ko,ar,uk,pl,nl,sv,el,ca,he,fi,th,hi,fa,hu,ro,cs,sr,be,ga,lt,br,eu,oc,ka,kn,ur,ms,my,km,lo,tl,tr,az,af,am,sw,so,ha,yo,ig,zu,xh,st,tn,ts,ss,ve,nr,sn,ny,rw,rn,mg,wo,ff,ln,lg,om,ti,ee,ak,bm,sg,sq,mk,bs,hr,sl,bg,sk,et,lv,lb,mt,rm,fy,ber,zgh,kab,shi,tzm"

usage() {
  echo "Usage: build-photon.sh --country <name> --country-code <cc> --db-host <host> --db-password <pw> \\"
  echo "                       [--db-user <u>] [--db-name <n>] [--db-port <p>] [--java-heap <size>]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --country)      COUNTRY="$2"; shift 2 ;;
    --country-code) COUNTRY_CODE="$2"; shift 2 ;;
    --db-host)      DB_HOST="$2"; shift 2 ;;
    --db-password)  DB_PASSWORD="$2"; shift 2 ;;
    --db-user)      DB_USER="$2"; shift 2 ;;
    --db-name)      DB_NAME="$2"; shift 2 ;;
    --db-port)      DB_PORT="$2"; shift 2 ;;
    --java-heap)    JAVA_HEAP="$2"; shift 2 ;;
    -h|--help)      usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$COUNTRY" || -z "$COUNTRY_CODE" || -z "$DB_HOST" || -z "$DB_PASSWORD" ]]; then
  echo "Error: --country, --country-code, --db-host and --db-password are required"
  usage
fi

echo "=== Photon Geocoding Builder (Nominatim source) ==="
echo "Country: ${COUNTRY} (${COUNTRY_CODE})"
echo "DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "Java heap: ${JAVA_HEAP}"
echo ""

mkdir -p "${WORK_DIR}" "${ARTIFACTS_DIR}"

# Photon flushes bulk requests every 10k docs, sized at a flat 1 KB each without
# -full-geometry, so heavy documents (-extra-tags ALL, many name:* translations) can
# push one bulk past the embedded OpenSearch default http.max_content_length of 100 MB
# (HTTP 413). The node reads opensearch.yml only when absent, so pre-seed a raised cap.
mkdir -p "${WORK_DIR}/photon_data/node_1/config"
printf 'http.max_content_length: 1000mb\n' > "${WORK_DIR}/photon_data/node_1/config/opensearch.yml"

echo "=== Importing from Nominatim into Photon ==="
java -Xmx"${JAVA_HEAP}" -jar /opt/photon.jar import \
  -host "${DB_HOST}" -port "${DB_PORT}" -database "${DB_NAME}" \
  -user "${DB_USER}" -password "${DB_PASSWORD}" \
  -country-codes "${COUNTRY_CODE}" \
  -languages "${LANGUAGES}" \
  -extra-tags ALL \
  -data-dir "${WORK_DIR}"
echo "Import complete"

echo "=== Removing stale lock files ==="
find "${WORK_DIR}/photon_data" -name "*.lock" -delete

echo "=== Packaging artifact ==="
tar -cf "${ARTIFACTS_DIR}/photon-${COUNTRY}.tar" -C "${WORK_DIR}" photon_data
TAR_SIZE=$(du -h "${ARTIFACTS_DIR}/photon-${COUNTRY}.tar" | cut -f1)

echo ""
echo "=== Done ==="
echo "  ${ARTIFACTS_DIR}/photon-${COUNTRY}.tar (${TAR_SIZE})"
