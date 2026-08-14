package main

import (
	"crypto/tls"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// echo records what the upstream actually received.
type received struct {
	path                      string
	escaped                   string
	fwdHost, fwdProto, fwdFor string
}

func newEcho(t *testing.T, got *received) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.path = r.URL.Path
		got.escaped = r.URL.EscapedPath()
		got.fwdHost = r.Header.Get("X-Forwarded-Host")
		got.fwdProto = r.Header.Get("X-Forwarded-Proto")
		got.fwdFor = r.Header.Get("X-Forwarded-For")
		w.WriteHeader(http.StatusOK)
	}))
}

// marker answers 200 with its own name, so a dispatch case can say which handler ran.
func marker(name string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, name)
	})
}

func testRouter(t *testing.T, upstream string, timeout time.Duration) http.Handler {
	t.Helper()
	return newRouter(
		mustURL(t, upstream), mustURL(t, upstream), mustURL(t, upstream),
		timeout, discardLogger(),
		marker("static"), marker("healthz"),
	)
}

// The addresses the engines are told the client used. Martin builds the absolute URLs it
// advertises in TileJSON out of these, and the Host header it would otherwise fall back to
// has just been rewritten to an in-container address no browser can reach.
func TestRouterForwardsTheClientAddress(t *testing.T) {
	for _, tc := range []struct {
		name       string
		host       string
		remoteAddr string
		overTLS    bool
		inbound    map[string]string
		wantHost   string
		wantProto  string
		wantFor    string
	}{
		{
			// Every direct `docker run`: nothing in front, so the values are synthesized
			// from this request or the engines never learn the browser's address at all.
			name: "no inbound headers means they are synthesized here",
			host: "localhost:4326", remoteAddr: "203.0.113.7:51000",
			wantHost: "localhost:4326", wantProto: "http", wantFor: "203.0.113.7",
		},
		{
			// Behind another proxy its values win: only that hop saw the browser.
			name: "inbound headers from a proxy in front are passed through",
			host: "mapstack:4326", remoteAddr: "203.0.113.7:51000",
			inbound: map[string]string{
				"X-Forwarded-Host":  "maps.example.com",
				"X-Forwarded-Proto": "https",
				"X-Forwarded-For":   "198.51.100.9",
			},
			wantHost: "maps.example.com", wantProto: "https", wantFor: "198.51.100.9",
		},
		{
			// TLS terminated at this hop rather than in front of it: nobody else can tell
			// the engine the scheme was https.
			name: "a request that arrived over TLS is forwarded as https",
			host: "localhost:4326", remoteAddr: "203.0.113.7:51000", overTLS: true,
			wantHost: "localhost:4326", wantProto: "https", wantFor: "203.0.113.7",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var got received
			up := newEcho(t, &got)
			defer up.Close()

			req := httptest.NewRequest(http.MethodGet, "/martin/basemap", nil)
			req.Host = tc.host
			req.RemoteAddr = tc.remoteAddr
			if tc.overTLS {
				req.TLS = &tls.ConnectionState{}
			}
			for k, v := range tc.inbound {
				req.Header.Set(k, v)
			}
			testRouter(t, up.URL, 5*time.Second).ServeHTTP(httptest.NewRecorder(), req)

			if got.fwdHost != tc.wantHost {
				t.Errorf("X-Forwarded-Host = %q, want %q", got.fwdHost, tc.wantHost)
			}
			if got.fwdProto != tc.wantProto {
				t.Errorf("X-Forwarded-Proto = %q, want %q", got.fwdProto, tc.wantProto)
			}
			if got.fwdFor != tc.wantFor {
				t.Errorf("X-Forwarded-For = %q, want %q", got.fwdFor, tc.wantFor)
			}
		})
	}
}

