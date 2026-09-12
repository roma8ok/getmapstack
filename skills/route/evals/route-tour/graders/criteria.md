The answer passes when all of these hold.

- The mode is taken from the request: the tour is computed on foot, and the request is
  not asked what "walking" means.
- The start of the tour is the point in the request, not the first feature found.
- The visiting order comes from the engine's optimized route, not from the order the
  search returned the features in.
- The end of the tour was chosen by comparing candidates, not taken as the last feature
  in the search order. Evidence: more than one optimized route call, or a statement of
  which end was chosen and why.
- The route is shown on a page reachable over HTTP, with the stops numbered in visiting
  order, and the answer gives the URL.
- The answer says the times carry no traffic.
