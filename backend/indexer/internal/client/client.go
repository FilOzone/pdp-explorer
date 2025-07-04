package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"pdp-explorer-indexer/internal/logger"
)

type Client struct {
	endpoint string
	apiKey   string
	client   *http.Client
}

// RPCRequest represents a JSON-RPC 2.0 request
type RPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

// RPCError represents a JSON-RPC 2.0 error
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// RPCResponse represents a JSON-RPC 2.0 response
type RPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *RPCError       `json:"error"`
}

// BatchRPCError represents an error that occurred during batch processing
type BatchRPCError struct {
	ID      int
	Method  string
	Message string
}

func (e *BatchRPCError) Error() string {
	return fmt.Sprintf("RPC error for method %s (ID: %d): %s", e.Method, e.ID, e.Message)
}

func NewClient(endpoint string, apiKey string) *Client {
	return &Client{
		endpoint: endpoint,
		apiKey:   apiKey,
		client:   &http.Client{},
	}
}

func (c *Client) CallRpc(method string, params []interface{}, result *RPCResponse) error {
	// Create RPC request
	request := RPCRequest{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
		ID:      1,
	}

	// Marshal request
	reqBody, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create and configure HTTP request with context and timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	}

	// Execute request
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("failed to parse response: %w, body: %s", err, string(body))
	}

	// Check for RPC error
	if result.Error != nil {
		errMsg := "RPC error:\n" + "\t" + result.Error.Message
		logger.Warnf("%s", errMsg)
	}

	return nil
}

// CallRpcBatched makes a batch RPC call with multiple methods and parameters
func (c *Client) CallRpcBatched(methods []string, params [][]interface{}, result *[]RPCResponse) error {
	if len(methods) != len(params) {
		return fmt.Errorf("mismatched methods and params length: methods=%d, params=%d", len(methods), len(params))
	}

	// Prepare batch request
	requests := make([]RPCRequest, len(methods))
	for i, method := range methods {
		requests[i] = RPCRequest{
			JSONRPC: "2.0",
			Method:  method,
			Params:  params[i],
			ID:      i + 1,
		}
	}

	// Marshal request
	reqBody, err := json.Marshal(requests)
	if err != nil {
		return fmt.Errorf("failed to marshal batch request: %w", err)
	}

	// Create and configure HTTP request
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiKey))
	}

	// Execute request
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected HTTP status: %d, body: %s", resp.StatusCode, string(body))
	}

	// Parse responses
	if err := json.Unmarshal(body, result); err != nil {
		return fmt.Errorf("failed to parse RPC responses: %w", err)
	}

	// Validate response count
	if len(*result) != len(methods) {
		return fmt.Errorf("unexpected response count: got %d, want %d", len(*result), len(methods))
	}

	// Process responses and collect errors
	var batchErrors []BatchRPCError

	for i, res := range *result {
		if res.Error != nil {
			batchErrors = append(batchErrors, BatchRPCError{
				ID:      res.ID,
				Method:  methods[i],
				Message: res.Error.Message,
			})
			continue
		}
	}

	// Return batch errors if any occurred
	if len(batchErrors) > 0 {
		errMsg := "batch RPC errors:"
		for _, err := range batchErrors {
			errMsg += "\n\t" + err.Error()
		}
		logger.Warnf("%s", errMsg)
	}

	return nil
}
