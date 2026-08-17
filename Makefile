.DEFAULT_GOAL := help

# Optional overrides (e.g. PHOTON_HEAP=12g)
-include .env

# Country → region mapping. The region is Geofabrik's own tree, not geography: Armenia and
# Azerbaijan live under asia while Georgia, their neighbour, lives under europe.
region.afghanistan = asia
region.algeria = africa
region.angola = africa
region.armenia = asia
region.azerbaijan = asia
region.bahrain = asia
region.bangladesh = asia
region.belgium = europe
region.benin = africa
region.bhutan = asia
region.botswana = africa
region.brunei = asia
region.burkina-faso = africa
region.burundi = africa
region.cabo-verde = africa
region.cambodia = asia
region.cameroon = africa
region.central-african-republic = africa
region.chad = africa
region.comoros = africa
region.congo = africa
region.cyprus = europe
region.djibouti = africa
region.dr-congo = africa
region.east-timor = asia
region.egypt = africa
region.equatorial-guinea = africa
region.eritrea = africa
region.eswatini = africa
region.ethiopia = africa
region.gabon = africa
region.gambia = africa
region.georgia = europe
region.ghana = africa
region.guinea = africa
region.guinea-bissau = africa
region.india = asia
region.indonesia = asia
region.iraq = asia
region.israel = asia
region.ivory-coast = africa
region.jordan = asia
region.kazakhstan = asia
region.kenya = africa
region.kuwait = asia
region.kyrgyzstan = asia
region.laos = asia
region.lebanon = asia
region.lesotho = africa
region.liberia = africa
region.libya = africa
region.madagascar = africa
region.malawi = africa
region.malaysia = asia
region.maldives = asia
region.mali = africa
region.mauritania = africa
region.mauritius = africa
region.mongolia = asia
region.morocco = africa
region.mozambique = africa
region.namibia = africa
region.nepal = asia
region.niger = africa
region.nigeria = africa
region.oman = asia
region.pakistan = asia
region.philippines = asia
region.qatar = asia
region.rwanda = africa
region.sao-tome-and-principe = africa
region.saudi-arabia = asia
region.senegal = africa
region.serbia = europe
region.seychelles = africa
region.sierra-leone = africa
region.singapore = asia
region.somalia = africa
region.south-africa = africa
region.south-korea = asia
region.south-sudan = africa
region.sri-lanka = asia
region.sudan = africa
region.tajikistan = asia
region.tanzania = africa
region.thailand = asia
region.togo = africa
region.tunisia = africa
region.turkey = europe
region.turkmenistan = asia
region.uganda = africa
region.united-arab-emirates = asia
region.uzbekistan = asia
region.vietnam = asia
region.zambia = africa
region.zimbabwe = africa

REGION = $(region.$(COUNTRY))

# Country list derived from the region.* mapping above (single source of truth)
empty :=
space := $(empty) $(empty)
comma := ,
AVAILABLE := $(sort $(patsubst region.%,%,$(filter region.%,$(.VARIABLES))))
AVAILABLE_LIST = $(subst $(space),$(comma)$(space),$(AVAILABLE))

PHOTON_HEAP ?= 4g
VALHALLA_CONCURRENCY ?=
# Target platforms for server images; override for single-arch dev builds (e.g. PLATFORMS=linux/arm64)
PLATFORMS ?= linux/amd64,linux/arm64

.PHONY: build-valhalla-builder create-valhalla-tiles build-photon-builder create-photon-data build-planetiler-builder create-vector-tiles build-server test-gateway fetch-osm update-bright-style help

build-valhalla-builder:
	cp build/pbf-slugs.txt build/valhalla/pbf-slugs.txt
	docker build -t getmapstack/valhalla-builder ./build/valhalla
	rm build/valhalla/pbf-slugs.txt

fetch-osm:
ifndef COUNTRY
	$(error COUNTRY is required. Usage: make fetch-osm COUNTRY=cyprus)
endif
ifeq ($(REGION),)
	$(error Unknown country: $(COUNTRY). Available: $(AVAILABLE_LIST))
