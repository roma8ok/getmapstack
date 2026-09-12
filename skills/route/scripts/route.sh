#!/usr/bin/env bash
# Build a route through the container's routing engine: from a start to an end through
# waypoints in the given order, or through a set of stops in the best order the engine
# finds, with the end chosen by trying every stop as the last one. Writes a GeoJSON
# FeatureCollection to stdout: the route line first, then one point per location in
# visiting order.
set -euo pipefail

# optimized_route is bounded by the matrix behind it: n^2 location pairs must stay
# under the engine's max_matrix_location_pairs of 2500, whatever the costing. That is
# 50 locations including the start. Measured on Valhalla 3.8.3: 50 answers, 51 refuses.
readonly MAX_LOCATIONS=50
# A location with no road within this many metres is refused rather than snapped.
# Without a cutoff the engine snaps to the nearest road within 35 km and says nothing:
# a point 15 km out at sea routed happily to a beach 28 km away.
readonly SEARCH_CUTOFF_M=1000
# A stop that snapped further than this from where it was asked is reported on stderr:
# the point is probably a large site's centroid, or an island, and the road is elsewhere.
readonly FAR_SNAP_M=250
# Sweep calls in flight at once. Four cut a 50-location car sweep from about 3.5 minutes
# to about 70 s on an 8-core machine; a typical 7-15 stop tour is seconds either way.
readonly PARALLEL=4
readonly START_COLOR="#2a9d2a"
readonly STOP_COLOR="#e11"
readonly ROUTE_COLOR="#1a73e8"
readonly COSTINGS="auto bicycle pedestrian truck motorcycle bus taxi motor_scooter"

usage_text() {
  cat <<'USAGE'
usage: route.sh --from LAT,LON --costing MODE --stops FILE [--end LAT,LON] [--by time|length] [--lang CODE] [--port PORT]
       route.sh --from LAT,LON --costing MODE --to LAT,LON [--via LAT,LON]... [--lang CODE] [--port PORT]

  --from     the start; always the first location
  --costing  auto, bicycle, pedestrian, truck, motorcycle, bus, taxi or motor_scooter
  --stops    a GeoJSON FeatureCollection of points to visit in the best order; the end
             is chosen by trying every stop as the last one unless --end names it
  --end      where the tour finishes (with --stops)
  --by       what the best end minimises: time (default) or length (with --stops)
  --to       the end, with the stops in --via visited in the given order
  --via      a waypoint, in order; repeat the flag for more (with --to)
  --lang     language of the turn-by-turn instructions (default en)
  --port     the port the container publishes (default 4326)

Writes a GeoJSON FeatureCollection to stdout: the route as a LineString, then one Point
per location in visiting order.
USAGE
}

usage() { usage_text >&2; exit 64; }

need() { # flag-name and the remaining arguments
  [ $# -ge 2 ] && [ -n "${2-}" ] || { printf 'route.sh: %s needs a value\n' "$1" >&2; usage; }
}

from=; costing=; stops=; end=; by="time"; to=; lang="en"; port=4326
vias=()
while [ $# -gt 0 ]; do
  case "$1" in
    --from) need "$@"; from=$2; shift 2 ;;
    --costing) need "$@"; costing=$2; shift 2 ;;
    --stops) need "$@"; stops=$2; shift 2 ;;
    --end) need "$@"; end=$2; shift 2 ;;
    --by) need "$@"; by=$2; shift 2 ;;
    --to) need "$@"; to=$2; shift 2 ;;
    --via) need "$@"; vias+=("$2"); shift 2 ;;
    --lang) need "$@"; lang=$2; shift 2 ;;
    --port) need "$@"; port=$2; shift 2 ;;
    -h|--help) usage_text; exit 0 ;;
    *) printf 'route.sh: unknown argument %s\n' "$1" >&2; usage ;;
  esac
