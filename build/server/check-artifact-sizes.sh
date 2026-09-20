#!/bin/sh
# Fails the server-image build before docker runs when a /data layer component would
# exceed the registry's 10 GB compressed-layer limit. Fast path: a component at or
# under the raw limit cannot compress past it (gzip output never meaningfully exceeds
# its input), so only oversized components pay for a real compression pass. The 0.2 GB
# margin under the registry's 10 GB covers the gap between what this script measures
# and what the image builder actually writes: measured on the first component large
# enough to take the slow path, the two agreed to 0.14 percent (7.03 GB here against a
# 7.04 GB layer in the registry), so the margin is roughly fourteen times the observed
# error. A component landing in the last 0.2 GB is not worth shipping anyway - it would
# outgrow the cap within a rebuild or two.
#
# --photon-shards TAR judges the geocoding index shard by shard instead of as one
# component, for an image that ships one layer per shard. Shard sizes come from the
# tar's listing, so nothing is extracted; only a shard over the raw limit is streamed
# out of the tar and compressed. The index has to be a single one holding shards 0-4,
# the layout the image ships a layer for; the build's own index step checks the same
# thing, but only after it has extracted a multi-GB tar, so this catches it first.
#
# --tiles-parts N TILES judges the vector tile archive as the N equal byte ranges that
# `split -n N` cuts it into, for an image that ships one layer per part. Each part is at
# most ceil(size / N) bytes; only a part over the raw limit is read and compressed.
#
# Usage: check-artifact-sizes.sh [--photon-shards TAR] [--tiles-parts N TILES] FILE...
# Exit:  0 all components fit, 1 a component is over the limit, 2 a file is missing,
#        failed to compress, an option is malformed, or the index is not the single
#        five-shard index the shard mode expects.
set -eu

RAW_LIMIT=${GUARD_RAW_LIMIT:-9800000000} # 9.8 GB
GZ_LIMIT=${GUARD_GZ_LIMIT:-9800000000}   # 9.8 GB
if command -v pigz >/dev/null 2>&1; then GZIP_CMD=pigz; else GZIP_CMD=gzip; fi

fmt() { awk -v b="$1" 'BEGIN { printf "%.2f GB", b / 1000000000 }'; }

photon_tar=""
tiles_file=""
tiles_parts=""
while [ $# -gt 0 ]; do
  case $1 in
    --photon-shards)
      if [ $# -lt 2 ]; then
        echo "layer guard: --photon-shards needs the index tar" >&2
        exit 2
      fi
      photon_tar=$2
      shift 2
      ;;
    --tiles-parts)
      if [ $# -lt 3 ]; then
        echo "layer guard: --tiles-parts needs a part count and the tiles file" >&2
        exit 2
      fi
      case $2 in
        '' | *[!0-9]* | 0*)
          echo "layer guard: --tiles-parts needs a positive part count, got '$2'" >&2
          exit 2
          ;;
      esac
      tiles_parts=$2
      tiles_file=$3
      shift 3
      ;;
    *) break ;;
  esac
done
# Unquoted on purpose: collapses the gaps an unused option leaves. The staged paths
# contain no spaces.
# shellcheck disable=SC2086
staged=$(echo $photon_tar $tiles_file "$@")

status=0

# judge LABEL RAW PRODUCER...: LABEL fits outright when RAW is within the raw limit.
# Otherwise PRODUCER's stdout is compressed and measured. A breach sets status=1 and
# carries on, so every component is reported; a failing producer or compressor exits 2,
# because a size that was never measured must not read as "fits".
judge() {
  label=$1
  raw=$2
  shift 2
  if [ "$raw" -le "$RAW_LIMIT" ]; then
    echo "layer guard: $label raw $(fmt "$raw") - fits"
    return 0
  fi
  echo "layer guard: $label raw $(fmt "$raw") - measuring with $GZIP_CMD..."
  err=$(mktemp)
  gz=$( { { "$@" || echo x > "$err"; } | "$GZIP_CMD" -c || echo x > "$err"; } | wc -c | tr -d ' ')
  if [ -s "$err" ]; then
    rm -f "$err"
    echo "layer guard: compression of $label failed" >&2
    exit 2
  fi
  rm -f "$err"
  if [ "$gz" -gt "$GZ_LIMIT" ]; then
    echo "layer guard: $label compresses to $(fmt "$gz"), over the $(fmt "$GZ_LIMIT") limit" >&2
    echo "layer guard: this component cannot ship as one image layer; it needs file-level bin-packing across several layers" >&2
    echo "layer guard: staged files remaining on disk (not cleaned up automatically): $staged" >&2
    status=1
  else
    echo "layer guard: $label compresses to $(fmt "$gz") - fits"
  fi
}

