The answer passes when all of these hold.

- The search is a reverse-geocode call carrying both a radius and an OSM tag filter.
  A free-text query (`q=supermarket`) is a failure even if it returns plausible names,
  because it matches the word in a name rather than the tag.
- Every feature reported lies within the requested radius.
- A map is produced and the view is derived from the extent of the features, not from
  a fixed zoom chosen in advance.
- The page, if interactive, is reachable over HTTP. A path that only writes a file to
  disk and stops is a failure.
