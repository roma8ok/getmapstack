package main

import "net/http"

const (
	allowOrigin  = "*"
	allowMethods = "GET, POST, OPTIONS"
	allowHeaders = "Content-Type"
	corsMaxAge   = "86400"
)

// cors answers preflight requests itself - the routing engine replies 405 to OPTIONS,
// which is what blocks browser POSTs - and makes sure exactly one
// Access-Control-Allow-Origin reaches the client even though the engines set their own.
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", allowOrigin)
			h.Set("Access-Control-Allow-Methods", allowMethods)
			h.Set("Access-Control-Allow-Headers", allowHeaders)
			h.Set("Access-Control-Max-Age", corsMaxAge)
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(&corsWriter{ResponseWriter: w}, r)
	})
}

type corsWriter struct {
	http.ResponseWriter
	wrote bool
}

func (w *corsWriter) WriteHeader(code int) {
	if !w.wrote {
		w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		w.wrote = true
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *corsWriter) Write(b []byte) (int, error) {
	if !w.wrote {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}

// Unwrap lets http.ResponseController reach the real writer, so the reverse proxy can
// still flush streaming responses through this wrapper.
func (w *corsWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
