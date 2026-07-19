.DEFAULT_GOAL := help

# Optional overrides (e.g. PHOTON_HEAP=12g)
-include .env

# Country → region mapping
region.belgium = europe
region.brunei = asia
region.cyprus = europe
region.indonesia = asia
region.malaysia = asia
region.singapore = asia
region.south-korea = asia
region.vietnam = asia

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

.PHONY: build-valhalla-builder create-valhalla-tiles build-photon-builder create-photon-data build-server help

build-valhalla-builder:
	docker build -t getmapstack/valhalla-builder ./build/valhalla

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
	@echo "=== Building getmapstack/$(COUNTRY) ==="
	cp artifacts/valhalla-$(COUNTRY).tar build/server/valhalla.tar
	jq '.mjolnir.tile_extract = "/data/valhalla.tar" | .mjolnir.tile_dir = "/data"' artifacts/valhalla-$(COUNTRY).json > build/server/valhalla.json
	cp artifacts/photon-$(COUNTRY).tar build/server/photon-data.tar
	docker build --platform $(PLATFORMS) -t getmapstack/$(COUNTRY) ./build/server
	rm build/server/valhalla.tar build/server/valhalla.json build/server/photon-data.tar
	@echo "=== Built getmapstack/$(COUNTRY) ==="

help::
	@echo "Usage:"
	@echo ""
	@echo "  Builders:"
	@echo "  make build-valhalla-builder                   Build the Valhalla builder Docker image"
	@echo "  make create-valhalla-tiles COUNTRY=cyprus      Build routing tiles for a country"
	@echo "  make build-photon-builder                     Build the Photon builder Docker image"
	@echo "  make create-photon-data COUNTRY=cyprus         Build geocoding data via Nominatim import"
	@echo ""
	@echo "  Server image (routing + geocoding):"
	@echo "  make build-server COUNTRY=cyprus               Build server image getmapstack/cyprus"
	@echo "  ... PLATFORMS=linux/arm64                      Single-arch override (default: linux/amd64,linux/arm64)"
	@echo ""
	@echo "  make help                                     Show this help"
	@echo ""
	@echo "Available countries: $(AVAILABLE_LIST)"

# Optional local targets; -include skips this silently when the file is absent
-include private.mk
