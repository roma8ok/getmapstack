FROM ghcr.io/onthegomap/planetiler:0.10.2

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --chmod=755 build-planetiler.sh /usr/local/bin/build-planetiler.sh
# The slug table lives at build/pbf-slugs.txt, one level above this build context, so it
# is staged into the context for the duration of the build. Build this image with
# `make build-planetiler-builder` - a bare `docker build ./build/planetiler` cannot see it.
COPY pbf-slugs.txt /usr/local/share/getmapstack/pbf-slugs.txt

VOLUME ["/artifacts"]

ENTRYPOINT ["build-planetiler.sh"]
