FROM ghcr.io/valhalla/valhalla:3.6.3 AS valhalla

# Collect valhalla_service and all its shared libs into /deps
RUN mkdir -p /deps/bin /deps/lib && \
    cp /usr/local/bin/valhalla_service /deps/bin/ && \
    for lib in $(ldd /usr/local/bin/valhalla_service | grep -v 'not found' | awk '/=>/ {print $3}'); do \
        cp "$lib" /deps/lib/; \
    done

# Runs natively on the build host ($BUILDPLATFORM) so the multi-GB tar
# extraction is never QEMU-emulated. The complete /data content is assembled
# here and lands in the final stage as ONE layer: the single COPY creates
# /data from scratch, stamping it with a deterministic mtime from this
# shared stage, so both platforms produce an identical, registry-deduplicated
# layer. Never add a second COPY into /data in the final stage - adding
# entries to an existing /data bumps its mtime with build wall-clock time
# and forks the layer per platform.
FROM --platform=$BUILDPLATFORM ubuntu:24.04 AS data

RUN --mount=type=bind,source=photon-data.tar,target=/tmp/photon-data.tar \
    mkdir -p /out/photon && tar -xf /tmp/photon-data.tar -C /out/photon
COPY valhalla.tar /out/valhalla.tar
COPY valhalla.json /out/valhalla.json

FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jre-headless \
    curl \
  && rm -rf /var/lib/apt/lists/*

ENV JAVA_TOOL_OPTIONS="-Xmx1g"

# Valhalla binary and all runtime libs
COPY --from=valhalla /deps/bin/valhalla_service /usr/local/bin/valhalla_service
COPY --from=valhalla /deps/lib/ /usr/local/lib/valhalla-deps/

# Ensure the dynamic linker can find the copied libs
RUN echo "/usr/local/lib/valhalla-deps" > /etc/ld.so.conf.d/00-valhalla.conf && ldconfig
RUN ! ldd /usr/local/bin/valhalla_service | grep -q 'not found'

ADD --checksum=sha256:b2eaad11add95aad149d1e72e67a4df5f6694e725ac5363793a912c5b3e3a7df --chmod=644 \
    https://github.com/komoot/photon/releases/download/1.0.0/photon-1.0.0.jar /opt/photon.jar

RUN groupadd -r getmapstack && useradd -r -g getmapstack -d /data -s /sbin/nologin getmapstack

COPY --from=data --chown=getmapstack:getmapstack /out /data

COPY --chmod=755 entrypoint.sh /entrypoint.sh
USER getmapstack

LABEL org.opencontainers.image.source="https://github.com/roma8ok/getmapstack"

EXPOSE 8002 2322

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD curl -sf http://localhost:8002/status && curl -sf http://localhost:2322/status || exit 1

ENTRYPOINT ["/entrypoint.sh"]
