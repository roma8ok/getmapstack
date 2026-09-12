# Finding features near a point

The four steps of the loop in SKILL.md, in full.

## Contents

- Resolving the anchor
- Choosing and verifying the tag
- The result ceiling
- Covering an area larger than one call
- When the script stops without an answer
- What the answer cannot promise

## Resolving the anchor

Coordinates in the request are the anchor. A place name is resolved through the
geocoder first:

```bash
curl -s "localhost:4326/photon/api?q=Limassol&limit=1&lang=en" \
  | jq -r '.features[0].geometry.coordinates | "\(.[1]) \(.[0])"'
```

`lang` picks the language of the names that come back. Without it the answer carries
local names, which for a bilingual country means both.

An ambiguous name deserves a second look before it becomes the centre of a search: ask
for a few features rather than one and check the `type` and `country` of each.

## Choosing and verifying the tag

Features are found by OSM tag. The tag goes in `osm_tag` as `key:value`.

Free text is the wrong instrument and fails in a way that looks like success:
`q=supermarket` matches the word inside a name, so it returns the shops that happen to
be called "... Supermarket" and drops every chain whose name does not contain the word.
A kind of place is not a word in a name.

Reading the tag off a free-text probe is also unreliable. Query `school` and look at
what `osm_value` comes back, and `highway:bus_stop` ranks alongside `amenity:school` or
above it: a bus stop is named after the place it serves, so a text search for a kind of
place matches the stops named after that place as readily as the place itself.

Propose the tag from what you already know about OSM tagging, then verify it against
this container:

```bash
curl -s "localhost:4326/photon/reverse?lat=35.1856&lon=33.3823&radius=2&limit=50&osm_tag=amenity:school&lang=en" \
  | jq '[.features[].properties | {name, osm_key, osm_value}]'
```

**An empty answer is a statement about the tag before it is a statement about the
area.** `amenity:kindergarden` returns nothing at all; `amenity:kindergarten` returns
kindergartens. When the answer is empty, re-check the spelling and the key, verify
again, and only then report that there is nothing nearby. The bundled script prints
this reminder when it finds nothing.

## The result ceiling

Photon 1.2.1 returns at most 50 features per call, on `/photon/api` and on
`/photon/reverse` alike, whatever `limit` asks for. Raising `limit` changes nothing and
widening `radius` changes nothing. The response carries no flag saying it truncated.

The consequence is a rule: **an answer of exactly 50 is a truncated answer, never a
count.** Treat it as a signal to cover the area properly rather than as an answer.

## Covering an area larger than one call

Run the bundled script rather than assembling the calls by hand:

```bash
scripts/nearby.sh --lat 35.1856 --lon 33.3823 --radius 10 --tag amenity:restaurant > found.json
```

It queries the radius once. Where the answer comes back at the ceiling it re-covers
that area with overlapping smaller circles, laid out so the covering leaves no gap, and
repeats on any circle that is still full, down to a bounded depth. It then merges
everything, drops duplicates by OSM id, discards whatever the overlap pulled in from
beyond the requested radius, and sorts by distance from the anchor.

Three things it will tell you on stderr, and each matters:

- Nothing carries this tag here, with the reminder to check the spelling.
- A cell was still full at the smallest radius tried, so a few features in the densest
  spot may be missing. This is the honest version of the ceiling problem, and it means
  the area is dense enough to deserve a smaller radius and several runs.
- The search stopped at its call budget, so the answer may be short in the densest
  spots. A smaller radius covers the same ground completely.

The work is bounded by that call budget, not by the depth of the subdivision: depth
decides how small the circles get, the budget decides how many of them go out at all. A
very dense area can exhaust the budget, and the script says so on stderr when it does.

## When the script stops without an answer

Three distinct exits, and the difference tells you where to look:

- **64** - an argument is wrong: a tag that is not `key:value`, a flag with no value, or
  a latitude, longitude or radius that is not a number or is out of range. The message
  names the argument at fault.
- **65** - the geocoder answered and refused the request, and the message carries the
  HTTP status. Look at the anchor and the radius before suspecting the container.
- **69** - the container could not be reached at all. The message gives the health check
  to run.

An exit of 0 with an empty feature list is none of these. It means the query was valid
and matched nothing, which is far more often the tag than the area.

## What the answer cannot promise

The index holds features that carry the tag in the OSM extract the image was built
from. So:

- "Every X" means every X in that index, on that snapshot, not every X in the world.
  Say so when the request asks for all of something.
- A feature with no name is still a feature. Count features, not names.
- The tag was typed by a contributor, so some features carry the wrong one. A pet-food
  shop or a baby shop tagged `shop=supermarket` comes back with the real supermarkets,
  because it genuinely carries that tag. A name that plainly contradicts the tag is a
  mistake in the data, not in the query: keep those features in the answer and say which
  ones look mistagged, rather than dropping them silently. Filtering by words in the name
  is not the fix - "Asian Supermarket" is a real supermarket, and most mistagged features
  do not announce themselves at all.
- The index reflects one OSM extract from one moment, so a shop that opened last week
  may be absent.
