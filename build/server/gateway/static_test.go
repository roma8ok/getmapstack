package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func explorerRoot(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("<title>x</title>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "tools"), 0o755); err != nil {
		t.Fatal(err)
	}
	// A file the handler must never reach: it sits BESIDE the served root, not inside it,
	// so a request that escapes the root by one level lands exactly on it.
	if err := os.WriteFile(filepath.Join(filepath.Dir(root), "secret-sibling"), []byte(secretSibling), 0o644); err != nil {
		t.Fatal(err)
	}
	return root
}

const secretSibling = "nope"

func TestStaticServes(t *testing.T) {
	for _, tc := range []struct {
		name       string
		target     string
		wantStatus int
		wantCType  string // prefix; empty means the case does not care
	}{
		{
			// Without nosniff a browser may second-guess the declared type, and a module
			// served as anything but JavaScript never loads.
			name:   "the index is served as HTML under nosniff",
			target: "/", wantStatus: http.StatusOK, wantCType: "text/html",
		},
		{
			name:   "a directory with no index is refused rather than listed",
			target: "/tools/", wantStatus: http.StatusNotFound,
		},
		{
			name:   "an unknown path is a 404",
			target: "/does-not-exist", wantStatus: http.StatusNotFound,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			staticHandler(explorerRoot(t)).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tc.target, nil))

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
			// Every answer carries it, including the refusals.
			if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Error("nosniff header missing")
			}
			if tc.wantCType != "" {
				if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, tc.wantCType) {
					t.Errorf("Content-Type = %q, want it to start with %q", ct, tc.wantCType)
				}
			}
		})
	}
}

// Percent-encoded traversal, which the un-encoded case does not cover: a mux normalizes
// "/../x" before a handler ever sees it, while "%2e%2e" and "..%2f" arrive at the handler
// intact and are only defused by the two cleaning passes inside net/http (http.FileServer
// cleans the request path, http.Dir.Open cleans it again before opening). Both passes are
// implementation detail of the standard library, which is exactly why this asserts the
// behavior instead of trusting it.
func TestStaticCannotEscapeItsRoot(t *testing.T) {
	root := explorerRoot(t)

	// Keeps the assertions below from passing vacuously: the fixture is a real, readable
	// file - served happily the moment its own directory is the root.
	reachable := httptest.NewRecorder()
	staticHandler(filepath.Dir(root)).ServeHTTP(reachable,
		httptest.NewRequest(http.MethodGet, "/secret-sibling", nil))
	if reachable.Code != http.StatusOK || !strings.Contains(reachable.Body.String(), secretSibling) {
		t.Fatalf("fixture is not readable from its own directory: status %d, body %q",
			reachable.Code, reachable.Body.String())
	}

	for _, target := range []string{
		"/../secret-sibling",
		"/%2e%2e/secret-sibling",
		"/..%2fsecret-sibling",
		"/tools/../../secret-sibling",
		"/tools/%2e%2e/%2e%2e/secret-sibling",
	} {
		t.Run(target, func(t *testing.T) {
			rec := httptest.NewRecorder()
			staticHandler(root).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))

			if rec.Code == http.StatusOK {
				t.Errorf("status = %d, want a refusal", rec.Code)
			}
			if strings.Contains(rec.Body.String(), secretSibling) {
				t.Errorf("leaked the file beside the root: body = %q", rec.Body.String())
			}
		})
	}
}

// statFailFS opens files that refuse to describe themselves - a filesystem error the real
// explorer directory cannot produce on demand.
type statFailFile struct{ http.File }

func (statFailFile) Stat() (os.FileInfo, error) { return nil, errors.New("stat failed") }
func (statFailFile) Close() error               { return nil }

type statFailFS struct{}

func (statFailFS) Open(string) (http.File, error) { return statFailFile{}, nil }

// A file that opens but cannot be described must surface as an error, not as a nil-info
// dereference inside the directory check.
func TestStaticPropagatesAFilesystemFailure(t *testing.T) {
	_, err := noListingFS{inner: statFailFS{}}.Open("/whatever")

	if err == nil || !strings.Contains(err.Error(), "stat failed") {
		t.Fatalf("got %v, want the underlying stat error", err)
	}
}
