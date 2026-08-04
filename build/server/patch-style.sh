#!/usr/bin/env bash
# Turns the upstream OpenFreeMap Bright style into the template this image ships.
#
#   patch-style.sh <upstream-style.json> > assets/bright.json.tmpl
#
# Five edits, and deliberately no others - everything else is upstream's design:
#
#   1. sources        - keep only the vector source this image serves. Upstream also
#                       declares a Natural Earth raster source that no Bright layer
#                       references.
#   2. glyphs         - served by this image.
#   3. sprite         - served by this image.
#   4. text-font      - the Georgian and Korean fonts are prepended ON PURPOSE, in that
#                       order. The tile server renders the glyphs of every font in a
#                       composite stack into one list without deduplicating them, and a
#                       client keeps the LAST record for a codepoint, so the last font of
#                       the stack wins. Listing the fallbacks first makes each lose every
#                       shared codepoint to Noto Sans: Hangul - absent from Noto Sans, so
#                       never duplicated - still comes from Noto Sans KR. Noto Sans
#                       Georgian carries neither Latin nor Cyrillic, so it has nothing to
#                       lose either way, but it is prepended anyway to keep the rule
#                       uniform. Georgian is absent from Noto Sans entirely - without this
#                       font, Georgian labels render blank. Reversing the Korean font's
#                       position draws Latin, Cyrillic and Greek in the Korean typeface.
#   5. text-transform - upstream uppercases two place-label layers. Uppercasing Greek
#                       keeps the tonos ("ΆΓΙΟΣ"), which Greek orthography drops, so the
#                       transform is removed.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <upstream-style.json>" >&2
  exit 2
fi

jq '
  .sources = {openmaptiles: {type: "vector", url: "__PUBLIC_URL__/basemap"}}
  | .glyphs = "__PUBLIC_URL__/font/{fontstack}/{range}"
  | .sprite = "__PUBLIC_URL__/sprite/bright"
  | (.layers[].layout["text-font"]? // empty) |= (["Noto Sans Georgian Regular", "Noto Sans KR Regular"] + .)
  | (.layers[] | select(.layout["text-transform"]? == "uppercase") | .layout)
      |= del(.["text-transform"])
' "$1"
