// Command tileparts serves a vector tile archive that the image ships in several parts,
// one registry layer each, as the single file the tile server expects. It exists for one
// image layout: the parts are /data/tiles-parts/0, 1, 2 ..., joined in that order and
// served on loopback as /tiles.pmtiles, where only the tile server inside the container
// can reach them.
package main

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

const (
	partsDir   = "/data/tiles-parts"
	listenAddr = "127.0.0.1:3001"
	servedPath = "/tiles.pmtiles"
	// headerSize is the fixed size of a PMTiles v3 header: a 7-byte magic, a 1-byte
	// version, and four (offset, length) uint64 pairs (root directory, json metadata,
	// leaf directories, tile data), followed by fields this program never reads.
	headerSize = 127
)

type part struct {
	f    *os.File
	off  int64
	size int64
}

// joined presents the parts as one file. It holds no read position, so one value serves
// every request at once: (*os.File).ReadAt is pread and safe for concurrent use.
type joined struct {
	parts []part
	size  int64
}

// ReadAt fills p from the parts that overlap [off, off+len(p)). A read that runs past
// the end returns what there is and io.EOF, as io.ReaderAt requires.
func (j *joined) ReadAt(p []byte, off int64) (int, error) {
	if off < 0 {
		return 0, errors.New("tileparts: negative offset")
	}
	n := 0
	for _, pt := range j.parts {
		if n == len(p) {
			break
		}
		pos := off + int64(n)
		end := pt.off + pt.size
		if pos >= end {
			continue
		}
		want := int64(len(p) - n)
		if left := end - pos; want > left {
			want = left
		}
		m, err := pt.f.ReadAt(p[n:n+int(want)], pos-pt.off)
		n += m
		if err != nil {
			if errors.Is(err, io.EOF) {
				// The part is shorter than it was when it was opened.
				return n, io.ErrUnexpectedEOF
			}
			return n, err
		}
	}
	if n < len(p) {
		return n, io.EOF
	}
	return n, nil
}

// openParts opens dir/0 .. dir/n-1 and refuses anything else: a missing or empty
// directory, a name that is not a plain number, a gap, an empty part, a directory. It
// runs before the listener opens, so an answering port means the parts are whole.
func openParts(dir string) (*joined, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("%s holds no parts", dir)
	}
	names := make(map[int]string, len(entries))
	for _, e := range entries {
		i, err := strconv.Atoi(e.Name())
		if err != nil || i < 0 || strconv.Itoa(i) != e.Name() {
			return nil, fmt.Errorf("%s: %q is not a part number", dir, e.Name())
		}
		names[i] = e.Name()
	}
	j := &joined{}
	for i := 0; i < len(entries); i++ {
		name, ok := names[i]
		if !ok {
			j.close()
			return nil, fmt.Errorf("%s: part %d is missing", dir, i)
		}
		f, err := os.Open(filepath.Join(dir, name))
		if err != nil {
			j.close()
			return nil, err
		}
		st, err := f.Stat()
		if err != nil || !st.Mode().IsRegular() || st.Size() == 0 {
			_ = f.Close()
			j.close()
			if err != nil {
				return nil, err
			}
			return nil, fmt.Errorf("%s: part %d is not a non-empty file", dir, i)
		}
		j.parts = append(j.parts, part{f: f, off: j.size, size: st.Size()})
		j.size += st.Size()
	}
	return j, nil
}

// checkHeader reads the joined view's PMTiles v3 header and confirms its declared
// sections end exactly where the parts run out. Without this, a build that silently
// lost a part's registry layer would still open and serve: the missing bytes only show
// up as a decode failure in whatever tile happens to fall past the shortfall, while
// everything before it renders fine - a valid-looking prefix standing in for the whole
// archive. The four sections are not laid out on disk in header field order (the tile
// data can sit right after the header, with metadata and the leaf directories coming
// later still), so the furthest point any of them reaches is a max over all four pairs,
// never just the last one.
func checkHeader(j *joined) error {
	if j.size < headerSize {
		return fmt.Errorf("archive is %d bytes, shorter than the %d-byte PMTiles header", j.size, headerSize)
	}
	buf := make([]byte, headerSize)
	if _, err := j.ReadAt(buf, 0); err != nil {
		return fmt.Errorf("reading PMTiles header: %w", err)
	}
	if magic := string(buf[0:7]); magic != "PMTiles" {
		return fmt.Errorf("not a PMTiles archive: magic is %q", magic)
	}
	if version := buf[7]; version != 3 {
		return fmt.Errorf("unsupported PMTiles version %d, want 3", version)
	}
	var furthest uint64
	for _, base := range []int{8, 24, 40, 56} {
		offset := binary.LittleEndian.Uint64(buf[base : base+8])
		length := binary.LittleEndian.Uint64(buf[base+8 : base+16])
		if end := offset + length; end > furthest {
			furthest = end
		}
	}
	if furthest != uint64(j.size) {
		return fmt.Errorf("archive ends at %d but the parts hold %d bytes", furthest, j.size)
	}
	return nil
}

func (j *joined) close() {
	for _, p := range j.parts {
		_ = p.f.Close()
	}
}

// newHandler serves GET and HEAD for the joined file. http.ServeContent answers Range,
// If-Range and multi-range requests. The Unix epoch as modification time makes it omit
// Last-Modified: the bytes of a given image never change.
func newHandler(j *joined) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != servedPath {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		// A fresh SectionReader per request: it carries a read offset, and one shared
		// across concurrent requests would interleave their reads.
		http.ServeContent(w, r, "tiles.pmtiles", time.Unix(0, 0), io.NewSectionReader(j, 0, j.size))
	})
}

func main() {
	j, err := openParts(partsDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, "tileparts:", err)
		os.Exit(1)
	}
	if err := checkHeader(j); err != nil {
		fmt.Fprintln(os.Stderr, "tileparts:", err)
		os.Exit(1)
	}
	srv := &http.Server{Addr: listenAddr, Handler: newHandler(j), ReadHeaderTimeout: 5 * time.Second}
	fmt.Printf("tileparts: serving %d parts, %d bytes, on %s\n", len(j.parts), j.size, listenAddr)
	if err := srv.ListenAndServe(); err != nil {
		fmt.Fprintln(os.Stderr, "tileparts:", err)
		os.Exit(1)
	}
}
