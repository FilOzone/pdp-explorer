package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc Service
}

type Service interface {
	GetProviders(offset, limit int) ([]Provider, int, error)
	GetProviderDetails(providerID string) (*ProviderDetails, error)
	GetProofSets(sortBy string, order string, offset, limit int) ([]ProofSet, int, error)
	GetProofSetDetails(proofSetID string, txFilter string) (*ProofSetDetails, error)
	GetProofSetHeatmap(proofSetID string) ([]HeatmapEntry, error)
	GetNetworkMetrics(ctx context.Context) (map[string]interface{}, error)
	Search(ctx context.Context, query string, limit int) ([]map[string]interface{}, error)
	GetProviderProofSets(providerID string, offset, limit int) ([]ProofSet, int, error)
	GetProviderActivities(providerID string, activityType string) ([]Activity, error)
}

type Provider struct {
	ProviderID      string    `json:"providerId"`
	ActiveProofSets int       `json:"activeProofSets"`
	DataSizeStored  int64     `json:"dataSizeStored"`
	NumRoots        int64     `json:"numRoots"`
	FirstSeen       time.Time `json:"firstSeen"`
	LastSeen        time.Time `json:"lastSeen"`
}

type ProofSet struct {
	ProofSetID        string    `json:"proofSetId"`
	Status            bool      `json:"status"`
	FirstRoot         string    `json:"firstRoot"`
	NumRoots          int64     `json:"numRoots"`
	CreatedAt         time.Time `json:"createdAt"`
	LastProofReceived time.Time `json:"lastProofReceived"`
}

type ProviderDetails struct {
	ProviderID        string     `json:"providerId"`
	ActiveProofSets   int        `json:"activeProofSets"`
	AllProofSets      int        `json:"allProofSets"`
	DataSizeStored    int64      `json:"dataSizeStored"`
	TotalPiecesStored int        `json:"totalPiecesStored"`
	Faults            int        `json:"faults"`
	FirstSeen         time.Time  `json:"firstSeen"`
	LastSeen          time.Time  `json:"lastSeen"`
	ProofSets         []ProofSet `json:"proofSets"`
}

type ProofSetDetails struct {
	ProofSetID   string        `json:"proofSetId"`
	Status       bool          `json:"status"`
	FirstRoot    string        `json:"firstRoot"`
	NumRoots     int64         `json:"numRoots"`
	CreatedAt    time.Time     `json:"createdAt"`
	UpdatedAt    time.Time     `json:"updatedAt"`
	Transactions []Transaction `json:"transactions"`
}

type Transaction struct {
	TxID        string    `json:"txId"`
	BlockNumber int64     `json:"blockNumber"`
	Time        time.Time `json:"time"`
	Method      string    `json:"method"`
	Fee         string    `json:"fee"`
	Price       int64     `json:"price"`
	Exponent    int       `json:"exponent"`
}

type HeatmapEntry struct {
	Date        string `json:"date"`
	Status      string `json:"status"`
	RootPieceID string `json:"rootPieceId"`
}

type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Metadata Metadata    `json:"metadata"`
}

type Metadata struct {
	Total  int `json:"total"`
	Offset int `json:"offset"`
	Limit  int `json:"limit"`
}

type Activity struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Timestamp time.Time `json:"timestamp"`
	Details   string    `json:"details"`
}

func NewHandler(svc Service) *Handler {
	return &Handler{
		svc: svc,
	}
}

func (h *Handler) SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.GET("/providers", h.GetProviders)
		api.GET("/providers/:providerId", h.GetProviderDetails)
		api.GET("/providers/:providerId/proof-sets", h.GetProviderProofSets)
		api.GET("/providers/:providerId/activities", h.GetProviderActivities)
		api.GET("/proofsets", h.GetProofSets)
		api.GET("/proofsets/:proofSetId", h.GetProofSetDetails)
		api.GET("/proofsets/:proofSetId/heatmap", h.GetProofSetHeatmap)
		api.GET("/network-metrics", h.GetNetworkMetrics)
		api.GET("/search", h.Search)
	}
}

