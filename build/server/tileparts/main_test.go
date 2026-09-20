package main

import (
	"bytes"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
)

// writeParts lays the given parts out as files named 0, 1, ... and returns the directory
// and the bytes they join to.
func writeParts(t *testing.T, parts ...[]byte) (string, []byte) {
	t.Helper()
	dir := t.TempDir()
	var all []byte
	for i, p := range parts {
		if err := os.WriteFile(filepath.Join(dir, strconv.Itoa(i)), p, 0o644); err != nil {
			t.Fatal(err)
		}
		all = append(all, p...)
	}
	return dir, all
}

func randomBytes(t *testing.T, n int) []byte {
	t.Helper()
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		t.Fatal(err)
	}
	return b
}

func TestReadAtMatchesTheJoinedBytesEverywhere(t *testing.T) {
	dir, all := writeParts(t, randomBytes(t, 37), randomBytes(t, 1), randomBytes(t, 26))
	j, err := openParts(dir)
	if err != nil {
		t.Fatal(err)
	}
	if j.size != int64(len(all)) {
		t.Fatalf("size %d, want %d", j.size, len(all))
	}
	// Every offset and every length, so every way a read can straddle a cut is covered.
	for off := 0; off <= len(all); off++ {
		for n := 0; off+n <= len(all)+3; n++ {
			buf := make([]byte, n)
			got, err := j.ReadAt(buf, int64(off))
			want := len(all) - off
			if want > n {
				want = n
			}
			if got != want || !bytes.Equal(buf[:got], all[off:off+got]) {
				t.Fatalf("ReadAt(len %d, off %d) = %d bytes, want %d", n, off, got, want)
			}
			if got < n && err != io.EOF {
				t.Fatalf("short read at off %d len %d returned %v, want io.EOF", off, n, err)
			}
			if got == n && err != nil {
				t.Fatalf("full read at off %d len %d returned %v", off, n, err)
			}
		}
	}
}

