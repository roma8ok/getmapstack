package main

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

// healthCheck is what the image's own HEALTHCHECK runs. It talks to the gateway over a
// real socket, so every case here needs a listener on a port it can be told about.
func TestHealthCheck(t *testing.T) {
	code := http.StatusOK
	var gotHost string
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHost = r.Host
		w.WriteHeader(code)
	}))
	// The unstarted server made a listener of its own; closing it before the swap keeps
	// the test from leaking one port per case.
	_ = srv.Listener.Close()
	srv.Listener = ln
	srv.Start()
	defer srv.Close()

	_, port, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name     string
		listen   string
		status   int
		wantErr  string // substring; empty means the probe must succeed
		wantHost string // upstream Host header the probe must have dialed; empty means don't check
	}{
		{name: "a healthy gateway on an explicit host", listen: "127.0.0.1:" + port, status: http.StatusOK},
		{
			// The three forms `docker run` actually produces. Each has to be dialed back on
			// loopback: a probe cannot connect to a wildcard address.
			name: "a bare port means loopback", listen: ":" + port, status: http.StatusOK,
			wantHost: "127.0.0.1:" + port,
		},
		{
			name: "0.0.0.0 means loopback", listen: "0.0.0.0:" + port, status: http.StatusOK,
			wantHost: "127.0.0.1:" + port,
		},
		{
			name: "[::] means loopback", listen: "[::]:" + port, status: http.StatusOK,
			wantHost: "127.0.0.1:" + port,
		},
		{
			name:   "an unhealthy gateway is an error, and says which status",
			listen: "127.0.0.1:" + port, status: http.StatusServiceUnavailable,
			wantErr: "healthz returned 503",
		},
		{
			name:   "an unparseable listen address is refused before dialing",
			listen: "garbage", status: http.StatusOK, wantErr: "GMS_LISTEN",
		},
		{
			name:   "nothing listening is an error, not a hang",
			listen: "127.0.0.1:1", status: http.StatusOK, wantErr: "connect",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			code = tc.status
			err := healthCheck(func(k string) string {
				if k == "GMS_LISTEN" {
					return tc.listen
				}
				return ""
			})

			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("got %v, want no error", err)
				}
				if tc.wantHost != "" && gotHost != tc.wantHost {
					t.Fatalf("upstream saw Host = %q, want %q", gotHost, tc.wantHost)
				}
				return
			}
			if err == nil {
				t.Fatalf("got no error, want one mentioning %q", tc.wantErr)
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error = %v, want it to mention %q", err, tc.wantErr)
			}
		})
	}
}

// freeAddr picks a loopback port by binding one and letting it go. Another process could
// take it in the gap; the window is narrow enough to accept.
func freeAddr(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	_ = ln.Close()
	return addr
}

func tempLog(t *testing.T) *os.File {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "gateway-log")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = f.Close() })
	return f
}

func TestRunRefusesABrokenConfiguration(t *testing.T) {
	err := run(context.Background(), func(k string) string {
		if k == "GMS_MAX_BODY_BYTES" {
			return "lots"
		}
		return ""
	}, tempLog(t))

	if err == nil || !strings.Contains(err.Error(), "configuration") {
		t.Fatalf("got %v, want a configuration error", err)
	}
}

// A port the gateway cannot have has to end the process, not leave a container that looks
// alive and answers nothing.
func TestRunReportsAnUnusableListener(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = ln.Close() }()

	done := make(chan error, 1)
	go func() {
		done <- run(context.Background(), func(k string) string {
			if k == "GMS_LISTEN" {
				return ln.Addr().String()
			}
			return ""
		}, tempLog(t))
	}()

	select {
	case err := <-done:
		if err == nil || !strings.Contains(err.Error(), "address already in use") {
			t.Fatalf("got %v, want an error mentioning %q", err, "address already in use")
		}
	case <-time.After(10 * time.Second):
		t.Fatal("run did not return after the listener failed to bind")
	}
}

// The shutdown path SIGTERM takes, driven by the context instead of a real signal.
func TestRunServesThenDrains(t *testing.T) {
	addr := freeAddr(t)
	logFile := tempLog(t)
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- run(ctx, func(k string) string {
			switch k {
			case "GMS_LISTEN":
				return addr
			case "GMS_EXPLORER_ROOT":
				return t.TempDir()
			}
			return ""
		}, logFile)
	}()

	// Readiness, not health: the engines are absent, so /healthz answers 503 the moment
	// the listener is up. Any answer at all is the signal being waited for.
	var up bool
	for range 200 {
		resp, err := http.Get("http://" + addr + "/healthz")
		if err == nil {
			_ = resp.Body.Close()
			up = true
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !up {
		cancel()
		t.Fatal("the server never answered on its listen address")
	}

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("run returned %v, want nil after a clean shutdown", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("run did not return after the context was cancelled")
	}

	logged, err := os.ReadFile(logFile.Name())
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(logged), "shutting down") {
		t.Fatalf("log = %q, want it to record the shutdown", logged)
	}
}
