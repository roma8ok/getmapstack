#!/usr/bin/env bash
# Find every feature carrying an OSM tag within a radius of a point, working around the
# geocoder's undeclared result ceiling. Writes a GeoJSON FeatureCollection to stdout.
set -euo pipefail

# Photon answers with at most this many features per call whatever `limit` asks for, and
# nothing in the response says it truncated. Measured on Photon 1.2.1.
readonly CEILING=50
# A saturated area is re-covered by cells of a third the radius, so each cell holds
# roughly a ninth of the features - enough to clear the ceiling in a dense city centre.
readonly CELL_DIVISOR=3
# Three rounds of that shrink the radius 27-fold, which cleared the densest city centre
# measured. The cap bounds how small the circles get, and nothing else.
readonly MAX_DEPTH=3
# Depth alone does not bound the work: a saturated cell spawns about thirty-seven
# children, so three levels is over fifty thousand requests. This caps the whole run at
# about a minute and a half of them - room for a wide radius over a dense tag to finish,
# while an area dense enough to fan out without end still stops there.
readonly MAX_CALLS=3000
readonly KM_PER_DEG_LAT=111.32

usage_text() {
  cat <<'USAGE'
usage: nearby.sh --lat LAT --lon LON --radius KM --tag KEY:VALUE [--port PORT]

  --tag   an OSM key:value pair, for example shop:supermarket or amenity:pharmacy
  --port  the port the container publishes (default 4326)

Writes a GeoJSON FeatureCollection to stdout, nearest feature first.
USAGE
}

# Wrong arguments: the text goes to stderr and the status says so. A help request is
# not an error and takes the other path, below.
usage() { usage_text >&2; exit 64; }

need() { # flag-name and the remaining arguments
  [ $# -ge 2 ] && [ -n "${2-}" ] || { printf 'nearby.sh: %s needs a value\n' "$1" >&2; usage; }
}

lat=; lon=; radius=; tag=; port=4326
while [ $# -gt 0 ]; do
  case "$1" in
    --lat) need "$@"; lat=$2; shift 2 ;;
    --lon) need "$@"; lon=$2; shift 2 ;;
    --radius) need "$@"; radius=$2; shift 2 ;;
    --tag) need "$@"; tag=$2; shift 2 ;;
    --port) need "$@"; port=$2; shift 2 ;;
    -h|--help) usage_text; exit 0 ;;
    *) printf 'nearby.sh: unknown argument %s\n' "$1" >&2; usage ;;
  esac
done
[ -n "$lat" ] && [ -n "$lon" ] && [ -n "$radius" ] && [ -n "$tag" ] || usage
# Both halves have to be there: a bare colon is not a tag, and the geocoder answers a
# half-written one with something that looks like an empty area.
case "$tag" in ?*:?*) ;; *) printf 'nearby.sh: --tag must be key:value, got %s\n' "$tag" >&2; exit 64 ;; esac

numeric() { awk -v v="${1-}" 'BEGIN{ exit !(v ~ /^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$/) }'; }
inrange() { awk -v v="$1" -v lo="$2" -v hi="$3" 'BEGIN{ exit !(v >= lo && v <= hi) }'; }

numeric "$lat"    || { printf 'nearby.sh: --lat must be a number, got %s\n' "$lat" >&2; exit 64; }
numeric "$lon"    || { printf 'nearby.sh: --lon must be a number, got %s\n' "$lon" >&2; exit 64; }
numeric "$radius" || { printf 'nearby.sh: --radius must be a number, got %s\n' "$radius" >&2; exit 64; }
inrange "$lat" -90 90    || { printf 'nearby.sh: --lat must be between -90 and 90, got %s\n' "$lat" >&2; exit 64; }
inrange "$lon" -180 180  || { printf 'nearby.sh: --lon must be between -180 and 180, got %s\n' "$lon" >&2; exit 64; }
awk -v v="$radius" 'BEGIN{ exit !(v > 0) }' || { printf 'nearby.sh: --radius must be greater than zero, got %s\n' "$radius" >&2; exit 64; }
# An unchecked port reaches curl as a hostname it cannot resolve, and the failure then
# reads as an unreachable container rather than as the typo it is.
numeric "$port" || { printf 'nearby.sh: --port must be a number, got %s\n' "$port" >&2; exit 64; }
inrange "$port" 1 65535 || { printf 'nearby.sh: --port must be between 1 and 65535, got %s\n' "$port" >&2; exit 64; }

readonly base="http://localhost:$port/photon/reverse"

# The accumulator goes to a file, never to a command line: a dense tag over a wide
# radius produces more JSON than ARG_MAX allows as an argument.
parts=$(mktemp)
trap 'rm -f "$parts"' EXIT

