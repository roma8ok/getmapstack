#!/usr/bin/env bash
# Reclaim space in artifacts/: routing tiles, geocoding index and vector tiles for
# countries you are done with. Lists by default and deletes only with CONFIRM=1.
#
# Knobs:
#   CONFIRM=1              actually delete (default: list only)
#   KEEP="a b"             never touch these countries
#   ONLY="a b"             restrict to these countries (KEEP still subtracts)
#   ARTIFACTS_DIR=<path>   override the directory (default: <repo>/artifacts)
#
# The OSM download cache (artifacts/osm/) and the shared Planetiler cache
# (artifacts/planetiler-cache/) are never candidates: no pattern here descends into a
# subdirectory. Deleting either turns the next build into a multi-gigabyte re-download.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-$ROOT/artifacts}"
CONFIRM="${CONFIRM:-}"
KEEP="${KEEP:-}"
ONLY="${ONLY:-}"

if [ ! -d "$ARTIFACTS_DIR" ]; then
  echo "Error: $ARTIFACTS_DIR does not exist." >&2
  exit 1
fi

# " a b " membership test - bash 3.2 has no associative arrays.
in_list() {
  case " $2 " in
    *" $1 "*) return 0 ;;
  esac
  return 1
}

INDEX="$(mktemp)"
trap 'rm -f "$INDEX"' EXIT

# country <TAB> bytes <TAB> path, one line per candidate file
for f in "$ARTIFACTS_DIR"/valhalla-*.tar \
         "$ARTIFACTS_DIR"/valhalla-*.json \
         "$ARTIFACTS_DIR"/photon-*.tar \
         "$ARTIFACTS_DIR"/tiles-*.pmtiles; do
  [ -f "$f" ] || continue          # an unmatched glob stays literal; skip it
  base="${f##*/}"
  case "$base" in
    valhalla-*.tar)  country="${base#valhalla-}"; country="${country%.tar}" ;;
    valhalla-*.json) country="${base#valhalla-}"; country="${country%.json}" ;;
    photon-*.tar)    country="${base#photon-}";   country="${country%.tar}" ;;
    tiles-*.pmtiles) country="${base#tiles-}";    country="${country%.pmtiles}" ;;
    *) continue ;;
  esac
  if [ -n "$ONLY" ] && ! in_list "$country" "$ONLY"; then continue; fi
  if in_list "$country" "$KEEP"; then continue; fi
  printf '%s\t%s\t%s\n' "$country" "$(wc -c < "$f" | tr -d ' ')" "$f" >> "$INDEX"
done

if [ ! -s "$INDEX" ]; then
  echo "Nothing to clean in $ARTIFACTS_DIR."
  exit 0
fi

human() {
  awk -v b="$1" 'BEGIN {
    if (b >= 1073741824) printf "%.1f GB", b / 1073741824;
    else if (b >= 1048576) printf "%.1f MB", b / 1048576;
    else if (b >= 1024) printf "%.1f KB", b / 1024;
    else printf "%d B", b;
  }'
}

# One `docker image ls` beats one `inspect` per country (0.76 s against 2.27 s for 58).
# A missing or unreachable daemon degrades to an empty list, and every row reads "-".
# The trailing `|| true` matters under pipefail: without it, a dead daemon's nonzero
# exit from `docker image ls` fails the whole pipeline and kills the script right here,
# before any output - the same class of bug the counting loop below works around.
IMAGES=" $(docker image ls --format '{{.Repository}}' 2>/dev/null \
           | sed -n 's|^getmapstack/||p' | sort -u | tr '\n' ' ' || true)"

# country <TAB> total-bytes, largest first
TOTALS="$(awk -F'\t' '{ sum[$1] += $2 } END { for (c in sum) printf "%s\t%s\n", c, sum[c] }' "$INDEX" \
          | sort -t"$(printf '\t')" -k2,2nr)"

printf '%s\n' "$TOTALS" | while IFS="$(printf '\t')" read -r country bytes; do
  if in_list "$country" "$IMAGES"; then mark="image"; else mark="-"; fi
  printf '%-24s %12s   %s\n' "$country" "$(human "$bytes")" "$mark"
done

count="$(printf '%s\n' "$TOTALS" | wc -l | tr -d ' ')"
total="$(awk -F'\t' '{ sum += $2 } END { print sum + 0 }' "$INDEX")"

# Counted in a plain `for`, not in a pipeline: a piped `while` runs in a subshell and its
# increment would never come back, and `in_list ... && echo` inside one is fatal under
# `set -euo pipefail`. Country slugs never contain spaces, so word splitting is safe here.
with_image=0
for c in $(printf '%s\n' "$TOTALS" | cut -f1); do
  if in_list "$c" "$IMAGES"; then with_image=$((with_image + 1)); fi
done

if [ "$count" = "1" ]; then noun="country"; else noun="countries"; fi
printf '\n%s %s, %s     (%s with a local image, %s without)\n' \
  "$count" "$noun" "$(human "$total")" "$with_image" "$((count - with_image))"

# Artifacts are the small half of the problem: docker usually holds far more. Print what
# the tool says verbatim - `docker system df` and `docker buildx du` report different
# reclaimable figures for the same cache, so restating either as "this frees N GB" would
# be a promise neither of them makes.
if df_out="$(docker system df 2>/dev/null)"; then
  echo
  echo "Docker holds more:"
  printf '%s\n' "$df_out"
  cat <<'HINT'

  docker builder prune -f     drops unused build cache (`docker system df` and
                              `docker buildx du` disagree about how much - run either
                              one to see the current figures)
  docker image prune -f       drops dangling images, safe
  docker image prune -a -f    drops every image no container uses, including country
                              images that may not be pushed yet, and the dated tags that
                              a later `latest` promotion resolves by digest locally
HINT
fi

if [ "$CONFIRM" != "1" ]; then
  echo
  echo "Nothing deleted. Repeat with CONFIRM=1."
  exit 0
fi

echo
freed=0
while IFS="$(printf '\t')" read -r country bytes path; do
  rm -f "$path"
  freed=$((freed + bytes))
done < "$INDEX"
printf 'Deleted %s of artifacts.\n' "$(human "$freed")"
