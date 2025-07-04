package handlers

import (
	"context"
	"fmt"

	"pdp-explorer-indexer/internal/types"
)

// Base Handler
// Handler types
const (
	HandlerTypeEvent    = "event"
	HandlerTypeFunction = "function"
)

// EventHandler is the interface for handling event logs
type EventHandler interface {
	HandleEvent(ctx context.Context, log *types.Log, tx *types.Transaction) error
}

// FunctionHandler is the interface for handling function calls
type FunctionHandler interface {
	HandleFunction(ctx context.Context, tx *types.Transaction) error
}

// Handler is a combined interface that can handle both events and functions
type Handler interface {
	GetType() string // Returns HandlerTypeEvent or HandlerTypeFunction
	EventHandler
	FunctionHandler
}

// BaseHandler provides a default implementation of Handler interface
type BaseHandler struct {
	HandlerType string
}

// NewBaseHandler creates a new BaseHandler with the specified type
func NewBaseHandler(handlerType string) BaseHandler {
	return BaseHandler{HandlerType: handlerType}
}

func (h *BaseHandler) GetType() string {
	return h.HandlerType
}

// Default implementations that return errors for unimplemented methods
func (h *BaseHandler) HandleEvent(ctx context.Context, log *types.Log, tx *types.Transaction) error {
	return fmt.Errorf("HandleEvent not implemented for this handler")
}

func (h *BaseHandler) HandleFunction(ctx context.Context, tx *types.Transaction) error {
	return fmt.Errorf("HandleFunction not implemented for this handler")
}