fetch() { # lat lon radius -> features array on stdout
  local response body status
  if ! response=$(curl -s --max-time 30 -w '\n%{http_code}' --get "$base" \
        --data-urlencode "lat=$1" --data-urlencode "lon=$2" \
        --data-urlencode "radius=$3" --data-urlencode "limit=$CEILING" \
        --data-urlencode "osm_tag=$tag" --data-urlencode "lang=en"); then
    printf 'nearby.sh: cannot reach %s - is the container running? try: curl -sf localhost:%s/healthz\n' "$base" "$port" >&2
    exit 69
  fi
  status=${response##*$'\n'}
  body=${response%$'\n'*}
  if [ "$status" != "200" ]; then
    printf 'nearby.sh: the geocoder answered HTTP %s - check --lat, --lon, --radius and --tag\n' "$status" >&2
    exit 65
  fi
  printf '%s' "$body" | jq -c '.features // []'
}

# Centres sit on a square lattice whose spacing makes each cell circle reach the corners
# of its square, so the covering leaves no gap: spacing = cell radius * sqrt(2).
cells() { # lat lon radius cell -> "lat lon" lines covering the disc
  awk -v lat="$1" -v lon="$2" -v r="$3" -v cell="$4" -v kpl="$KM_PER_DEG_LAT" '
    BEGIN{
      # Spacing that just touches the corners of each square is cell*sqrt(2). A tenth
      # is taken off so neighbouring cells overlap instead of meeting exactly: that
      # bound has no margin of its own, and cos(lat) is evaluated once at the centre,
      # so rows away from it sit slightly wider apart in real kilometres than intended.
      step = cell * sqrt(2) * 0.9
      dlat = step / kpl
      dlon = step / (kpl * cos(lat * 3.14159265358979 / 180))
      n = int(r / step) + 1
      for (i = -n; i <= n; i++)
        for (j = -n; j <= n; j++)
          if (sqrt((i*step)^2 + (j*step)^2) <= r + step) {
            y = lat + i*dlat; x = lon + j*dlon
            # Longitude wraps. A lattice built near the antimeridian would otherwise
            # emit values past 180, which the geocoder rejects.
            while (x > 180) x -= 360
            while (x < -180) x += 360
            printf "%.6f %.6f\n", y, x
          }
    }'
}

saturated_at_floor=0
budget_spent=0
# Counted here rather than in fetch: fetch runs inside a command substitution, so a
# counter raised there would be raised in a subshell and lost on the way back.
calls=0

collect() { # lat lon radius depth
  calls=$((calls + 1))
  local cy=$1 cx=$2 cr=$3 depth=$4 part count cell
  part=$(fetch "$cy" "$cx" "$cr")
  count=$(printf '%s' "$part" | jq 'length')
  if [ "$count" -lt "$CEILING" ] || [ "$depth" -ge "$MAX_DEPTH" ] || [ "$calls" -ge "$MAX_CALLS" ]; then
    if [ "$count" -ge "$CEILING" ]; then
      if [ "$depth" -ge "$MAX_DEPTH" ]; then saturated_at_floor=1; else budget_spent=1; fi
    fi
    printf '%s' "$part" | jq -c '.[]' >> "$parts"
    return
  fi
  cell=$(awk -v r="$cr" -v d="$CELL_DIVISOR" 'BEGIN{printf "%.6f", r/d}')
  while read -r sy sx; do
    [ -n "$sy" ] && collect "$sy" "$sx" "$cell" "$((depth + 1))"
  done < <(cells "$cy" "$cx" "$cr" "$cell")
}

collect "$lat" "$lon" "$radius" 0

if [ "$saturated_at_floor" -eq 1 ]; then
  printf 'nearby.sh: a cell was still full at the smallest radius tried, so a few features in the densest spot may be missing\n' >&2
fi
if [ "$budget_spent" -eq 1 ]; then
  printf 'nearby.sh: the search stopped at its call budget of %s, so the answer may be short in the densest spots; a smaller radius covers the same ground completely\n' "$MAX_CALLS" >&2
fi

out=$(jq -s -c \
  --argjson lat "$lat" --argjson lon "$lon" --argjson r "$radius" --argjson kpl "$KM_PER_DEG_LAT" '
  def km: . as $f
    | (($f.geometry.coordinates[1] - $lat) * $kpl) as $dy
    | ($f.geometry.coordinates[0] - $lon) as $raw
    # The shorter way round. Both longitudes are within [-180, 180], so the raw
    # difference is at most 360 and one adjustment is always enough.
    | (if $raw > 180 then $raw - 360 elif $raw < -180 then $raw + 360 else $raw end) as $dlon
    | ($dlon * $kpl * (($lat * 3.14159265358979 / 180) | cos)) as $dx
    | (($dx*$dx + $dy*$dy) | sqrt);
  unique_by((.properties.osm_type // "") + "/" + ((.properties.osm_id // 0) | tostring))
  | map(select(km <= $r))
  | sort_by(km)
  | {type: "FeatureCollection", features: .}' "$parts")

if [ "$(printf '%s' "$out" | jq '.features | length')" -eq 0 ]; then
  printf 'nearby.sh: nothing carries %s within %s km of %s,%s. A tag that does not exist returns exactly this, so check the spelling (amenity:kindergarten, not amenity:kindergarden) before concluding the area is empty.\n' \
    "$tag" "$radius" "$lat" "$lon" >&2
fi

printf '%s\n' "$out"
