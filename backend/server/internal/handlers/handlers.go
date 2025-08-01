package handlers

import (
	"context"
	"encoding/json"
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
	GetProofSets(sortBy string, order string, offset, limit int) ([]DataSet, int, error)
	GetProofSetDetails(proofSetID string) (*ProofSetDetails, error)
	GetProofSetHeatmap(proofSetID string) ([]HeatmapEntry, error)
	GetNetworkMetrics(ctx context.Context) (map[string]interface{}, error)
	Search(ctx context.Context, query string, limit int) ([]map[string]interface{}, error)
	GetProviderProofSets(providerID string, offset, limit int) ([]DataSet, int, error)
	GetProviderActivities(providerID string, activityType string) ([]Activity, error)
	GetProofSetEventLogs(proofSetID string, filter string, offset, limit int) ([]EventLog, int, error)
	GetProofSetTxs(proofSetID string, filter string, offset, limit int) ([]Transaction, int, error)
	GetProofSetRoots(proofSetID string, orderBy, order string, offset, limit int) ([]Root, int, error)
}

type Provider struct {
	ID                  int64     `json:"id"`
	ProviderID          string    `json:"providerId"`
	TotalFaultedPeriods int64     `json:"totalFaultedPeriods"`
	TotalDataSize       string    `json:"totalDataSize"`
	ProofSetIDs         []int64   `json:"proofSetIds"`
	BlockNumber         int64     `json:"blockNumber"`
	BlockHash           string    `json:"blockHash"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
	ActiveProofSets     int       `json:"activeProofSets"`
	NumRoots            int64     `json:"numRoots"`
	FirstSeen           time.Time `json:"firstSeen"`
	LastSeen            time.Time `json:"lastSeen"`
}

type DataSet struct {
	ID                  int64     `json:"id"`
	SetID               int64     `json:"setId"`
	Owner               string    `json:"owner"`
	ListenerAddr        string    `json:"listenerAddr"`
	TotalFaultedPeriods int64     `json:"totalFaultedPeriods"`
	TotalDataSize       string    `json:"totalDataSize"`
	TotalRoots          int64     `json:"totalRoots"`
	TotalProvedRoots    int64     `json:"totalProvedRoots"`
	TotalFeePaid        string    `json:"totalFeePaid"`
	LastProvenEpoch     int64     `json:"lastProvenEpoch"`
	NextChallengeEpoch  int64     `json:"nextChallengeEpoch"`
	IsActive            bool      `json:"isActive"`
	BlockNumber         int64     `json:"blockNumber"`
	BlockHash           string    `json:"blockHash"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

type ProviderDetails struct {
	ProviderID          string     `json:"providerId"`
	TotalFaultedPeriods int64      `json:"totalFaultedPeriods"`
	TotalDataSize       string     `json:"totalDataSize"`
	ProofSetIDs         []int64    `json:"proofSetIds"`
	BlockNumber         int64      `json:"blockNumber"`
	BlockHash           string     `json:"blockHash"`
	CreatedAt           time.Time  `json:"createdAt"`
	UpdatedAt           time.Time  `json:"updatedAt"`
	ActiveProofSets     int        `json:"activeProofSets"`
	NumRoots            int64      `json:"numRoots"`
	FirstSeen           time.Time  `json:"firstSeen"`
	LastSeen            time.Time  `json:"lastSeen"`
	ProofSets           []DataSet `json:"proofSets"`
}

type ProofSetDetails struct {
	SetID               int64         `json:"setId"`
	Owner               string        `json:"owner"`
	ListenerAddr        string        `json:"listenerAddr"`
	TotalFaultedPeriods int64         `json:"totalFaultedPeriods"`
	TotalDataSize       string        `json:"totalDataSize"`
	TotalRoots          int64         `json:"totalRoots"`
	TotalProvedRoots    int64         `json:"totalProvedRoots"`
	TotalFeePaid        string        `json:"totalFeePaid"`
	LastProvenEpoch     int64         `json:"lastProvenEpoch"`
	NextChallengeEpoch  int64         `json:"nextChallengeEpoch"`
	IsActive            bool          `json:"isActive"`
	BlockNumber         int64         `json:"blockNumber"`
	BlockHash           string        `json:"blockHash"`
	CreatedAt           time.Time     `json:"createdAt"`
	UpdatedAt           time.Time     `json:"updatedAt"`
	ProofsSubmitted     int           `json:"proofsSubmitted"`
	Faults              int           `json:"faults"`
	Transactions        []Transaction `json:"transactions"`
	TotalTransactions   int           `json:"totalTransactions"`
}

type Transaction struct {
	Hash        string    `json:"hash"`
	ProofSetID  int64     `json:"proofSetId"`
	MessageID   string    `json:"messageId"`
	Height      int64     `json:"height"`
	FromAddress string    `json:"fromAddress"`
	ToAddress   string    `json:"toAddress"`
	Value       string    `json:"value"`
	Method      string    `json:"method"`
	Status      bool      `json:"status"`
	BlockNumber int64     `json:"blockNumber"`
	BlockHash   string    `json:"blockHash"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Root struct {
	RootID int64 `json:"rootId"`
	Cid    string `json:"cid"`
	Size   int64  `json:"size"`
	Removed bool `json:"removed"`
	TotalPeriodsFaulted int64 `json:"totalPeriodsFaulted"`
	TotalProofsSubmitted int64 `json:"totalProofsSubmitted"`
	LastProvenEpoch int64 `json:"lastProvenEpoch"`
	LastProvenAt   *time.Time `json:"lastProvenAt"`
	LastFaultedEpoch int64 `json:"lastFaultedEpoch"`
	LastFaultedAt   *time.Time `json:"lastFaultedAt"`
	CreatedAt   time.Time `json:"createdAt"`
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

type EventLog struct {
	SetID           int64           `json:"setId"`
	Address         string          `json:"address"`
	Name            string          `json:"eventName"`
	Data            json.RawMessage `json:"data"`
	LogIndex        int64           `json:"logIndex"`
	Removed         bool            `json:"removed"`
	Topics          []string        `json:"topics"`
	BlockNumber     int64           `json:"blockNumber"`
	BlockHash       string          `json:"blockHash"`
	TransactionHash string          `json:"transactionHash"`
	CreatedAt       time.Time       `json:"createdAt"`
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
		api.GET("/proofsets/:proofSetId/event-logs", h.GetProofSetEventLogs)
		api.GET("/proofsets/:proofSetId/txs", h.GetProofSetTxs)
		api.GET("/proofsets/:proofSetId/roots", h.GetProofSetRoots)
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

	details, err := h.svc.GetProofSetDetails(proofSetID)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter is required"})
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
		"prove_possession": true,
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
		activityType = "prove_possession"
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

// GET /proofsets/:proofSetId/txs
func (h *Handler) GetProofSetTxs(c *gin.Context) {
	proofSetID := c.Param("proofSetId")
	filter := c.DefaultQuery("filter", "all")
	offset, limit := getPaginationParams(c)

	txs, total, err := h.svc.GetProofSetTxs(proofSetID, filter, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginatedResponse{
		Data: txs,
		Metadata: Metadata{
			Total:  total,
			Offset: offset,
			Limit:  limit,
		},
	})
}

// GET /proofsets/:proofSetId/event-logs
func (h *Handler) GetProofSetEventLogs(c *gin.Context) {
	proofSetID := c.Param("proofSetId")
	filter := c.DefaultQuery("filter", "all")
	offset, limit := getPaginationParams(c)

	eventLogs, total, err := h.svc.GetProofSetEventLogs(proofSetID, filter, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginatedResponse{
		Data: eventLogs,
		Metadata: Metadata{
			Total:  total,
			Offset: offset,
			Limit:  limit,
		},
	})
}

// GET /proofsets/:proofSetId/roots
func (h *Handler) GetProofSetRoots(c *gin.Context) {
	proofSetID := c.Param("proofSetId")
	orderBy := c.DefaultQuery("orderBy", "rootId")
	order := c.DefaultQuery("order", "desc")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 10
	}

	roots, total, err := h.svc.GetProofSetRoots(proofSetID, orderBy, order, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, PaginatedResponse{
		Data: roots,
		Metadata: Metadata{
			Total:  total,
			Offset: offset,
			Limit:  limit,
		},
	})
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
