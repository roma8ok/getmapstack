package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// newTestServer builds a root directory with a page, a module, and a subdirectory
// holding no index, then serves it with the handler under test.
func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	root := t.TempDir()
	write := func(rel, content string) {
		t.Helper()
		full := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("index.html", "<title>Getmapstack explorer</title>")
	write("app.js", "export const x = 1;")
	write("vendor/maplibre-gl.js", "export default {};")
	if err := os.MkdirAll(filepath.Join(root, "empty"), 0o755); err != nil {
		t.Fatal(err)
	}
	// A file the server must never reach: it sits beside the root, not inside it.
	if err := os.WriteFile(filepath.Join(filepath.Dir(root), "outside.txt"), []byte("SECRET"), 0o644); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(handler(root))
	t.Cleanup(srv.Close)
	return srv
}

func get(t *testing.T, srv *httptest.Server, path string) (*http.Response, string) {
	t.Helper()
	resp, err := srv.Client().Get(srv.URL + path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = resp.Body.Close() })
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp, string(body)
}

func TestServesIndex(t *testing.T) {
	srv := newTestServer(t)
	resp, body := get(t, srv, "/")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if got := resp.Header.Get("Content-Type"); got != "text/html; charset=utf-8" {
		t.Errorf("content type = %q, want text/html; charset=utf-8", got)
	}
	if body != "<title>Getmapstack explorer</title>" {
		t.Errorf("body = %q", body)
	}
}

func TestNosniffOnEveryResponse(t *testing.T) {
	srv := newTestServer(t)
	for _, path := range []string{"/", "/app.js", "/vendor/maplibre-gl.js"} {
		resp, _ := get(t, srv, path)
		if got := resp.Header.Get("X-Content-Type-Options"); got != "nosniff" {
			t.Errorf("%s: X-Content-Type-Options = %q, want nosniff", path, got)
		}
	}
}

func TestJavaScriptContentType(t *testing.T) {
	srv := newTestServer(t)
	// A wrong MIME type here kills the ES module outright, because the page is
	// served with nosniff.
	for _, path := range []string{"/app.js", "/vendor/maplibre-gl.js"} {
		resp, _ := get(t, srv, path)
		if got := resp.Header.Get("Content-Type"); got != "text/javascript; charset=utf-8" {
			t.Errorf("%s: content type = %q, want text/javascript; charset=utf-8", path, got)
		}
	}
}

func TestUnknownPathIs404(t *testing.T) {
	srv := newTestServer(t)
	resp, _ := get(t, srv, "/nope.html")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestNoDirectoryListing(t *testing.T) {
	srv := newTestServer(t)
	// A directory with no index.html must 404 rather than enumerate its contents,
	// and the vendor directory (which has files) must not enumerate them either.
	for _, path := range []string{"/empty/", "/vendor/"} {
		resp, body := get(t, srv, path)
		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("%s: status = %d with body %q, want 404", path, resp.StatusCode, body)
		}
	}
}

func TestCannotEscapeRoot(t *testing.T) {
	srv := newTestServer(t)
	for _, path := range []string{"/../outside.txt", "/%2e%2e/outside.txt", "/..%2foutside.txt"} {
		resp, body := get(t, srv, path)
		if resp.StatusCode == http.StatusOK {
			t.Errorf("%s: served %d with body %q, want a refusal", path, resp.StatusCode, body)
		}
		if body == "SECRET" {
			t.Errorf("%s: leaked the file outside the root", path)
		}
	}
}
