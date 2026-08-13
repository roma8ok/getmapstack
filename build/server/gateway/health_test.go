package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func mustURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse %q: %v", raw, err)
	}
	return u
}

// stubEngine answers every request with one fixed status.
func stubEngine(t *testing.T, code int) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(code)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestHealthAggregatesEveryEngine(t *testing.T) {
	for _, tc := range []struct {
		name       string
		engines    []int // one status code per engine behind /healthz
		wantStatus int
	}{
		{
			name:       "every engine answering 200 is the healthy case",
			engines:    []int{http.StatusOK, http.StatusOK, http.StatusOK},
			wantStatus: http.StatusOK,
		},
		{
			// The container's own HEALTHCHECK hangs off this: one broken engine has to make
			// the whole image unhealthy, not two thirds of it.
			name:       "one failing engine fails the whole verdict",
			engines:    []int{http.StatusOK, http.StatusInternalServerError},
			wantStatus: http.StatusServiceUnavailable,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			checks := make([]*url.URL, 0, len(tc.engines))
			for _, code := range tc.engines {
				checks = append(checks, mustURL(t, stubEngine(t, code).URL+"/status"))
			}
			h := newHealth(&http.Client{Timeout: time.Second}, time.Second, time.Now, checks...)

			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
		})
	}
}

// A flood of container health checks must not become load on the engines.
func TestHealthCachesTheVerdict(t *testing.T) {
	var hits int
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
	}))
	defer up.Close()

	now := time.Now()
	h := newHealth(up.Client(), time.Minute, func() time.Time { return now },
		mustURL(t, up.URL+"/status"))
	for range 3 {
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/healthz", nil))
	}

	if hits != 1 {
		t.Fatalf("upstream probed %d times, want 1", hits)
	}
}

// An engine that cannot be reached at all is as unhealthy as one answering 500 - the
// probe has to turn both into the same verdict rather than an error nobody sees.
func TestHealthTreatsAnUnreachableEngineAsUnhealthy(t *testing.T) {
	for _, tc := range []struct {
		name            string
		check           *url.URL
		mustFailToParse bool // guards the fixture below against silently no longer covering the request-build path
	}{
		{
			name:  "nothing listening on the port",
			check: &url.URL{Scheme: "http", Host: "127.0.0.1:1", Path: "/status"},
		},
		{
			// A check URL that cannot even be turned into a request. The space is escaped
			// to %20 by URL.String(), and url.Parse rejects a percent escape in a HOST -
			// replacing it with a plain hostname silently stops exercising this path.
			name:            "a check URL that cannot be built into a request",
			check:           &url.URL{Scheme: "http", Host: "engine name", Path: "/status"},
			mustFailToParse: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.mustFailToParse {
				// Keeps the assertion below from passing vacuously: if url.Parse ever starts
				// accepting this host, the fixture no longer exercises the request-build path.
				if _, err := url.Parse(tc.check.String()); err == nil {
					t.Fatal("fixture no longer exercises the request-build path: url.Parse accepted it")
				}
			}
			h := newHealth(&http.Client{Timeout: time.Second}, time.Second, time.Now, tc.check)

			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

			if rec.Code != http.StatusServiceUnavailable {
				t.Fatalf("status = %d, want 503", rec.Code)
			}
		})
	}
}
