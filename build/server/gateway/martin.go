package main

import (
	"net/http/httputil"
	"strings"
)

// rewriteMartin is the tile server's extraRewrite hook, applied after the "/martin" prefix
// has already been stripped from pr.Out.URL.Path. It does two independent things.
//
//  1. Sets X-Rewrite-URL to the original, still-prefixed inbound path. The tile server
//     builds the `tiles` URLs in its TileJSON from the request path it believes it was
//     asked for; without this it would advertise URLs missing the prefix a client needs to
//     reach it again. EscapedPath covers the RawPath case.
//  2. The public style id is "bright", whose glyph, sprite and tile URLs point at the
//     address browsers use - which the in-container renderer cannot fetch from inside the
//     container. "bright-local" is the same style with in-container URLs, so render
//     endpoints (static images and raster tiles) are silently served from it. Only render
//     paths are rewritten: the style JSON itself must keep the public id, or a browser
//     fetching it would receive URLs it cannot reach.
func rewriteMartin(pr *httputil.ProxyRequest) {
	pr.Out.Header.Set("X-Rewrite-URL", pr.In.URL.EscapedPath())

	p := pr.Out.URL.Path
	if strings.HasPrefix(p, "/style/bright/") && (strings.Contains(p, "/static/") || hasRenderExt(p)) {
		pr.Out.URL.Path = strings.Replace(p, "/style/bright/", "/style/bright-local/", 1)
		// URL.String() prefers RawPath over Path when it looks like a valid encoding, so a
		// stale RawPath would silently override the path just rewritten. Clearing it forces
		// re-encoding from Path.
		pr.Out.URL.RawPath = ""
	}
}

func hasRenderExt(p string) bool {
	for _, ext := range []string{".png", ".jpg", ".jpeg", ".webp"} {
		if strings.HasSuffix(p, ext) {
			return true
		}
	}
	return false
}
