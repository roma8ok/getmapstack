package main

import (
	"context"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// health answers /healthz by probing each check URL it was given. The verdict is cached so
// a flood of health checks cannot become load on the engines. Each URL is the exact
// endpoint to GET, because the engines do not share one health-check path.
type health struct {
	checks []*url.URL
	client *http.Client
	ttl    time.Duration
	now    func() time.Time

	mu      sync.Mutex
	checked time.Time
	healthy bool
}

// checkBudget bounds an entire check regardless of how many targets it probes: targets are
// probed concurrently, so the worst case stays close to this budget instead of growing
// with the target count the way a per-target timeout would.
const checkBudget = 3 * time.Second

func newHealth(client *http.Client, ttl time.Duration, now func() time.Time, checks ...*url.URL) *health {
	return &health{checks: checks, client: client, ttl: ttl, now: now}
}

func (h *health) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if h.check(r.Context()) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}` + "\n"))
		return
	}
	writeError(w, http.StatusServiceUnavailable, "upstream unavailable")
}

func (h *health) check(ctx context.Context) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := h.now()
	if !h.checked.IsZero() && now.Sub(h.checked) < h.ttl {
		return h.healthy
	}

	// Detached from the caller's context on purpose: a client that disconnects mid-check
	// must not cancel the outbound probes and poison the cached verdict for everyone else.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), checkBudget)
	defer cancel()

	healthy := h.probeAll(ctx)
	h.checked, h.healthy = now, healthy
	return healthy
}

func (h *health) probeAll(ctx context.Context) bool {
	results := make(chan bool, len(h.checks))
	for _, c := range h.checks {
		go func(check *url.URL) { results <- h.probe(ctx, check) }(c)
	}
	healthy := true
	for range h.checks {
		if !<-results {
			healthy = false
		}
	}
	return healthy
}

func (h *health) probe(ctx context.Context, check *url.URL) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, check.String(), nil)
	if err != nil {
		return false
	}
	resp, err := h.client.Do(req)
	if err != nil {
		return false
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode == http.StatusOK
}
