package processor

import (
	"encoding/hex"
	"strings"

	"golang.org/x/crypto/sha3"
)

// extractTypes extracts parameter types from a full parameter definition
func extractTypes(params string) string {
	if params == "" {
		return ""
	}

	// keep in mind that we're using a comma + whitespace delimiter
	// so define defs in yaml accordingly
	parts := strings.Split(params, ", ")
	var types []string

	for _, param := range parts {
		param = strings.TrimSpace(param)
		words := strings.Fields(param)
		// First word is always the type
		types = append(types, words[0])
	}

	return strings.Join(types, ",")
}

// GenerateEventSignature generates the event signature (topic0) from its definition
func GenerateEventSignature(eventDef string) string {
	// Split into name and parameters
	openParen := strings.Index(eventDef, "(")
	closeParen := strings.LastIndex(eventDef, ")")

	if openParen == -1 || closeParen == -1 {
		return ""
	}

	name := eventDef[:openParen]
	params := eventDef[openParen+1 : closeParen]

	// Create canonical signature
	canonicalSig := name + "(" + extractTypes(params) + ")"

	hasher := sha3.NewLegacyKeccak256()
	hasher.Write([]byte(canonicalSig))
	hash := hasher.Sum(nil)

	return "0x" + hex.EncodeToString(hash)
}

// GenerateFunctionSignature generates the function selector (first 4 bytes) from its definition
func GenerateFunctionSignature(funcDef string) (string, string) {
	// Split into name and parameters
	openParen := strings.Index(funcDef, "(")
	closeParen := strings.LastIndex(funcDef, ")")

	if openParen == -1 || closeParen == -1 {
		return "", ""
	}

	name := funcDef[:openParen]
	params := funcDef[openParen+1 : closeParen]

	// Create canonical signature
	canonicalSig := name + "(" + extractTypes(params) + ")"

	hasher := sha3.NewLegacyKeccak256()
	hasher.Write([]byte(canonicalSig))
	hash := hasher.Sum(nil)
	return "0x" + hex.EncodeToString(hash[:4]), name
}
