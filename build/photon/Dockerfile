FROM eclipse-temurin:21-jre

ADD --checksum=sha256:6ea66d598a3f6fc1b59b0f81ad4f8abee72ccdb9d3db03bc12008974cdebd58d \
    https://github.com/komoot/photon/releases/download/1.2.1/photon-1.2.1.jar /opt/photon.jar

COPY --chmod=755 build-photon.sh /usr/local/bin/build-photon.sh

VOLUME ["/artifacts"]

ENTRYPOINT ["build-photon.sh"]