func TestServesTheJoinedFile(t *testing.T) {
	dir, all := writeParts(t, randomBytes(t, 5000), randomBytes(t, 4999))
	j, err := openParts(dir)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(newHandler(j))
	defer srv.Close()

	get := func(t *testing.T, method, rangeHeader string) (*http.Response, []byte) {
		t.Helper()
		req, _ := http.NewRequest(method, srv.URL+servedPath, nil)
		if rangeHeader != "" {
			req.Header.Set("Range", rangeHeader)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer func() { _ = resp.Body.Close() }()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatal(err)
		}
		return resp, body
	}

	t.Run("whole file", func(t *testing.T) {
		resp, body := get(t, http.MethodGet, "")
		if resp.StatusCode != http.StatusOK || !bytes.Equal(body, all) {
			t.Fatalf("status %d, %d bytes, want 200 and %d bytes", resp.StatusCode, len(body), len(all))
		}
		if ct := resp.Header.Get("Content-Type"); ct != "application/octet-stream" {
			t.Fatalf("Content-Type %q", ct)
		}
		if lm := resp.Header.Get("Last-Modified"); lm != "" {
			t.Fatalf("Last-Modified %q, want none", lm)
		}
	})

	t.Run("a range across the cut", func(t *testing.T) {
		resp, body := get(t, http.MethodGet, "bytes=4990-5010")
		if resp.StatusCode != http.StatusPartialContent || !bytes.Equal(body, all[4990:5011]) {
			t.Fatalf("status %d, body %d bytes", resp.StatusCode, len(body))
		}
		if cr := resp.Header.Get("Content-Range"); cr != fmt.Sprintf("bytes 4990-5010/%d", len(all)) {
			t.Fatalf("Content-Range %q", cr)
		}
	})

	t.Run("a suffix range", func(t *testing.T) {
		resp, body := get(t, http.MethodGet, "bytes=-10")
		if resp.StatusCode != http.StatusPartialContent || !bytes.Equal(body, all[len(all)-10:]) {
			t.Fatalf("status %d, body %d bytes", resp.StatusCode, len(body))
		}
	})

	t.Run("HEAD reports the joined length", func(t *testing.T) {
		resp, body := get(t, http.MethodHead, "")
		if resp.StatusCode != http.StatusOK || len(body) != 0 || resp.ContentLength != int64(len(all)) {
			t.Fatalf("status %d, Content-Length %d, body %d", resp.StatusCode, resp.ContentLength, len(body))
		}
	})

	t.Run("concurrent ranges each get their own bytes", func(t *testing.T) {
		var wg sync.WaitGroup
		errs := make(chan error, 32*20)
		for g := 0; g < 32; g++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for k := 0; k < 20; k++ {
					a, _ := rand.Int(rand.Reader, big.NewInt(int64(len(all)-1)))
					from := int(a.Int64())
					to := from + 700
					if to >= len(all) {
						to = len(all) - 1
					}
					req, _ := http.NewRequest(http.MethodGet, srv.URL+servedPath, nil)
					req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", from, to))
					resp, err := http.DefaultClient.Do(req)
					if err != nil {
						errs <- err
						return
					}
					body, _ := io.ReadAll(resp.Body)
					_ = resp.Body.Close()
					if !bytes.Equal(body, all[from:to+1]) {
						errs <- fmt.Errorf("range %d-%d came back wrong", from, to)
					}
				}
			}()
		}
		wg.Wait()
		close(errs)
		for err := range errs {
			t.Error(err)
		}
	})

	t.Run("another path is 404", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/other")
		if err != nil {
			t.Fatal(err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("status %d", resp.StatusCode)
		}
	})

	t.Run("another method is 405 with Allow", func(t *testing.T) {
		resp, err := http.Post(srv.URL+servedPath, "text/plain", nil)
		if err != nil {
			t.Fatal(err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusMethodNotAllowed || resp.Header.Get("Allow") != "GET, HEAD" {
			t.Fatalf("status %d, Allow %q", resp.StatusCode, resp.Header.Get("Allow"))
		}
	})
}

// buildPMTilesHeader lays out a synthetic 127-byte PMTiles v3 header with the four
// (offset, length) section pairs set as given, in header field order: root directory,
// json metadata, leaf directories, tile data.
func buildPMTilesHeader(version byte, sections [4][2]uint64) []byte {
	buf := make([]byte, headerSize)
	copy(buf[0:7], "PMTiles")
	buf[7] = version
	for i, s := range sections {
		base := 8 + i*16
		binary.LittleEndian.PutUint64(buf[base:base+8], s[0])
		binary.LittleEndian.PutUint64(buf[base+8:base+16], s[1])
	}
	return buf
}

func TestCheckHeaderAcceptsACompleteArchive(t *testing.T) {
	// Sections deliberately out of on-disk order and out of field order, like the real
	// US archive (tile data first on disk, then metadata, then leaf directories last):
	// the section that ends furthest (the root directory here) is stored in the FIRST
	// offset/length pair, so a check that trusted field order or assumed the last field
	// was the furthest section would pass this for the wrong reason or not at all.
	header := buildPMTilesHeader(3, [4][2]uint64{
		{200, 100}, // root directory: ends at 300, the furthest
		{127, 50},  // json metadata: ends at 177
		{177, 20},  // leaf directories: ends at 197
		{197, 3},   // tile data: ends at 200
	})
	body := randomBytes(t, 173) // 127 + 173 = 300, matching the furthest section end
	all := append(header, body...)
	// Split across two parts, so this proves the check works on the joined view, not
	// just on a single opened file.
	dir, _ := writeParts(t, all[:150], all[150:])
	j, err := openParts(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := checkHeader(j); err != nil {
		t.Fatalf("checkHeader on a complete archive: %v", err)
	}
}

func TestCheckHeaderRejectsATruncatedArchive(t *testing.T) {
	header := buildPMTilesHeader(3, [4][2]uint64{
		{200, 100}, {127, 50}, {177, 20}, {197, 3},
	})
	body := randomBytes(t, 173)
	all := append(header, body...)
	// Only the first part survives: the joined size (150) falls short of the 300 bytes
	// the header's sections claim - the shape of a lost registry layer.
	dir, _ := writeParts(t, all[:150])
	j, err := openParts(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := checkHeader(j); err == nil {
		t.Fatal("checkHeader accepted a truncated archive")
	}
}

func TestCheckHeaderRejectsWrongMagic(t *testing.T) {
	header := buildPMTilesHeader(3, [4][2]uint64{{0, 0}, {0, 0}, {0, 0}, {0, 0}})
	copy(header[0:7], "NOTATIL")
	dir, _ := writeParts(t, header)
	j, err := openParts(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := checkHeader(j); err == nil {
		t.Fatal("checkHeader accepted a bad magic")
	}
}

func TestCheckHeaderRejectsWrongVersion(t *testing.T) {
	header := buildPMTilesHeader(2, [4][2]uint64{{127, 0}, {127, 0}, {127, 0}, {127, 0}})
	dir, _ := writeParts(t, header)
	j, err := openParts(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := checkHeader(j); err == nil {
		t.Fatal("checkHeader accepted PMTiles version 2")
	}
}

func TestCheckHeaderRejectsFewerThan127Bytes(t *testing.T) {
	dir, _ := writeParts(t, randomBytes(t, 50))
	j, err := openParts(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := checkHeader(j); err == nil {
		t.Fatal("checkHeader accepted a file shorter than the 127-byte header")
	}
}

func TestRefusesAnythingButWholeNumberedParts(t *testing.T) {
	cases := map[string]func(t *testing.T) string{
		"missing directory": func(t *testing.T) string { return filepath.Join(t.TempDir(), "absent") },
		"no parts":          func(t *testing.T) string { return t.TempDir() },
		"a gap in the numbers": func(t *testing.T) string {
			dir := t.TempDir()
			for _, n := range []string{"0", "2"} {
				_ = os.WriteFile(filepath.Join(dir, n), []byte("x"), 0o644)
			}
			return dir
		},
		"a non-numeric name": func(t *testing.T) string {
			dir, _ := writeParts(t, []byte("x"))
			_ = os.WriteFile(filepath.Join(dir, "tiles.pmtiles"), []byte("x"), 0o644)
			return dir
		},
		"a zero-padded name": func(t *testing.T) string {
			dir := t.TempDir()
			_ = os.WriteFile(filepath.Join(dir, "00"), []byte("x"), 0o644)
			return dir
		},
		"an empty part": func(t *testing.T) string {
			dir, _ := writeParts(t, []byte("x"), []byte{})
			return dir
		},
		"a directory where a part should be": func(t *testing.T) string {
			dir := t.TempDir()
			_ = os.Mkdir(filepath.Join(dir, "0"), 0o755)
			return dir
		},
	}
	for name, setup := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := openParts(setup(t)); err == nil {
				t.Fatal("openParts accepted it")
			}
		})
	}
}
