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
# Usage: check-artifact-sizes.sh FILE...
# Exit:  0 all components fit, 1 a component is over the limit, 2 a file is missing or
#        failed to compress.
set -eu

RAW_LIMIT=${GUARD_RAW_LIMIT:-9800000000} # 9.8 GB
GZ_LIMIT=${GUARD_GZ_LIMIT:-9800000000}   # 9.8 GB

fmt() { awk -v b="$1" 'BEGIN { printf "%.2f GB", b / 1000000000 }'; }

status=0
for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "layer guard: missing $f" >&2
    exit 2
  fi
  raw=$(wc -c < "$f" | tr -d ' ')
  if [ "$raw" -le "$RAW_LIMIT" ]; then
    echo "layer guard: $(basename "$f") raw $(fmt "$raw") - fits"
    continue
  fi
  if command -v pigz >/dev/null 2>&1; then GZIP_CMD=pigz; else GZIP_CMD=gzip; fi
  echo "layer guard: $(basename "$f") raw $(fmt "$raw") - measuring with $GZIP_CMD..."
  err=$(mktemp)
  gz=$( { "$GZIP_CMD" -c < "$f" || echo x > "$err"; } | wc -c | tr -d ' ')
  if [ -s "$err" ]; then
    rm -f "$err"
    echo "layer guard: compression of $f failed" >&2
    exit 2
  fi
  rm -f "$err"
  if [ "$gz" -gt "$GZ_LIMIT" ]; then
    echo "layer guard: $(basename "$f") compresses to $(fmt "$gz"), over the $(fmt "$GZ_LIMIT") limit" >&2
    echo "layer guard: this component cannot ship as one image layer; it needs file-level bin-packing across several layers" >&2
    echo "layer guard: staged files remaining on disk (not cleaned up automatically): $*" >&2
    status=1
  else
    echo "layer guard: $(basename "$f") compresses to $(fmt "$gz") - fits"
  fi
done
exit $status