endif
	./build/fetch-osm.sh --country $(COUNTRY) --region $(REGION)

create-valhalla-tiles:
ifndef COUNTRY
	$(error COUNTRY is required. Usage: make create-valhalla-tiles COUNTRY=cyprus)
endif
ifeq ($(REGION),)
	$(error Unknown country: $(COUNTRY). Available: $(AVAILABLE_LIST))
endif
	mkdir -p artifacts
	docker run --rm -v $(CURDIR)/artifacts:/artifacts getmapstack/valhalla-builder --country $(COUNTRY) --region $(REGION)$(if $(VALHALLA_CONCURRENCY), --concurrency $(VALHALLA_CONCURRENCY))

build-photon-builder:
	docker build -t getmapstack/photon-builder ./build/photon

create-photon-data:
ifndef COUNTRY
	$(error COUNTRY is required. Usage: make create-photon-data COUNTRY=cyprus)
endif
ifeq ($(REGION),)
	$(error Unknown country: $(COUNTRY). Available: $(AVAILABLE_LIST))
endif
	mkdir -p artifacts
	PHOTON_HEAP=$(PHOTON_HEAP) NOMI_SHARED_BUFFERS=$(NOMI_SHARED_BUFFERS) NOMI_MAINTENANCE_WORK_MEM=$(NOMI_MAINTENANCE_WORK_MEM) NOMI_READY_ATTEMPTS=$(NOMI_READY_ATTEMPTS) ./build/photon/run-nominatim-import.sh --country $(COUNTRY) --region $(REGION)

build-planetiler-builder:
	cp build/pbf-slugs.txt build/planetiler/pbf-slugs.txt
	docker build -t getmapstack/planetiler-builder ./build/planetiler
	rm build/planetiler/pbf-slugs.txt

create-vector-tiles:
ifndef COUNTRY
	$(error COUNTRY is required. Usage: make create-vector-tiles COUNTRY=cyprus)
endif
ifeq ($(REGION),)
	$(error Unknown country: $(COUNTRY). Available: $(AVAILABLE_LIST))
endif
	mkdir -p artifacts
	docker run --rm -v $(CURDIR)/artifacts:/artifacts$(if $(PLANETILER_HEAP), -e JAVA_TOOL_OPTIONS=-Xmx$(PLANETILER_HEAP)) getmapstack/planetiler-builder --country $(COUNTRY) --region $(REGION)

build-server:
ifndef COUNTRY
	$(error COUNTRY is required. Usage: make build-server COUNTRY=cyprus)
endif
ifeq ($(REGION),)
	$(error Unknown country: $(COUNTRY). Available: $(AVAILABLE_LIST))
endif
	@test -f artifacts/valhalla-$(COUNTRY).tar || { echo "Error: artifacts/valhalla-$(COUNTRY).tar not found. Run 'make create-valhalla-tiles COUNTRY=$(COUNTRY)' first."; exit 1; }
	@test -f artifacts/valhalla-$(COUNTRY).json || { echo "Error: artifacts/valhalla-$(COUNTRY).json not found. Run 'make create-valhalla-tiles COUNTRY=$(COUNTRY)' first."; exit 1; }
	@test -f artifacts/photon-$(COUNTRY).tar || { echo "Error: artifacts/photon-$(COUNTRY).tar not found. Run 'make create-photon-data COUNTRY=$(COUNTRY)' first."; exit 1; }
	@test -f artifacts/tiles-$(COUNTRY).pmtiles || { echo "Error: artifacts/tiles-$(COUNTRY).pmtiles not found. Run 'make create-vector-tiles COUNTRY=$(COUNTRY)' first."; exit 1; }
	@echo "=== Building getmapstack/$(COUNTRY) ==="
	cp artifacts/valhalla-$(COUNTRY).tar build/server/valhalla.tar
	jq '.mjolnir.tile_extract = "/data/valhalla.tar" | .mjolnir.tile_dir = "/data" | .httpd.service.listen = "tcp://127.0.0.1:8002"' artifacts/valhalla-$(COUNTRY).json > build/server/valhalla.json
	cp artifacts/photon-$(COUNTRY).tar build/server/photon-data.tar
	cp artifacts/tiles-$(COUNTRY).pmtiles build/server/tiles.pmtiles
	jq -n --args '{countries: $$ARGS.positional}' "$(COUNTRY)" > build/server/explorer-countries.json
	docker build --platform $(PLATFORMS) -t getmapstack/$(COUNTRY) ./build/server
	rm build/server/valhalla.tar build/server/valhalla.json build/server/photon-data.tar build/server/tiles.pmtiles build/server/explorer-countries.json
	@echo "=== Built getmapstack/$(COUNTRY) ==="