done
[ -n "$from" ] && [ -n "$costing" ] || usage
# The two forms are exclusive: a set of stops is ordered by the engine, an end with
# waypoints is ordered by the request. Mixing them has no meaning.
if [ -n "$stops" ] && [ -n "$to" ]; then printf 'route.sh: --stops and --to are exclusive\n' >&2; exit 64; fi
if [ -z "$stops" ] && [ -z "$to" ]; then printf 'route.sh: one of --stops or --to is required\n' >&2; exit 64; fi
if [ -n "$to" ] && { [ -n "$end" ] || [ "$by" != time ]; }; then printf 'route.sh: --end and --by go with --stops\n' >&2; exit 64; fi
if [ -n "$stops" ] && [ "${#vias[@]}" -gt 0 ]; then printf 'route.sh: --via goes with --to\n' >&2; exit 64; fi
case " $COSTINGS " in *" $costing "*) ;; *) printf 'route.sh: --costing must be one of: %s; got %s\n' "$COSTINGS" "$costing" >&2; exit 64 ;; esac
case "$by" in time|length) ;; *) printf 'route.sh: --by must be time or length, got %s\n' "$by" >&2; exit 64 ;; esac

numeric() { awk -v v="${1-}" 'BEGIN{ exit !(v ~ /^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$/) }'; }
inrange() { awk -v v="$1" -v lo="$2" -v hi="$3" 'BEGIN{ exit !(v >= lo && v <= hi) }'; }

