// Command explorer-server serves the explorer page out of a directory. It exists
// because the tile server serves no arbitrary static files and a browser will not
// load ES modules over file://. It is deliberately the least important process in
// the image: entrypoint.sh keeps it out of the set whose death ends the container.
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path"
	"strings"
	"time"
)

// noListingFS refuses directories that carry no index.html, so the server never
// answers with a file listing.
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

// handler serves root. Content types come from Go's built-in table, which resolves
// every extension this page ships (.html, .css, .js, .mjs, .json, .png) even in an
// image carrying no /etc/mime.types - verified inside ubuntu:24.04.
func handler(root string) http.Handler {
	files := http.FileServer(noListingFS{http.Dir(root)})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The page declares its own content types; without nosniff a browser may
		// second-guess them, and a module served as anything but JavaScript fails
		// to load at all.
		w.Header().Set("X-Content-Type-Options", "nosniff")
		files.ServeHTTP(w, r)
	})
}

func main() {
	root := flag.String("root", "/data/explorer", "directory to serve")
	listen := flag.String("listen", ":8080", "listen address")
	flag.Parse()

	srv := &http.Server{
		Addr:    *listen,
		Handler: handler(*root),
		// A server with no deadlines is the defect this project already learned once
		// from its edge proxy: a client that opens a connection and never finishes its
		// request holds it forever. This one serves a handful of small files, so the
		// numbers are generous rather than tuned.
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}
	log.Printf("explorer: serving %s on %s", *root, *listen)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("explorer: %v", err)
	}
}
