package main

import (
	"net/http"
	"os"
	"path"
	"strings"
)

// noListingFS refuses directories that carry no index.html, so the server never answers
// with a file listing.
type noListingFS struct{ inner http.FileSystem }

func (n noListingFS) Open(name string) (http.File, error) {
	f, err := n.inner.Open(name)
	if err != nil {
		return nil, err
	}
	info, err := f.Stat()
	if err != nil {
		_ = f.Close()
		return nil, err
	}
	if info.IsDir() {
		index, err := n.inner.Open(path.Join(strings.TrimSuffix(name, "/"), "index.html"))
		if err != nil {
			_ = f.Close()
			return nil, os.ErrNotExist
		}
		_ = index.Close()
	}
	return f, nil
}

// staticHandler serves the explorer out of root. Content types come from Go's built-in
// table, which resolves every extension the page ships (.html, .css, .js, .mjs, .json,
// .png) even in an image carrying no /etc/mime.types.
func staticHandler(root string) http.Handler {
	files := http.FileServer(noListingFS{http.Dir(root)})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The page declares its own content types; without nosniff a browser may
		// second-guess them, and a module served as anything but JavaScript never loads.
		w.Header().Set("X-Content-Type-Options", "nosniff")
		files.ServeHTTP(w, r)
	})
}