# point FLAG "LAT,LON" NAME -> a location object on stdout, or a usage exit.
point() {
  local lat=${2%%,*} lon=${2#*,}
  [ "$lat" != "$2" ] || { printf 'route.sh: %s must be LAT,LON, got %s\n' "$1" "$2" >&2; exit 64; }
  if ! numeric "$lat" || ! numeric "$lon"; then printf 'route.sh: %s must be LAT,LON with two numbers, got %s\n' "$1" "$2" >&2; exit 64; fi
  inrange "$lat" -90 90   || { printf 'route.sh: %s latitude must be between -90 and 90, got %s\n' "$1" "$lat" >&2; exit 64; }
  inrange "$lon" -180 180 || { printf 'route.sh: %s longitude must be between -180 and 180, got %s\n' "$1" "$lon" >&2; exit 64; }
  jq -nc --argjson lat "$lat" --argjson lon "$lon" --arg name "$3" '{lat: $lat, lon: $lon, name: $name}'
}

numeric "$port" || { printf 'route.sh: --port must be a number, got %s\n' "$port" >&2; exit 64; }
inrange "$port" 1 65535 || { printf 'route.sh: --port must be between 1 and 65535, got %s\n' "$port" >&2; exit 64; }

readonly base="http://localhost:$port/valhalla"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# The start is location 0 everywhere. Every other location is an entry of $middle
# (visited in the engine's order, or the request's) or the fixed end, when there is one.
start=$(point --from "$from" start)
middle="$work/middle.json"   # array of {lat, lon, name, input_index}
fixed_end=

if [ -n "$stops" ]; then
  [ -r "$stops" ] || { printf 'route.sh: cannot read %s\n' "$stops" >&2; exit 65; }
  # Only a FeatureCollection of points is a list of stops. A line or a polygon has no
  # single place to stop at, and anything else is not the file nearby.sh writes.
  if ! jq -e 'type == "object" and .type == "FeatureCollection" and (.features | type == "array")
              and all(.features[]; .geometry.type == "Point" and (.geometry.coordinates | length) >= 2 and ((.properties // {}) | type == "object"))' \
       "$stops" > /dev/null 2>&1; then
    printf 'route.sh: %s is not a GeoJSON FeatureCollection of Point features\n' "$stops" >&2; exit 65
  fi
  jq -c '[.features | to_entries[] | {lat: .value.geometry.coordinates[1], lon: .value.geometry.coordinates[0],
          name: (.value.properties.name // "stop \(.key + 1)"), input_index: .key}]' "$stops" > "$middle"
  [ -n "$end" ] && fixed_end=$(point --end "$end" end)
else
  # Each waypoint is validated in this shell, not in a pipeline stage: a usage exit
  # inside a stage ends the stage, and the script would carry on with half an array.
  : > "$work/vias.jsonl"
  if [ "${#vias[@]}" -gt 0 ]; then
    for i in "${!vias[@]}"; do
      point --via "${vias[$i]}" "via $((i + 1))" >> "$work/vias.jsonl"
    done
  fi
  jq -sc '.' "$work/vias.jsonl" > "$middle"
  fixed_end=$(point --to "$to" end)
fi

n_middle=$(jq 'length' "$middle")
if [ -n "$stops" ] && [ "$n_middle" -eq 0 ]; then printf 'route.sh: %s holds no features to visit\n' "$stops" >&2; exit 65; fi
if [ -n "$fixed_end" ]; then total=$((2 + n_middle)); else total=$((1 + n_middle)); fi
if [ "$total" -gt "$MAX_LOCATIONS" ]; then
  printf 'route.sh: %s locations including the start, and the engine takes at most %s in one optimized route. Narrow the search or pick a subset; nothing was trimmed.\n' "$total" "$MAX_LOCATIONS" >&2
  exit 65
fi

# request ENDPOINT LOCATIONS-JSON -> writes the body to $3 and the HTTP status to $3.status.
# A status of 000 means the container could not be reached. The OSRM-compatible answer
# is asked for because it is the one that honours shape_format: in the engine's own JSON
# format the shape is always an encoded polyline.
request() {
  local body
  body=$(jq -nc --argjson locs "$2" --arg costing "$costing" --arg lang "$lang" --argjson cutoff "$SEARCH_CUTOFF_M" '{
    locations: ($locs | map({lat, lon, search_cutoff: $cutoff})),
    costing: $costing, language: $lang, format: "osrm", shape_format: "geojson"}')
  if ! curl -s --max-time 120 -o "$3" -w '%{http_code}' -H 'Content-Type: application/json' \
        "$base/$1" --data-binary "$body" > "$3.status"; then
    # 000 is curl's own "no answer" status; a background call cannot stop the script, so
    # the status it leaves behind has to.
    printf '000' > "$3.status"
    return 69
  fi
}

unreachable() {
  printf 'route.sh: cannot reach %s - is the container running? try: curl -sf localhost:%s/healthz\n' "$base" "$port" >&2
  exit 69
}

# Every candidate is a file: $work/cand-K.json with its locations in $work/cand-K.locs.
if [ -n "$fixed_end" ]; then
  jq -c --argjson s "$start" --argjson e "$fixed_end" '[$s] + . + [$e]' "$middle" > "$work/cand-0.locs"
  if [ -n "$stops" ]; then endpoint=optimized_route; else endpoint=route; fi
  request "$endpoint" "$(cat "$work/cand-0.locs")" "$work/cand-0.json" || unreachable
  ends_tried=1
else
  endpoint=optimized_route
  inflight=0
  for k in $(seq 0 $((n_middle - 1))); do
    jq -c --argjson s "$start" --argjson k "$k" '[$s] + [to_entries[] | select(.key != $k) | .value] + [.[$k]]' "$middle" > "$work/cand-$k.locs"
    request "$endpoint" "$(cat "$work/cand-$k.locs")" "$work/cand-$k.json" &
    inflight=$((inflight + 1))
    if [ "$inflight" -ge "$PARALLEL" ]; then wait; inflight=0; fi
  done
  wait
  # The sweep ran in the background, where an exit cannot stop the script; the status
  # a call left behind can.
  if grep -qsx 000 "$work"/cand-*.json.status; then unreachable; fi
  ends_tried=$n_middle
fi

# A refusal on the whole set names no location. Each stop is probed alone against the
# start; the ones that fail are the answer, and choosing which to drop is the user's.
probe_and_report() { # failing-status failing-body
  local code
  code=$(jq -r '.code // empty' "$2" 2>/dev/null || true)
  case "$code" in
    NoRoute|NoSegment) ;;
    *) printf 'route.sh: the engine answered HTTP %s%s - check --from, --costing and the locations\n' "$1" "${code:+ ($code: $(jq -r '.message // ""' "$2"))}" >&2; exit 65 ;;
  esac
  local bad=0 i
  jq -c --argjson e "${fixed_end:-null}" '. + (if $e then [$e + {input_index: "-"}] else [] end) | .[]' "$middle" > "$work/probe.list"
  i=0
  while IFS= read -r loc; do
    request route "$(jq -nc --argjson s "$start" --argjson l "$loc" '[$s, $l]')" "$work/probe-$i.json" || unreachable
    if [ "$(cat "$work/probe-$i.json.status")" != "200" ]; then
      printf '%s\t%s\t%s\n' "$(jq -r '.input_index // "-"' <<<"$loc")" "$(jq -r '.code // "HTTP"' "$work/probe-$i.json")" "$(jq -r '.name' <<<"$loc")" >&2
      bad=$((bad + 1))
    fi
    i=$((i + 1))
  done < "$work/probe.list"
  if [ "$bad" -gt 0 ]; then
    printf 'route.sh: %s location(s) above cannot be routed from the start (index, engine code, name). Remove them and run again.\n' "$bad" >&2
    exit 75
  fi
  printf 'route.sh: the engine refused the set (%s) but every location routes from the start on its own\n' "$code" >&2
  exit 65
}

# Pick the winner among the candidates that answered; on none, diagnose the first refusal.
best=
for f in "$work"/cand-*.json; do
  [ "$(cat "$f.status")" = "200" ] || continue
  if [ -z "$best" ]; then best=$f; continue; fi
  if jq -e --slurpfile b "$best" --arg by "$by" \
        '(if $by == "time" then .routes[0].duration else .routes[0].distance end) <
         (if $by == "time" then $b[0].routes[0].duration else $b[0].routes[0].distance end)' "$f" > /dev/null; then
    best=$f
  fi
done
if [ -z "$best" ]; then
  first="$work/cand-0.json"
  probe_and_report "$(cat "$first.status")" "$first"
fi

jq -c --slurpfile locs "${best%.json}.locs" --arg costing "$costing" --arg by "$by" --argjson tried "$ends_tried" \
   --arg start_color "$START_COLOR" --arg stop_color "$STOP_COLOR" --arg route_color "$ROUTE_COLOR" '
  .routes[0] as $r
  | [ .waypoints | to_entries[]
      | {i: .key, pos: (.value.waypoint_index // .key), snapped_m: .value.distance} ] as $wp
  | {type: "FeatureCollection", features: (
      [{type: "Feature", geometry: $r.geometry,
        properties: {kind: "route", costing: $costing, by: $by, ends_tried: $tried,
                     time_s: $r.duration, length_m: $r.distance, color: $route_color}}]
      + ($wp | sort_by(.pos) | map(
          . as $w | $locs[0][$w.i] as $l
          | {type: "Feature", geometry: {type: "Point", coordinates: [$l.lon, $l.lat]},
             properties: ({kind: "stop", order: $w.pos, label: ($w.pos | tostring), name: $l.name,
                           input_index: $l.input_index, snapped_m: $w.snapped_m,
                           color: (if $w.pos == 0 then $start_color else $stop_color end)}
                          + (if $w.pos > 0 then $r.legs[$w.pos - 1] | {leg_time_s: .duration, leg_length_m: .distance,
                               instructions: [.steps[].maneuver.instruction]} else {} end))}))) }' "$best" > "$work/out.json"

# The summary and the far-snap warnings go to stderr so stdout stays one JSON document.
jq -r --argjson far "$FAR_SNAP_M" '
  (.features[] | select(.properties.kind == "route") | .properties) as $r
  | (.features | map(select(.properties.kind == "stop"))) as $stops
  | "route.sh: \($stops | length - 1) stop(s), \($r.time_s / 60 | round) min, \($r.length_m / 1000 * 10 | round / 10) km by \($r.costing); ends tried: \($r.ends_tried); finishes at: \($stops[-1].properties.name)",
    ($stops[] | select(.properties.snapped_m > $far) | .properties
      | "route.sh: stop \(.order) (\(.name)) snapped \(.snapped_m | round) m from where it was asked - check that the point is where the road is")' \
  "$work/out.json" >&2

cat "$work/out.json"
