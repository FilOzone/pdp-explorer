package handlers

import (
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"strconv"
	"strings"
)

const (
	hexPrefix = "0x"
	zeroAddress = "0x0000000000000000000000000000000000000000"
)

// ParseError represents an error that occurs during parsing blockchain data
type ParseError struct {
	Field string
	Msg   string
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("failed to parse %s: %s", e.Field, e.Msg)
}

// BlockNumberToUint64 converts a block number string (with or without hex prefix) to uint64
func blockNumberToUint64(blockNumber string) (uint64, error) {
	// Remove hex prefix if present
	blockNumber = strings.TrimPrefix(blockNumber, hexPrefix)
	
	if n, ok := new(big.Int).SetString(blockNumber, 16); ok {
		return n.Uint64(), nil
	}
	
	return 0, &ParseError{Field: "block_number", Msg: "invalid number format"}
}

// GetSetIdFromTopic parses a setId from an event topic
func getSetIdFromTopic(topic string) (*big.Int, error) {
	if strings.HasPrefix(topic, hexPrefix) {
		topic = topic[2:]
	}

	setId, ok := new(big.Int).SetString(topic, 16)
	if !ok {
		return nil, &ParseError{Field: "setId", Msg: "invalid hex value"}
	}

	return setId, nil
}

// GetAddressFromTopic parses an Ethereum address from an event topic
func getAddressFromTopic(topic string) (string, error) {
	if strings.HasPrefix(topic, hexPrefix) {
		topic = topic[2:]
	}

	addressHex := topic[25:]
	if len(addressHex) != 40 {
		return "", &ParseError{Field: "address", Msg: "invalid length"}
	}

	address := "0x" + addressHex

	return address, nil
}

// Convert hex to int64
func hexToInt64(hex string) int64 {
	val, _ := strconv.ParseInt(strings.TrimPrefix(hex, "0x"), 16, 64)
	return val
}

// hexToBytes converts a hex string to a byte slice
func hexToBytes(s string) []byte {
	s = strings.TrimPrefix(s, "0x")
	if len(s)%2 == 1 {
		s = "0" + s
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		log.Printf("Error decoding hex string: %v", err)
		return nil
	}
	return b
}

// RemoveIntFromSlice removes an int from a slice if present and returns the new slice with isPresent set to false
func RemoveIntFromSlice(slice []int64, value int64) ([]int64, bool) {
	for i, v := range slice {
		if v == value {
			return append(slice[:i], slice[i+1:]...), true
		}
	}
	return slice, false
}