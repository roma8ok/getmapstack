#!/bin/bash
set -euo pipefail

valhalla_service /data/valhalla.json &
VALHALLA_PID=$!

java -jar /opt/photon.jar serve \
  -listen-ip 0.0.0.0 -listen-port 2322 \
  -data-dir /data/photon -cors-any &
PHOTON_PID=$!

trap 'kill $VALHALLA_PID $PHOTON_PID; wait $VALHALLA_PID $PHOTON_PID' SIGTERM SIGINT

set +e
wait -n $VALHALLA_PID $PHOTON_PID
EXIT_CODE=$?

kill $VALHALLA_PID $PHOTON_PID 2>/dev/null
wait $VALHALLA_PID $PHOTON_PID 2>/dev/null

exit $EXIT_CODE
