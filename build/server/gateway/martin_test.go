package main

import (
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"testing"
)

// proxyRequest builds the ProxyRequest a stripped Martin proxy would hand to rewriteMartin.
func proxyRequest(inPath, outPath string) *httputil.ProxyRequest {
	in := httptest.NewRequest(http.MethodGet, inPath, nil)
	out := in.Clone(in.Context())
	out.URL.Path = outPath
	out.URL.RawPath = ""
	return &httputil.ProxyRequest{In: in, Out: out}
}

func TestRewriteMartin(t *testing.T) {
	for _, tc := range []struct {
		name     string
		in       string // what the client asked for, prefix included
		out      string // what the proxy has left after stripping the prefix
		wantPath string
	}{
		{
			// The tile server builds the tiles URLs in its TileJSON from the path it is told
			// it was asked for, so it must be told the prefixed one or it advertises URLs
			// missing the prefix a client needs to reach it again.
			name:     "a plain tile request keeps its path and reports the prefixed one",
			in:       "/martin/basemap",
			out:      "/basemap",
			wantPath: "/basemap",
		},
		{
			// Render endpoints are served from the local style, whose URLs resolve inside
			// the container; the browser-facing style must keep its public URLs.
			name:     "a static image render is swapped to the local style",
			in:       "/martin/style/bright/static/33.38,35.18,13/600x400.png",
			out:      "/style/bright/static/33.38,35.18,13/600x400.png",
			wantPath: "/style/bright-local/static/33.38,35.18,13/600x400.png",
		},
		{
			name:     "a raster tile render is swapped to the local style",
			in:       "/martin/style/bright/14/9711/6479@2x.webp",
			out:      "/style/bright/14/9711/6479@2x.webp",
			wantPath: "/style/bright-local/14/9711/6479@2x.webp",
		},
		{
			// A browser fetching the style JSON must receive the public ids, or every URL
			// inside it points at an address the browser cannot reach.
			name:     "the style JSON itself keeps the public id",
			in:       "/martin/style/bright",
			out:      "/style/bright",
			wantPath: "/style/bright",
		},
		{
			// Only render paths move to the local style. Everything else under the style
			// prefix is served as asked for.
			name:     "a non-render file under the style prefix is left alone",
			in:       "/martin/style/bright/notes.txt",
			out:      "/style/bright/notes.txt",
			wantPath: "/style/bright/notes.txt",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pr := proxyRequest(tc.in, tc.out)
			rewriteMartin(pr)

			if got := pr.Out.Header.Get("X-Rewrite-URL"); got != tc.in {
				t.Errorf("X-Rewrite-URL = %q, want %q", got, tc.in)
			}
			if pr.Out.URL.Path != tc.wantPath {
				t.Errorf("path = %q, want %q", pr.Out.URL.Path, tc.wantPath)
			}
		})
	}
}
