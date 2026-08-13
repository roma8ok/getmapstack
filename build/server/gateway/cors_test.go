package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The engines set their own Access-Control-Allow-Origin. Two of them in one response make
// browsers reject it outright, so exactly one must survive.
func TestCORSCollapsesTheUpstreamHeader(t *testing.T) {
	upstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusOK)
	})
	rec := httptest.NewRecorder()
	cors(upstream).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/valhalla/status", nil))

	if got := rec.Result().Header.Values("Access-Control-Allow-Origin"); len(got) != 1 {
		t.Fatalf("Access-Control-Allow-Origin appeared %d times, want 1", len(got))
	}
}

// The routing engine answers OPTIONS with 405, which is what blocks preflighted browser
// POSTs. The gateway answers preflight itself and never forwards it.
func TestCORSAnswersPreflightWithoutTouchingTheUpstream(t *testing.T) {
	reached := false
	upstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		reached = true
		w.WriteHeader(http.StatusMethodNotAllowed)
	})
	rec := httptest.NewRecorder()
	cors(upstream).ServeHTTP(rec, httptest.NewRequest(http.MethodOptions, "/valhalla/route", nil))

	if reached {
		t.Fatal("preflight reached the upstream")
	}
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Headers") != "Content-Type" {
		t.Fatalf("Access-Control-Allow-Headers = %q, want Content-Type",
			rec.Header().Get("Access-Control-Allow-Headers"))
	}
}

func TestLimitBodyRejectsADeclaredOversizeBody(t *testing.T) {
	reached := false
	upstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		reached = true
	})
	req := httptest.NewRequest(http.MethodPost, "/valhalla/route", strings.NewReader("0123456789"))
	req.ContentLength = 10

	rec := httptest.NewRecorder()
	limitBody(4, upstream).ServeHTTP(rec, req)

	if reached {
		t.Fatal("oversize body reached the upstream")
	}
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", rec.Code)
	}
}

// The CORS layer wraps the ResponseWriter, and a wrapper is a chance to break two things
// the engines rely on: an implicit 200, and a streaming flush.
func TestCORSWriterKeepsTheWriterUsable(t *testing.T) {
	t.Run("a write with no explicit status still sets the header once", func(t *testing.T) {
		upstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("hi"))
		})
		rec := httptest.NewRecorder()
		cors(upstream).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/photon/api", nil))

		if rec.Code != http.StatusOK || rec.Body.String() != "hi" {
			t.Fatalf("status %d, body %q, want 200 and %q", rec.Code, rec.Body.String(), "hi")
		}
		if n := len(rec.Result().Header.Values("Access-Control-Allow-Origin")); n != 1 {
			t.Fatalf("Access-Control-Allow-Origin appeared %d times, want 1", n)
		}
	})

	t.Run("the real writer is still reachable for a flush", func(t *testing.T) {
		flushed := false
		upstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			if err := http.NewResponseController(w).Flush(); err != nil {
				t.Errorf("flush through the wrapper: %v", err)
				return
			}
			flushed = true
		})
		cors(upstream).ServeHTTP(httptest.NewRecorder(),
			httptest.NewRequest(http.MethodGet, "/photon/api", nil))

		if !flushed {
			t.Fatal("ResponseController could not reach the underlying writer")
		}
	})
}
