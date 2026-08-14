package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

const (
	valhallaPrefix = "/valhalla"
	photonPrefix   = "/photon"
	martinPrefix   = "/martin"
	healthPath     = "/healthz"
)

// newRouter builds the request router. Endpoints inside a prefix are never enumerated, so
// anything a future engine version adds keeps working without a code change. Anything that
// is not a prefix and not the health path falls through to static, which serves the
// explorer and 404s on everything else.
func newRouter(valhalla, photon, martin *url.URL, timeout time.Duration, logger *slog.Logger, static, healthz http.Handler) http.Handler {
	vp := newProxy(valhalla, valhallaPrefix, logger, nil)
	pp := newProxy(photon, photonPrefix, logger, nil)
	mp := newProxy(martin, martinPrefix, logger, rewriteMartin)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case path == valhallaPrefix || path == photonPrefix || path == martinPrefix:
			redirectToSlash(w, r)
		case strings.HasPrefix(path, valhallaPrefix+"/"):
			serveWithTimeout(vp, w, r, timeout)
		case strings.HasPrefix(path, photonPrefix+"/"):
			serveWithTimeout(pp, w, r, timeout)
		case strings.HasPrefix(path, martinPrefix+"/"):
			serveWithTimeout(mp, w, r, timeout)
		case path == healthPath:
			healthz.ServeHTTP(w, r)
		default:
			static.ServeHTTP(w, r)
		}
	})
}

func redirectToSlash(w http.ResponseWriter, r *http.Request) {
	target := *r.URL
	target.Path += "/"
	http.Redirect(w, r, target.RequestURI(), http.StatusPermanentRedirect)
}

func serveWithTimeout(p *httputil.ReverseProxy, w http.ResponseWriter, r *http.Request, timeout time.Duration) {
	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()
	p.ServeHTTP(w, r.WithContext(ctx))
}

func newProxy(target *url.URL, prefix string, logger *slog.Logger, extraRewrite func(*httputil.ProxyRequest)) *httputil.ReverseProxy {
	name := strings.TrimPrefix(prefix, "/")
	return &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.Out.URL.Scheme = target.Scheme
			pr.Out.URL.Host = target.Host
			pr.Out.Host = target.Host
			pr.Out.URL.Path = strings.TrimPrefix(pr.In.URL.Path, prefix)
			if pr.In.URL.RawPath != "" {
				pr.Out.URL.RawPath = strings.TrimPrefix(pr.In.URL.RawPath, prefix)
			}
			setForwarded(pr)
			if extraRewrite != nil {
				extraRewrite(pr)
			}
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			var tooLarge *http.MaxBytesError
			switch {
			case errors.As(err, &tooLarge):
				writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
			case errors.Is(err, context.DeadlineExceeded):
				writeError(w, http.StatusGatewayTimeout, "upstream timed out")
			case errors.Is(err, context.Canceled):
				// The client hung up; there is nobody left to answer.
			default:
				// r is the outbound request here, so its path has already lost the prefix;
				// prepend it back so the log shows what the client asked for.
				logger.Error("upstream error", "upstream", name, "path", prefix+r.URL.Path, "err", err)
				writeError(w, http.StatusBadGateway, "upstream unavailable")
			}
		},
	}
}

// setForwarded gives the engine the address the client really used.
//
// ReverseProxy in Rewrite mode strips X-Forwarded-For, Forwarded, X-Forwarded-Host and
// X-Forwarded-Proto from the outbound request before this closure runs, and never
// repopulates them. Values that arrived from a proxy in front are copied through, because
// only that proxy saw the browser. When none arrived - which is every direct container
// run - they are synthesized from this request. The synthesis is not cosmetic: the tile
// server builds the absolute URLs it advertises in TileJSON from X-Forwarded-Host and
// X-Forwarded-Proto, falling back to the Host header, which this proxy has just rewritten
// to an in-container address no browser can reach. Anything running its own proxy in
// front of this container therefore has to pass the browser's host and scheme along - in
// these headers, or at least in the Host header it forwards - or the tile server
// advertises an address the client cannot reach, and nothing in here can notice.
func setForwarded(pr *httputil.ProxyRequest) {
	host := pr.In.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = pr.In.Host
	}
	proto := pr.In.Header.Get("X-Forwarded-Proto")
	if proto == "" {
		proto = "http"
		if pr.In.TLS != nil {
			proto = "https"
		}
	}
	forwardedFor := pr.In.Header.Get("X-Forwarded-For")
	if forwardedFor == "" {
		if ip, _, err := net.SplitHostPort(pr.In.RemoteAddr); err == nil {
			forwardedFor = ip
		}
	}

	pr.Out.Header.Set("X-Forwarded-Host", host)
	pr.Out.Header.Set("X-Forwarded-Proto", proto)
	if forwardedFor != "" {
		pr.Out.Header.Set("X-Forwarded-For", forwardedFor)
	}
}
