package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteError(t *testing.T) {
	tests := []struct {
		status  int
		message string
	}{
		{http.StatusServiceUnavailable, "upstream unavailable"},
		{http.StatusBadRequest, "invalid request"},
	}

	for _, tt := range tests {
		t.Run(tt.message, func(t *testing.T) {
			rec := httptest.NewRecorder()
			writeError(rec, tt.status, tt.message)

			// Check status code
			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d", rec.Code, tt.status)
			}

			// Check Content-Type header
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Fatalf("Content-Type = %q, want %q", ct, "application/json")
			}

			// Parse and validate JSON body
			var body struct {
				Error  string `json:"error"`
				Status int    `json:"status"`
			}
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode JSON: %v", err)
			}

			// Check error field
			if body.Error != tt.message {
				t.Fatalf("error = %q, want %q", body.Error, tt.message)
			}

			// Check status field
			if body.Status != tt.status {
				t.Fatalf("body status = %d, want %d", body.Status, tt.status)
			}
		})
	}
}
