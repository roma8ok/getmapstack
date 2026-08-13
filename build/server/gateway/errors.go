package main

import (
	"encoding/json"
	"net/http"
)

// writeError emits the gateway's own error shape. Upstream errors are never rewritten:
// the engines already return meaningful JSON, and a client must see exactly what the
// engine said.
func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(struct {
		Error  string `json:"error"`
		Status int    `json:"status"`
	}{msg, status})
}
