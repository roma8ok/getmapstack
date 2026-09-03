#!/bin/bash
set -euo pipefail

COUNTRY=""; COUNTRY_CODE=""
DB_HOST=""; DB_PASSWORD=""; DB_USER="nominatim"; DB_NAME="nominatim"; DB_PORT="5432"
ARTIFACTS_DIR="/artifacts"; WORK_DIR="/tmp/photon_build"; JAVA_HEAP="4g"
# Every language whose name:<code> tag should reach the index. A code absent from this list
# is silently not indexed: the importer looks up exactly these keys and drops the rest, so a
# missing code costs the country its local-language names. Codes are taken verbatim - three
# letter ones work the same way, which is how Tamazight (ber, zgh, kab, shi, tzm) and the
# Sami group (se, sma, smj, sju) get in. The list is checked against per-region tag counts
# rather than guessed - name:se alone carries 13,951 tags in Norway and name:mi 53,701 in
# New Zealand. A handful of Pacific national languages (tvl, ho, pon, yap, kos) carry no
# tags yet and are listed anyway, so the first country that maps them is not silently
# dropped the way az was for Azerbaijan.
# The Americas/Iceland/China pass added is, ht, qu, ay, gn, srn, yue, bo, ug, mn and za, each
# confirmed against taginfo first (ug 20,146 tags, yue 15,337, mn 15,033, bo 12,115, is 3,913,
# gn 1,935, qu 1,927, ht 1,711, za 731, ay 569, srn 120). mn was the one already owed: Mongolia
# shipped before it was listed, so that image carries no name:mn at all and only picks the
# translations up on a rebuild - the same failure az had, caught late again.
# The France/Germany pass added co, gsw, nds, hsb, dsb and frr, each confirmed against
# taginfo first (hsb 31,705 tags, gsw 7,666, co 6,250, dsb 5,133, nds 4,168, frr 1,617).
# All six are regional languages of the two countries - Corsican and Alsatian in France,
# Low German, Upper and Lower Sorbian and North Frisian in Germany - and none of them
# reaches an already-published country, so nothing owes a rebuild for this pass.
# The Canada/Russia/Ukraine/Belarus pass added kk, tt, cv, ce, ba, os, crh, iu, cr, udm,
# myv, kv, sah and mhr, each confirmed against taginfo first (kk 62,819 tags, tt 34,427,
# cv 14,049, ce 10,973, ba 9,311, os 8,272, crh 4,055, iu 2,345, cr 2,069, udm 1,935,
# myv 1,349, kv 1,176, sah 911, mhr 701). kk is the third language found owed to a
# country already shipped: Kazakhstan carries no name:kk at all and only picks the
# Kazakh names up on a rebuild, the same way az and mn were caught late.
LANGUAGES="en,de,fr,it,es,pt,ru,zh,ja,ko,ar,uk,pl,nl,sv,el,ca,he,fi,th,hi,fa,hu,ro,cs,sr,be,ga,lt,br,eu,oc,ka,kn,ur,ms,my,km,lo,tl,tr,az,af,am,sw,so,ha,yo,ig,zu,xh,st,tn,ts,ss,ve,nr,sn,ny,rw,rn,mg,wo,ff,ln,lg,om,ti,ee,ak,bm,sg,sq,mk,bs,hr,sl,bg,sk,et,lv,lb,mt,rm,fy,cy,gd,kw,ber,zgh,kab,shi,tzm,da,no,se,sma,smj,sju,fkv,fit,gl,ast,fur,lld,mi,mh,sm,bi,tpi,fj,gil,na,pau,to,chk,tvl,ho,pon,yap,kos,is,ht,qu,ay,gn,srn,yue,bo,ug,mn,za,co,gsw,nds,hsb,dsb,frr,kk,tt,cv,ce,ba,os,crh,iu,cr,udm,myv,kv,sah,mhr"

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