func TestRouterDispatch(t *testing.T) {
	for _, tc := range []struct {
		name                string
		method              string
		target              string
		body                string
		wantStatus          int
		wantUpstreamPath    string
		wantUpstreamEscaped string
		wantLocation        string
		wantBody            string
	}{
		{
			name:   "a prefixed request reaches the engine with the prefix stripped",
			method: http.MethodPost, target: "/valhalla/route", body: "{}",
			wantStatus: http.StatusOK, wantUpstreamPath: "/route",
		},
		{
			name:   "a geocoding request reaches its own engine",
			method: http.MethodGet, target: "/photon/api?q=Nicosia",
			wantStatus: http.StatusOK, wantUpstreamPath: "/api",
		},
		{
			name:   "a bare prefix redirects to the slash form and keeps the query",
			method: http.MethodGet, target: "/photon?q=Nicosia",
			wantStatus: http.StatusPermanentRedirect, wantLocation: "/photon/?q=Nicosia",
		},
		{
			// An encoded separator has to survive the prefix strip still encoded: decoding
			// it here would turn one path segment into two before the engine sees it.
			name:   "an encoded path keeps its encoding through the strip",
			method: http.MethodGet, target: "/martin/style/a%2Fb",
			wantStatus: http.StatusOK, wantUpstreamPath: "/style/a/b",
			wantUpstreamEscaped: "/style/a%2Fb",
		},
		{
			name:   "the health endpoint is answered here, not proxied",
			method: http.MethodGet, target: "/healthz",
			wantStatus: http.StatusOK, wantBody: "healthz",
		},
		{
			name:   "an unknown path belongs to the explorer, not to an error",
			method: http.MethodGet, target: "/app.js",
			wantStatus: http.StatusOK, wantBody: "static",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var got received
			up := newEcho(t, &got)
			defer up.Close()

			rec := httptest.NewRecorder()
			testRouter(t, up.URL, 5*time.Second).ServeHTTP(rec,
				httptest.NewRequest(tc.method, tc.target, strings.NewReader(tc.body)))

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
			if tc.wantUpstreamPath != "" && got.path != tc.wantUpstreamPath {
				t.Errorf("upstream path = %q, want %q", got.path, tc.wantUpstreamPath)
			}
			if tc.wantUpstreamEscaped != "" && got.escaped != tc.wantUpstreamEscaped {
				t.Errorf("upstream escaped path = %q, want %q", got.escaped, tc.wantUpstreamEscaped)
			}
			if tc.wantLocation != "" {
				if loc := rec.Header().Get("Location"); loc != tc.wantLocation {
					t.Errorf("Location = %q, want %q", loc, tc.wantLocation)
				}
			}
			if tc.wantBody != "" && rec.Body.String() != tc.wantBody {
				t.Errorf("body = %q, want %q - the wrong handler answered", rec.Body.String(), tc.wantBody)
			}
		})
	}
}

// Each failure mode gets its own status, or a caller cannot tell "the engine is down" from
// "your request was too big" from "it took too long".
func TestRouterSeparatesTheFailureModes(t *testing.T) {
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(300 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer slow.Close()

	var got received
	up := newEcho(t, &got)
	defer up.Close()

	for _, tc := range []struct {
		name       string
		upstream   string
		timeout    time.Duration
		bodyLimit  int64 // non-zero wraps the router in the body limiter
		method     string
		body       string
		wantStatus int
	}{
		{
			name: "a dead engine is a 502", upstream: "http://127.0.0.1:1",
			timeout: 5 * time.Second, method: http.MethodGet,
			wantStatus: http.StatusBadGateway,
		},
		{
			name: "an engine slower than the budget is a 504", upstream: slow.URL,
			timeout: 10 * time.Millisecond, method: http.MethodGet,
			wantStatus: http.StatusGatewayTimeout,
		},
		{
			// A chunked body declares no length, so the limiter can only discover the
			// overrun while streaming - after the proxy has already started the request.
			name: "an undeclared oversize body is a 413", upstream: up.URL,
			timeout: 5 * time.Second, bodyLimit: 4,
			method: http.MethodPost, body: "0123456789",
			wantStatus: http.StatusRequestEntityTooLarge,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := testRouter(t, tc.upstream, tc.timeout)
			if tc.bodyLimit > 0 {
				h = limitBody(tc.bodyLimit, h)
			}
			req := httptest.NewRequest(tc.method, "/valhalla/route",
				io.NopCloser(strings.NewReader(tc.body)))
			if req.ContentLength != -1 {
				t.Fatalf("fixture is wrong: ContentLength = %d, want -1 (chunked)", req.ContentLength)
			}

			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d; body %s", rec.Code, tc.wantStatus, rec.Body.String())
			}
		})
	}
}
