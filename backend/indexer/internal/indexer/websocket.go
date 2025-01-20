package indexer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"

	"github.com/gorilla/websocket"
)

type SubscriptionMessage struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int          `json:"id"`
}

type TipsetNotification struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

// Ethereum subscription types
type EthSubscribeParams struct {
	Subscription string      `json:"subscription"`
	Result       BlockHeader `json:"result"`
}

// BlockHeader represents the Ethereum-style block header
type BlockHeader struct {
	ParentHash       string   `json:"parentHash"`
	Sha3Uncles      string   `json:"sha3Uncles"`
	Miner           string   `json:"miner"`
	StateRoot       string   `json:"stateRoot"`
	TransactionsRoot string   `json:"transactionsRoot"`
	ReceiptsRoot    string   `json:"receiptsRoot"`
	LogsBloom       string   `json:"logsBloom"`
	Difficulty      string   `json:"difficulty"`
	Number          string   `json:"number"`
	GasLimit        string   `json:"gasLimit"`
	GasUsed         string   `json:"gasUsed"`
	Timestamp       string   `json:"timestamp"`
	ExtraData       string   `json:"extraData"`
	MixHash         string   `json:"mixHash"`
	Nonce           string   `json:"nonce"`
	BaseFeePerGas   string   `json:"baseFeePerGas"`
	Hash            string   `json:"hash"`
}

const (
	MethodChainNotify   = "Filecoin.ChainNotify"
	MethodChainVal      = "xrpc.ch.val"
	MethodEthSubscribe  = "Filecoin.EthSubscribe"
)

func (i *Indexer) startWebSocketListener(ctx context.Context) error {
	u, err := url.Parse(i.cfg.LotusSocketUrl)
	if err != nil {
		return fmt.Errorf("invalid websocket URL: %w", err)
	}

	log.Printf("Connecting to WebSocket at %s", u.String())
	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		return fmt.Errorf("websocket dial error: %w", err)
	}
	defer c.Close()

	// Subscribe to newHeads
	if err := i.subscribe(c, MethodEthSubscribe, []interface{}{"newHeads"}); err != nil {
		log.Printf("Failed to subscribe to newHeads: %v", err)
		return err
	}

	log.Println("Successfully subscribed to newHeads")

	for {
		select {
		case <-ctx.Done():
			log.Println("Context cancelled, closing WebSocket connection")
			return nil
		default:
			var notification TipsetNotification
			err := c.ReadJSON(&notification)
			if err != nil {
				log.Printf("Error reading from websocket: %v", err)
				continue
			}

			switch notification.Method {
			case "eth_subscription":
				i.handleEthSubscribe(notification.Params)
			default:
				log.Printf("Unhandled method: %s", notification.Method)
			}
		}
	}
}

func (i *Indexer) subscribe(c *websocket.Conn, method string, params []interface{}) error {
	subscribeMsg := SubscriptionMessage{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
		ID:      1,
	}

	if err := c.WriteJSON(subscribeMsg); err != nil {
		return fmt.Errorf("subscription request failed for %s: %w", method, err)
	}

	log.Printf("Successfully subscribed to %s", method)
	return nil
}

func (i *Indexer) handleEthSubscribe(params json.RawMessage) {
	var ethParams EthSubscribeParams
	if err := json.Unmarshal(params, &ethParams); err != nil {
		log.Printf("Error unmarshaling eth subscription: %v", err)
		return
	}

	header := ethParams.Result
	log.Printf("New block - Number: %s, Hash: %s, Miner: %s, Timestamp: %s", 
		header.Number,
		header.Hash,
		header.Miner,
		header.Timestamp,
	)
}