test-gateway:
	cd build/server/gateway && go test ./... -count=1

# Diff the vendored map style template against upstream, patched the same way. BRIGHT_REF
# defaults to the commit pinned in the server Dockerfile; pass BRIGHT_REF=main to see what
# upstream has changed since. Prints a diff and the tarball checksum - updating the pin
# stays a deliberate human step.
BRIGHT_REF ?= $(shell sed -n 's|.*openfreemap-styles/tar.gz/\([0-9a-f]\{40\}\).*|\1|p' build/server/Dockerfile)

update-bright-style:
	@test -n "$(BRIGHT_REF)" || { echo "Could not read the pinned commit from build/server/Dockerfile"; exit 1; }
	@tmp=$$(mktemp -d); trap 'rm -rf $$tmp' EXIT; \
	curl -fsSL "https://codeload.github.com/hyperknot/openfreemap-styles/tar.gz/$(BRIGHT_REF)" -o $$tmp/src.tar.gz; \
	echo "ref:    $(BRIGHT_REF)"; \
	echo "sha256: $$(shasum -a 256 $$tmp/src.tar.gz | cut -d' ' -f1)"; \
	tar -xzf $$tmp/src.tar.gz -C $$tmp; \
	src=$$(find $$tmp -path '*/styles/bright/style.json' | head -1); \
	test -n "$$src" || { echo "styles/bright/style.json not found in the tarball"; exit 1; }; \
	./build/server/patch-style.sh "$$src" > $$tmp/bright.json.tmpl; \
	if diff -u build/server/assets/bright.json.tmpl $$tmp/bright.json.tmpl; then \
	  echo "vendored template matches upstream at $(BRIGHT_REF)"; \
	fi

help::
	@echo "Usage:"
	@echo ""
	@echo "  Builders:"
	@echo "  make build-valhalla-builder                   Build the Valhalla builder Docker image"
	@echo "  make fetch-osm COUNTRY=cyprus                 Download the OSM extract and pin its snapshot date"
	@echo "  make create-valhalla-tiles COUNTRY=cyprus      Build routing tiles for a country"
	@echo "  make build-photon-builder                     Build the Photon builder Docker image"
	@echo "  make create-photon-data COUNTRY=cyprus         Build geocoding data via Nominatim import"
	@echo "  make build-planetiler-builder                 Build the Planetiler builder Docker image"
	@echo "  make create-vector-tiles COUNTRY=cyprus        Build vector basemap tiles for a country"
	@echo ""
	@echo "  Server image (routing + geocoding + vector tiles):"
	@echo "  make build-server COUNTRY=cyprus               Build server image getmapstack/cyprus"
	@echo "  ... PLATFORMS=linux/arm64                      Single-arch override (default: linux/amd64,linux/arm64)"
	@echo "  make test-gateway                              Run unit tests for the in-image gateway (needs Go)"
	@echo ""
	@echo "  Map style:"
	@echo "  make update-bright-style                      Diff the vendored map style against upstream"
	@echo "  ... BRIGHT_REF=main                           Compare against another upstream ref (default: the pinned commit)"
	@echo ""
	@echo "  make help                                     Show this help"
	@echo ""
	@echo "Available countries: $(AVAILABLE_LIST)"

# Local extension point: any *.mk beside this file is pulled in, and -include stays quiet
# when there is none. Put your own targets in one rather than editing this file.
-include *.mk
