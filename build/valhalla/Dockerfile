FROM ghcr.io/valhalla/valhalla:3.6.3

COPY --chmod=755 build-valhalla.sh /usr/local/bin/build-valhalla.sh

VOLUME ["/artifacts"]

ENTRYPOINT ["build-valhalla.sh"]
