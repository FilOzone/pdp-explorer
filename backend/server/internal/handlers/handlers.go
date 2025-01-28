package handlers

import (
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
	Status            string    `json:"status"`
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
	Status       string        `json:"status"`
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
		api.GET("/proofsets", h.GetProofSets)
		api.GET("/proofsets/:proofSetId", h.GetProofSetDetails)
		api.GET("/proofsets/:proofSetId/heatmap", h.GetProofSetHeatmap)
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