if [ -n "$photon_tar" ]; then
  if [ ! -f "$photon_tar" ]; then
    echo "layer guard: missing $photon_tar" >&2
    exit 2
  fi
  # The listing's size column depends on the tar at hand: GNU tar prints
  # "perms owner/group SIZE date time name", bsdtar "perms links owner group SIZE ...".
  case "$(tar --version 2>/dev/null | head -1)" in
    *"GNU tar"*) size_col=3 ;;
    *bsdtar*)    size_col=5 ;;
    *)
      echo "layer guard: unrecognised tar, cannot read sizes from its listing" >&2
      exit 2
      ;;
  esac
  list=$(mktemp)
  # One line per shard: "<shard> <bytes> <path of the shard directory inside the tar>".
  # A shard is a numerically named directory two levels under "indices"; its sibling
  # _state is not one. Index file names contain no spaces, so the name is the last field.
  # The clash check counts distinct index directory names (p[i + 1]), not shard numbers:
  # two indexes with disjoint shard sets (one holding shard 0, the other shards 1-4)
  # never repeat a shard number, so a check keyed by shard number alone would miss them.
  tar -tvf "$photon_tar" | awk -v col="$size_col" '
    substr($1, 1, 1) == "-" {
      n = split($NF, p, "/")
      for (i = 1; i + 3 <= n; i++)
        if (p[i] == "indices" && p[i + 2] ~ /^[0-9]+$/) {
          s = p[i + 2]
          prefix = p[1]
          for (j = 2; j <= i + 2; j++) prefix = prefix "/" p[j]
          indexes[p[i + 1]] = 1
          seen[s] = prefix
          sum[s] += $col
          break
        }
    }
    END {
      nidx = 0
      for (x in indexes) nidx++
      if (nidx > 1) { print "clash"; exit }
      for (s in sum) printf "%s %.0f %s\n", s, sum[s], seen[s]
    }' | sort -n > "$list"
  if grep -q '^clash' "$list"; then
    rm -f "$list"
    echo "layer guard: $photon_tar holds more than one index; one layer per shard assumes a single index" >&2
    exit 2
  fi
  if [ ! -s "$list" ]; then
    rm -f "$list"
    echo "layer guard: no shard directories in $photon_tar - not a geocoding index?" >&2
    exit 2
  fi
  # The list is sorted numerically, so its first column is the shard set in order. The
  # image ships one layer per shard and that set is fixed at 0-4, the shape every photon
  # index has whatever the country's size. Any other set would leave a shard with no
  # layer of its own, riding into the remainder layer unnoticed.
  found=$(cut -d' ' -f1 "$list" | tr '\n' ' ')
  if [ "$found" != "0 1 2 3 4 " ]; then
    rm -f "$list"
    echo "layer guard: $photon_tar holds shard directories ${found% } - one layer per shard expects exactly 0 1 2 3 4" >&2
    exit 2
  fi
  while read -r shard raw prefix; do
    judge "photon shard $shard" "$raw" tar -xOf "$photon_tar" "$prefix"
  done < "$list"
  rm -f "$list"
fi

# byte_range FILE OFFSET LENGTH writes LENGTH bytes of FILE starting at OFFSET. tail and
# head accept these options on macOS and GNU alike; dd's byte-exact flags are GNU-only.
# POSIX sh has no pipefail, so judge's own failure check sees only head's exit status,
# not tail's - a tail that dies mid-read while head still exits cleanly on the resulting
# short input would let a truncated part compress and get reported as a real measurement.
# tail therefore records its own exit status to a flag file across the pipe, checked once
# the pipe finishes; the recording runs from a "||" clause, not a plain ";" sequel, so
# a failing tail does not trip this script's own "set -e" before the status is captured.
# Status 141 (128 + SIGPIPE) is expected, not a failure: head closes its end of the pipe
# once it has LENGTH bytes, which is the normal case for every part but the last, and the
# kernel then kills tail with SIGPIPE the next time it writes. Any other non-zero tail
# status, or a non-zero head status, is a real read failure.
byte_range() {
  flag=$(mktemp)
  { tail -c +"$(($2 + 1))" "$1" || { ts=$?; [ "$ts" -eq 141 ] || echo x > "$flag"; }; } | head -c "$3"
  hs=$?
  bad=0
  [ -s "$flag" ] && bad=1
  rm -f "$flag"
  [ "$hs" -eq 0 ] && [ "$bad" -eq 0 ]
}

if [ -n "$tiles_file" ]; then
  if [ ! -f "$tiles_file" ]; then
    echo "layer guard: missing $tiles_file" >&2
    exit 2
  fi
  total=$(wc -c < "$tiles_file" | tr -d ' ')
  # split -n N hands any remainder to the first parts, so every part is at most
  # ceil(total / N) bytes and cutting at that stride reproduces its parts for N = 2.
  stride=$(( (total + tiles_parts - 1) / tiles_parts ))
  i=0
  while [ "$i" -lt "$tiles_parts" ]; do
    off=$((i * stride))
    len=$stride
    if [ $((off + len)) -gt "$total" ]; then len=$((total - off)); fi
    if [ "$len" -lt 0 ]; then len=0; fi
    judge "tiles part $i" "$len" byte_range "$tiles_file" "$off" "$len"
    i=$((i + 1))
  done
fi

for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "layer guard: missing $f" >&2
    exit 2
  fi
  raw=$(wc -c < "$f" | tr -d ' ')
  judge "$(basename "$f")" "$raw" cat "$f"
done
exit $status
