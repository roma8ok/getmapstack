FROM eclipse-temurin:21-jre

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    zstd \
  && rm -rf /var/lib/apt/lists/*

ADD --checksum=sha256:b2eaad11add95aad149d1e72e67a4df5f6694e725ac5363793a912c5b3e3a7df \
    https://github.com/komoot/photon/releases/download/1.0.0/photon-1.0.0.jar /opt/photon.jar

COPY --chmod=755 build-photon.sh /usr/local/bin/build-photon.sh

VOLUME ["/artifacts"]

ENTRYPOINT ["build-photon.sh"]
