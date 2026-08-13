ARG TARGETARCH

FROM ghcr.io/valhalla/valhalla:3.8.3 AS valhalla

# Collect valhalla_service, its shared libs, and their license texts into /deps.
# dpkg -S needs realpath (merged-/usr: ldd prints /lib/..., dpkg records
# /usr/lib/...) and the arch qualifier stripped (libc6:arm64 -> libc6).
# Only libprime_server.so.0 has no dpkg owner; its license ships in
# THIRD_PARTY_LICENSES. Any other unowned lib fails the build.
RUN mkdir -p /deps/bin /deps/lib /deps/doc/valhalla && \
    cp /usr/local/bin/valhalla_service /deps/bin/ && \
    cp /usr/local/share/doc/valhalla/COPYING /deps/doc/valhalla/COPYING && \
    for lib in $(ldd /usr/local/bin/valhalla_service | grep -v 'not found' | awk '/=>/ {print $3}'); do \
        cp "$lib" /deps/lib/; \
        pkg=$(dpkg -S "$(realpath "$lib")" 2>/dev/null | cut -d: -f1); \
        if [ -n "$pkg" ]; then \
            mkdir -p "/deps/doc/$pkg"; \
            cp "/usr/share/doc/$pkg/copyright" "/deps/doc/$pkg/copyright" || { echo "ERROR: no copyright file for $pkg" >&2; exit 1; }; \
        else \
            case "$(basename "$lib")" in \
                libprime_server*) ;; \
                *) echo "ERROR: $lib has no dpkg owner and no THIRD_PARTY_LICENSES entry" >&2; exit 1 ;; \
            esac; \
        fi; \
    done

# Martin (tiles/glyphs/sprites/styles/static-images server). The gnu build is required:
# the musl release binary is compiled WITHOUT style rendering support and silently
# ignores the rendering config key. Checksums differ per arch, so each arch gets its own
# fetch stage and TARGETARCH picks one.
FROM ubuntu:24.04 AS martin-fetch-amd64
ADD --checksum=sha256:6fb5c5e1aff7d79b0eeb2b8d43bde6337a3440a704d10ebaaaf9a74dccd29abc \
    https://github.com/maplibre/martin/releases/download/martin-v1.13.0/martin-x86_64-unknown-linux-gnu.tar.gz /tmp/martin.tar.gz

FROM ubuntu:24.04 AS martin-fetch-arm64
ADD --checksum=sha256:c91de2db460ef7bece33e6bc67dbdd6b05d161242025c69ece19f3efc8d80af8 \
    https://github.com/maplibre/martin/releases/download/martin-v1.13.0/martin-aarch64-unknown-linux-gnu.tar.gz /tmp/martin.tar.gz

FROM martin-fetch-${TARGETARCH} AS martin-fetch
RUN mkdir -p /out && tar -xzf /tmp/martin.tar.gz -C /out martin

FROM --platform=$BUILDPLATFORM golang:1.26 AS gateway-build
ARG TARGETARCH
WORKDIR /src
COPY gateway/ ./
# Go ships no precompiled standard library, so without the cache mount every cold run of
# this stage recompiles net/http and its dependencies from scratch - once per target
# platform, and again after any edit under gateway/.
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build -ldflags="-s -w" -o /out/gateway .

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
COPY ATTRIBUTION.txt /out/ATTRIBUTION.txt

# Map assets: fonts (Martin cuts glyph PBFs from these at request time), sprite SVG
# sources, and the style template (rendered by the entrypoint - see entrypoint.sh).
ADD --checksum=sha256:0c34df072a3fa7efbb7cbf34950e1f971a4447cffe365d3a359e2d4089b958f5 \
    https://github.com/notofonts/latin-greek-cyrillic/releases/download/NotoSans-v2.015/NotoSans-v2.015.zip /tmp/notosans.zip
ADD --checksum=sha256:69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68 \
    https://raw.githubusercontent.com/notofonts/noto-cjk/Sans2.004/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf /out/fonts/NotoSansKR-Regular.otf
ADD --checksum=sha256:10e85011008108308e6feab0408242acb07804da61ede3d3ff236461ae07ab1b \
    https://github.com/notofonts/georgian/releases/download/NotoSansGeorgian-v2.005/NotoSansGeorgian-v2.005.zip /tmp/notosansgeorgian.zip
ADD --checksum=sha256:b4bc74bed10eddeb4f4d7137e19d8c8e7894ccdb00e0ee18d0c450a713c4adcf \
    https://codeload.github.com/hyperknot/openfreemap-styles/tar.gz/72e1480dfc92858d334647037988bd2591fdb021 /tmp/bright.tar.gz
ADD --checksum=sha256:0fff84171fdaff48efe3a794a403af6d26598a27986e73e8603c15e37f008712 \
    https://github.com/maplibre/maplibre-gl-js/releases/download/v6.1.0/dist.zip /tmp/maplibre.zip
