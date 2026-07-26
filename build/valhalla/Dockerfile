FROM ghcr.io/valhalla/valhalla:3.8.3

COPY --chmod=755 build-valhalla.sh /usr/local/bin/build-valhalla.sh
# The slug table lives at build/pbf-slugs.txt, one level above this build context, so it
# is staged into the context for the duration of the build. Build this image with
# `make build-valhalla-builder` - a bare `docker build ./build/valhalla` cannot see it.
COPY pbf-slugs.txt /usr/local/share/getmapstack/pbf-slugs.txt

VOLUME ["/artifacts"]

ENTRYPOINT ["build-valhalla.sh"]
