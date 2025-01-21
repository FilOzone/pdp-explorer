package processor

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// GenerateEventSignature generates the event signature (topic0) from its definition
func GenerateEventSignature(eventDef string) string {
	eventDef = strings.ReplaceAll(eventDef, " ", "")

	hash := sha256.Sum256([]byte(eventDef))

	return "0x" + hex.EncodeToString(hash[:])
}

// GenerateFunctionSignature generates the function selector (first 4 bytes) from its definition
func GenerateFunctionSignature(funcDef string) string {
	funcDef = strings.ReplaceAll(funcDef, " ", "")

	hash := sha256.Sum256([]byte(funcDef))
	return "0x" + hex.EncodeToString(hash[:4])
}