// GET /providers
func (h *Handler) GetProviders(c *gin.Context) {
	offset, limit := getPaginationParams(c)

	providers, total, err := h.svc.GetProviders(offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginatedResponse{
		Data: providers,
		Metadata: Metadata{
			Total:  total,
			Offset: offset,
			Limit:  limit,
		},
	})
}

// GET /providers/:providerId
func (h *Handler) GetProviderDetails(c *gin.Context) {
	providerID := c.Param("providerId")

	details, err := h.svc.GetProviderDetails(providerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if details == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	c.JSON(http.StatusOK, details)
}

// GET /proofsets
func (h *Handler) GetProofSets(c *gin.Context) {
	offset, limit := getPaginationParams(c)
	sortBy := c.DefaultQuery("sortBy", "proofsSubmitted")
	order := c.DefaultQuery("order", "desc")

	// Validate sort parameters
	validSortBy := map[string]bool{"proofsSubmitted": true, "size": true, "faults": true}
	validOrder := map[string]bool{"asc": true, "desc": true}

	if !validSortBy[sortBy] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sortBy parameter"})
		return
	}
	if !validOrder[order] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order parameter"})
		return
	}

	proofSets, total, err := h.svc.GetProofSets(sortBy, order, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginatedResponse{
		Data: proofSets,
		Metadata: Metadata{
			Total:  total,
			Offset: offset,
			Limit:  limit,
		},
	})
}

// GET /proofsets/:proofSetId
func (h *Handler) GetProofSetDetails(c *gin.Context) {
	proofSetID := c.Param("proofSetId")
	txFilter := c.DefaultQuery("txFilter", "all")

	validFilters := map[string]bool{
		"all": true, "rootsAdded": true, "rootsScheduledRemoved": true,
		"possessionProven": true, "eventLogs": true,
	}

	if !validFilters[txFilter] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid txFilter parameter"})
		return
	}

	details, err := h.svc.GetProofSetDetails(proofSetID, txFilter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if details == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Proof set not found"})
		return
	}

	c.JSON(http.StatusOK, details)
}

// GET /proofsets/:proofSetId/heatmap
func (h *Handler) GetProofSetHeatmap(c *gin.Context) {
	proofSetID := c.Param("proofSetId")

	heatmap, err := h.svc.GetProofSetHeatmap(proofSetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if heatmap == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Proof set not found"})
		return
	}

	c.JSON(http.StatusOK, heatmap)
}

// GET /network-metrics
func (h *Handler) GetNetworkMetrics(c *gin.Context) {
	metrics, err := h.svc.GetNetworkMetrics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

// GET /search
func (h *Handler) Search(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing search query"})
		return
	}

	results, err := h.svc.Search(c.Request.Context(), query, 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

// GET /providers/:providerId/proof-sets
func (h *Handler) GetProviderProofSets(c *gin.Context) {
	providerID := c.Param("providerId")
	offset, limit := getPaginationParams(c)

	proofSets, total, err := h.svc.GetProviderProofSets(providerID, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginatedResponse{
		Data: proofSets,
		Metadata: Metadata{
			Total:  total,
			Offset: offset,
			Limit:  limit,
		},
	})
}

// GET /providers/:providerId/activities
func (h *Handler) GetProviderActivities(c *gin.Context) {
	providerID := c.Param("providerId")
	activityType := c.DefaultQuery("type", "all")

	validTypes := map[string]bool{
		"all":               true,
		"proof_set_created": true,
		"proof_submitted":   true,
		"fault_recorded":    true,
		"onboarding":        true,
		"faults":            true,
	}

	if !validTypes[activityType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid activity type"})
		return
	}

	// Map legacy 'onboarding' type to new 'proof_set_created'
	if activityType == "onboarding" {
		activityType = "proof_set_created"
	} else if activityType == "faults" {
		activityType = "fault_recorded"
	}

	activities, err := h.svc.GetProviderActivities(providerID, activityType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, activities)
}

// Helper function to get pagination parameters
func getPaginationParams(c *gin.Context) (offset, limit int) {
	offset, _ = strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ = strconv.Atoi(c.DefaultQuery("limit", "10"))

	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	return offset, limit
}
