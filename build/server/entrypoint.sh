#!/bin/bash
set -euo pipefail

# Martin serves the style to browsers, which need absolute URLs on a host THEY can reach
# (PUBLIC_URL), while Martin's own static-image renderer fetches the style's source URLs
# over real HTTP from inside the container, where only localhost is guaranteed to
# resolve. One template, two rendered styles: bright (clients) and bright-local (the
# renderer). A request for a rendered image under bright is rewritten to bright-local by
# the gateway below, so callers only ever need to know about bright.
PIDS=()

# Kills whatever is already running. Safe to call twice and safe to call before any
# process has started.
shutdown() {
  [[ ${#PIDS[@]} -gt 0 ]] || return 0
  kill "${PIDS[@]}" 2>/dev/null
  wait "${PIDS[@]}" 2>/dev/null
}

# Registered BEFORE the first background launch on purpose: a SIGTERM arriving between
# two launches would otherwise find no handler, and every process started so far would
# outlive the container.
trap shutdown SIGTERM SIGINT

PUBLIC_URL="${PUBLIC_URL:-http://localhost:4326/martin}"
mkdir -p /tmp/martin/styles
# Not shell-escaped: a PUBLIC_URL containing &, | or \ would silently corrupt the
# rendered style JSON, since those are all sed replacement-text metacharacters.
sed "s|__PUBLIC_URL__|${PUBLIC_URL}|g" /data/styles/bright.json.tmpl > /tmp/martin/styles/bright.json
sed "s|__PUBLIC_URL__|http://localhost:3000|g" /data/styles/bright.json.tmpl > /tmp/martin/styles/bright-local.json

valhalla_service /data/valhalla.json &
PIDS+=($!)

java -jar /opt/photon.jar serve \
  -listen-ip 127.0.0.1 -listen-port 2322 \
  -data-dir /data/photon &
PIDS+=($!)

# MARTIN_POSTGRES optionally plugs a live PostGIS database in as an extra tile source
# (tables with geometry are auto-discovered and served as /{table}/{z}/{x}/{y}). Martin
# refuses a config file combined with a positional connection string, so the connection
# is appended to a writable copy of the config instead. Sprites and the web UI ride on
# CLI flags because the config file schema for them is less stable than the flags.
MARTIN_CONFIG=/data/martin.yaml
if [[ -n "${MARTIN_POSTGRES:-}" ]]; then
  MARTIN_CONFIG=/tmp/martin/martin.yaml
  cp /data/martin.yaml "$MARTIN_CONFIG"
  printf 'postgres:\n  connection_string: "%s"\n' "${MARTIN_POSTGRES}" >> "$MARTIN_CONFIG"
fi

martin --config "$MARTIN_CONFIG" \
  --listen-addresses 127.0.0.1:3000 \
  --sprite /data/sprites/bright \
  --webui enable-for-all &
PIDS+=($!)

# The published port: the explorer, the three prefixes and /healthz all come from here,
# and the engines above listen on loopback only. Its death makes the container
# unreachable rather than degraded, so it belongs in the set that ends the container.
gateway &
PIDS+=($!)

set +e
wait -n "${PIDS[@]}"
EXIT_CODE=$?

shutdown

exit $EXIT_CODE
