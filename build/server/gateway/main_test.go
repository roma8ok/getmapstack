package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testConfig(t *testing.T, upstream string) config {
	t.Helper()
	return config{
		listen:          ":4326",
		explorerRoot:    explorerRoot(t),
		maxBodyBytes:    16,
		upstreamTimeout: 5 * time.Second,
		valhalla:        mustURL(t, upstream),
		photon:          mustURL(t, upstream),
		martin:          mustURL(t, upstream),
	}
}

// The whole chain, as a client meets it. CORS is outermost, so every answer - including
// the limiter's 413 - carries exactly one Access-Control-Allow-Origin.
func TestHandlerChain(t *testing.T) {
	for _, tc := range []struct {
		name       string
		req        func() *http.Request
		wantStatus int
	}{
		{
			name: "a body over the limit is refused before the engine is dialed",
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodPost, "/valhalla/route", http.NoBody)
				r.ContentLength = 1024
				return r
			},
			wantStatus: http.StatusRequestEntityTooLarge,
		},
		{
			name: "the root is the explorer",
			req: func() *http.Request {
				return httptest.NewRequest(http.MethodGet, "/", nil)
			},
			wantStatus: http.StatusOK,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var got received
			up := newEcho(t, &got)
			defer up.Close()

			rec := httptest.NewRecorder()
			newHandler(testConfig(t, up.URL), discardLogger()).ServeHTTP(rec, tc.req())

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
			if n := len(rec.Result().Header.Values("Access-Control-Allow-Origin")); n != 1 {
				t.Fatalf("Access-Control-Allow-Origin appeared %d times, want 1", n)
			}
		})
	}
}

func TestLoadConfig(t *testing.T) {
	for _, tc := range []struct {
		name    string
		env     map[string]string
		wantErr string // substring; empty means the call must succeed
		check   func(t *testing.T, cfg config)
	}{
		{
			name: "an empty environment gets the shipped defaults",
			check: func(t *testing.T, cfg config) {
				if cfg.listen != ":4326" {
					t.Errorf("listen = %q, want :4326", cfg.listen)
				}
				if cfg.maxBodyBytes != 10<<20 {
					t.Errorf("maxBodyBytes = %d, want %d", cfg.maxBodyBytes, 10<<20)
				}
				if cfg.upstreamTimeout != 60*time.Second {
					t.Errorf("upstreamTimeout = %s, want 1m", cfg.upstreamTimeout)
				}
				// The engines ship in this image on fixed loopback ports; they are not a knob.
				if cfg.martin.String() != "http://127.0.0.1:3000" {
					t.Errorf("martin = %q, want http://127.0.0.1:3000", cfg.martin)
				}
			},
		},
		{
			name:    "a non-numeric body limit is refused",
			env:     map[string]string{"GMS_MAX_BODY_BYTES": "lots"},
			wantErr: "GMS_MAX_BODY_BYTES",
		},
		{
			name:    "a zero body limit is refused: it would reject every request",
			env:     map[string]string{"GMS_MAX_BODY_BYTES": "0"},
			wantErr: "GMS_MAX_BODY_BYTES",
		},
		{
			name:    "an unparseable upstream timeout is refused",
			env:     map[string]string{"GMS_UPSTREAM_TIMEOUT": "soon"},
			wantErr: "GMS_UPSTREAM_TIMEOUT",
		},
		{
			name: "both knobs are read when they are set",
			env: map[string]string{
				"GMS_LISTEN":           "127.0.0.1:9999",
				"GMS_MAX_BODY_BYTES":   "1048576",
				"GMS_UPSTREAM_TIMEOUT": "90s",
			},
			check: func(t *testing.T, cfg config) {
				if cfg.listen != "127.0.0.1:9999" {
					t.Errorf("listen = %q, want 127.0.0.1:9999", cfg.listen)
				}
				if cfg.maxBodyBytes != 1<<20 {
					t.Errorf("maxBodyBytes = %d, want %d", cfg.maxBodyBytes, 1<<20)
				}
				if cfg.upstreamTimeout != 90*time.Second {
					t.Errorf("upstreamTimeout = %s, want 1m30s", cfg.upstreamTimeout)
				}
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := loadConfig(func(k string) string { return tc.env[k] })

			if tc.wantErr != "" {
				if err == nil {
					t.Fatalf("got no error, want one mentioning %q", tc.wantErr)
				}
				if !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("error = %v, want it to mention %q", err, tc.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			tc.check(t, cfg)
		})
	}
}

// The budget a client gets to upload a full-size body. The default limit was raised to
// 10 MB for long GPS traces, so the read timeout has to admit 10 MB from a slow client -
// the defect this replaces was a flat 15 s, which demanded 5.3 Mbit/s sustained.
func TestReadBudgetAdmitsAFullBodyOnASlowLink(t *testing.T) {
	for _, tc := range []struct {
		name  string
		limit int64
		want  time.Duration
	}{
		{"the default 10 MB limit", 10 << 20, 160 * time.Second},
		{"a small limit still gets the floor", 1 << 10, minReadWait},
		{"a raised limit gets proportionally longer", 20 << 20, 320 * time.Second},
		{"an absurd limit is capped", 1 << 40, maxReadWait},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := readBudget(tc.limit); got != tc.want {
				t.Fatalf("readBudget(%d) = %s, want %s", tc.limit, got, tc.want)
			}
		})
	}
}

// WriteTimeout is reset when the request headers are read, so it has to cover the upload,
// the engine's answer and the response write at once. Deriving it from upstreamTimeout is
// what makes GMS_UPSTREAM_TIMEOUT a real knob: a fixed 60 s silently capped anything above
// it, the request dying on the write budget before the upstream one ever expired.
func TestWriteBudgetCoversUploadUpstreamAndResponse(t *testing.T) {
	const limit = 10 << 20
	read := readBudget(limit)

	if got, want := writeBudget(limit, 60*time.Second), read+60*time.Second+responseWriteSlack; got != want {
		t.Fatalf("writeBudget = %s, want %s", got, want)
	}
	long := writeBudget(limit, 5*time.Minute)
	if long <= 5*time.Minute {
		t.Fatalf("writeBudget with a 5m upstream timeout = %s, want more than the upstream timeout itself", long)
	}
	if short := writeBudget(limit, 60*time.Second); long-short != 4*time.Minute {
		t.Fatalf("a 4m longer upstream timeout moved the write budget by %s, want 4m", long-short)
	}
}

func TestServerTimeoutsFollowTheConfiguration(t *testing.T) {
	cfg := config{listen: ":4326", maxBodyBytes: 10 << 20, upstreamTimeout: 90 * time.Second}
	srv := newServer(cfg, http.NotFoundHandler())

	if srv.ReadHeaderTimeout != readHeaderWait {
		t.Fatalf("ReadHeaderTimeout = %s, want %s", srv.ReadHeaderTimeout, readHeaderWait)
	}
	if want := readBudget(cfg.maxBodyBytes); srv.ReadTimeout != want {
		t.Fatalf("ReadTimeout = %s, want %s", srv.ReadTimeout, want)
	}
	if want := writeBudget(cfg.maxBodyBytes, cfg.upstreamTimeout); srv.WriteTimeout != want {
		t.Fatalf("WriteTimeout = %s, want %s", srv.WriteTimeout, want)
	}
	if srv.ReadTimeout >= srv.WriteTimeout {
		t.Fatalf("ReadTimeout %s must be inside WriteTimeout %s: the write budget covers the upload too",
			srv.ReadTimeout, srv.WriteTimeout)
	}
}
