// Command gateway is the single entry point of a getmapstack image. It serves the
// explorer at the root, proxies /valhalla, /photon and /martin to the engines - which bind
// loopback and are reachable through nothing else - and answers /healthz.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
)

const (
	healthCacheTTL     = 5 * time.Second
	healthProbeTimeout = 5 * time.Second
	shutdownGrace      = 30 * time.Second
	readHeaderWait     = 5 * time.Second
	idleWait           = 2 * time.Minute

	// The read budget is derived from the body limit rather than fixed, because the two
	// are one statement seen twice: a 10 MB limit a client cannot finish uploading is not
	// a 10 MB limit. slowUploadBytesPerSec is the weakest uplink this image promises to
	// serve, 512 kbit/s, so the default limit buys 160 s - long enough for the long GPS
	// trace the raised limit exists for. A flat 15 s would demand a sustained 5.3 Mbit/s
	// and cut a slower client off mid-upload.
	slowUploadBytesPerSec = 64 << 10
	// Floors and ceilings on that derivation: a small limit still gets a usable budget,
	// and an enormous one cannot turn into an unbounded read timeout.
	minReadWait = 30 * time.Second
	maxReadWait = 10 * time.Minute
	// Go resets WriteTimeout when a request's headers are read, so it covers the body
	// upload, the upstream round trip and the response write together - it is a sum, not
	// a maximum. This is the last term: what a client on that same weak uplink needs to
	// receive a large answer.
	responseWriteSlack = 30 * time.Second
)

// readBudget is how long a client may take to send a full-size request body.
func readBudget(maxBodyBytes int64) time.Duration {
	seconds := maxBodyBytes / slowUploadBytesPerSec
	if seconds > int64(maxReadWait/time.Second) {
		return maxReadWait
	}
	d := time.Duration(seconds) * time.Second
	if d < minReadWait {
		return minReadWait
	}
	return d
}

// writeBudget is what http.Server counts against WriteTimeout: the upload, the wait for
// the engine, and the response write. It derives from upstreamTimeout so that raising
// GMS_UPSTREAM_TIMEOUT actually gives an engine longer to answer - a fixed 60 s silently
// capped every configured value above it.
func writeBudget(maxBodyBytes int64, upstreamTimeout time.Duration) time.Duration {
	return readBudget(maxBodyBytes) + upstreamTimeout + responseWriteSlack
}

type config struct {
	listen          string
	explorerRoot    string
	maxBodyBytes    int64
	upstreamTimeout time.Duration
	valhalla        *url.URL
	photon          *url.URL
	martin          *url.URL
}

// loadConfig reads the environment. Upstreams are not configurable: the engines ship in
// the same image as this binary, on fixed loopback ports.
func loadConfig(getenv func(string) string) (config, error) {
	cfg := config{
		listen:          orDefault(getenv("GMS_LISTEN"), ":4326"),
		explorerRoot:    orDefault(getenv("GMS_EXPLORER_ROOT"), "/data/explorer"),
		maxBodyBytes:    10 << 20,
		upstreamTimeout: 60 * time.Second,
		valhalla:        &url.URL{Scheme: "http", Host: "127.0.0.1:8002"},
		photon:          &url.URL{Scheme: "http", Host: "127.0.0.1:2322"},
		martin:          &url.URL{Scheme: "http", Host: "127.0.0.1:3000"},
	}
	if v := getenv("GMS_MAX_BODY_BYTES"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 {
			return config{}, fmt.Errorf("GMS_MAX_BODY_BYTES: %q is not a positive number of bytes", v)
		}
		cfg.maxBodyBytes = n
	}
	if v := getenv("GMS_UPSTREAM_TIMEOUT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 {
			return config{}, fmt.Errorf("GMS_UPSTREAM_TIMEOUT: %q is not a positive duration", v)
		}
		cfg.upstreamTimeout = d
	}
	return cfg, nil
}

func orDefault(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

// newHandler wires the chain. CORS is outermost so that every response - including the
// body limiter's 413 and the router's 502 - carries exactly one Access-Control-Allow-Origin.
func newHandler(cfg config, logger *slog.Logger) http.Handler {
	probeClient := &http.Client{Timeout: healthProbeTimeout}
	healthz := newHealth(probeClient, healthCacheTTL, time.Now,
		cfg.valhalla.JoinPath("status"), cfg.photon.JoinPath("status"), cfg.martin.JoinPath("health"))

	router := newRouter(cfg.valhalla, cfg.photon, cfg.martin, cfg.upstreamTimeout, logger,
		staticHandler(cfg.explorerRoot), healthz)

	return cors(limitBody(cfg.maxBodyBytes, router))
}

// newServer applies the timeout budgets to the listener. Separate from run so the
// derivation is testable without binding a port.
func newServer(cfg config, h http.Handler) *http.Server {
	return &http.Server{
		Addr:              cfg.listen,
		Handler:           h,
		ReadHeaderTimeout: readHeaderWait,
		ReadTimeout:       readBudget(cfg.maxBodyBytes),
		WriteTimeout:      writeBudget(cfg.maxBodyBytes, cfg.upstreamTimeout),
		IdleTimeout:       idleWait,
	}
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--healthcheck" {
		if err := healthCheck(os.Getenv); err != nil {
			fmt.Fprintln(os.Stderr, "gateway: healthcheck:", err)
			os.Exit(1)
		}
		return
	}
	if err := run(context.Background(), os.Getenv, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "gateway:", err)
		os.Exit(1)
	}
}

// run serves until ctx is cancelled or SIGTERM/SIGINT arrives, then drains, or returns at
// once if the listener fails. The context is a parameter rather than Background(): it is
// the only practical way a test can end the server without sending it a real signal.
func run(ctx context.Context, getenv func(string) string, stdout *os.File) error {
	cfg, err := loadConfig(getenv)
	if err != nil {
		return fmt.Errorf("configuration: %w", err)
	}
	logger := slog.New(slog.NewJSONHandler(stdout, nil))

	srv := newServer(cfg, newHandler(cfg, logger))

	ctx, stop := signal.NotifyContext(ctx, syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	errc := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", cfg.listen)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errc <- err
		}
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
		logger.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownGrace)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

// healthCheck lets the container probe itself without curl.
func healthCheck(getenv func(string) string) error {
	addr := orDefault(getenv("GMS_LISTEN"), ":4326")
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("GMS_LISTEN: %w", err)
	}
	switch host {
	case "", "0.0.0.0", "::":
		host = "127.0.0.1"
	}
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://" + net.JoinHostPort(host, port) + healthPath)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthz returned %d", resp.StatusCode)
	}
	return nil
}