RUN apt-get update && apt-get install -y --no-install-recommends unzip \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /out/fonts /out/sprites/bright /out/styles \
  && unzip -j /tmp/notosans.zip \
       'NotoSans/hinted/ttf/NotoSans-Regular.ttf' \
       'NotoSans/hinted/ttf/NotoSans-Bold.ttf' \
       'NotoSans/hinted/ttf/NotoSans-Italic.ttf' -d /out/fonts \
  && unzip -j /tmp/notosansgeorgian.zip \
       'NotoSansGeorgian/hinted/ttf/NotoSansGeorgian-Regular.ttf' -d /out/fonts \
  && tar -xzf /tmp/bright.tar.gz -C /tmp \
  # airport_11.svg exists in both icon sets and the two files differ, so the style's own
  # copy has to land last - the order the style's upstream sprite build uses.
  && SRC=/tmp/openfreemap-styles-72e1480dfc92858d334647037988bd2591fdb021 \
  && cp $SRC/styles/liberty/svgs/svgs_iconset/*.svg /out/sprites/bright/ \
  && cp $SRC/styles/liberty/svgs/svgs_not_in_iconset/*.svg /out/sprites/bright/ \
  && cp $SRC/styles/bright/icons_unique/*.svg /out/sprites/bright/ \
  && mkdir -p /out/explorer/vendor \
  && unzip -qj /tmp/maplibre.zip \
       'dist/maplibre-gl.mjs' 'dist/maplibre-gl-shared.mjs' \
       'dist/maplibre-gl-worker.mjs' 'dist/maplibre-gl.css' -d /out/explorer/vendor \
  && mv /out/explorer/vendor/maplibre-gl.mjs /out/explorer/vendor/maplibre-gl.js
COPY tiles.pmtiles /out/tiles.pmtiles
COPY martin.yaml /out/martin.yaml
COPY assets/bright.json.tmpl /out/styles/bright.json.tmpl
COPY explorer/ /out/explorer/
COPY explorer-countries.json /out/explorer/countries.json

FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jre-headless \
    curl \
    libuv1t64 \
    libvulkan1 \
    mesa-vulkan-drivers \
  && rm -rf /var/lib/apt/lists/*

ENV JAVA_TOOL_OPTIONS="-Xmx1g"

# Valhalla binary and all runtime libs
COPY --from=valhalla /deps/bin/valhalla_service /usr/local/bin/valhalla_service
COPY --from=valhalla /deps/lib/ /usr/local/lib/valhalla-deps/

# Ensure the dynamic linker can find the copied libs
RUN echo "/usr/local/lib/valhalla-deps" > /etc/ld.so.conf.d/00-valhalla.conf && ldconfig
RUN ! ldd /usr/local/bin/valhalla_service | grep -q 'not found'

COPY --from=martin-fetch /out/martin /usr/local/bin/martin
COPY --from=gateway-build /out/gateway /usr/local/bin/gateway

ADD --checksum=sha256:6ea66d598a3f6fc1b59b0f81ad4f8abee72ccdb9d3db03bc12008974cdebd58d --chmod=644 \
    https://github.com/komoot/photon/releases/download/1.2.1/photon-1.2.1.jar /opt/photon.jar

RUN groupadd -r getmapstack && useradd -r -g getmapstack -d /data -s /sbin/nologin getmapstack

COPY --from=data --chown=getmapstack:getmapstack /out /data

# Third-party license notices for the cherry-picked binary and libraries
COPY --from=valhalla /deps/doc/ /usr/share/doc/valhalla-deps/
COPY THIRD_PARTY_LICENSES /usr/share/doc/getmapstack/THIRD_PARTY_LICENSES

COPY --chmod=755 entrypoint.sh /entrypoint.sh
USER getmapstack

# The SPDX expression covers everything the image distributes, not just this project's own
# code: map data (ODbL-1.0), the engines and their dependencies, the tile server
# (MIT OR Apache-2.0), the fonts (OFL-1.1) and the map style with its icons (BSD-3-Clause
# code, CC-BY-4.0 design, CC0-1.0 icons). Keep it in step with THIRD_PARTY_LICENSES.
LABEL org.opencontainers.image.source="https://github.com/roma8ok/getmapstack" \
      org.opencontainers.image.licenses="MIT AND Apache-2.0 AND BSD-2-Clause AND BSD-3-Clause AND ODbL-1.0 AND OFL-1.1 AND CC-BY-4.0 AND CC0-1.0 AND (MIT OR Apache-2.0)"

EXPOSE 4326

HEALTHCHECK --interval=30s --timeout=5s --start-period=5m \
  CMD gateway --healthcheck

ENTRYPOINT ["/entrypoint.sh"]
