//go:build js && wasm

package main

import (
	"runtime"
	"strconv"
)

// This reports the exact initialization of the pinned math/rand rngSource.
// It does not draw from, reseed, or inspect the live generator.
type sourceHostRandomnessReceipt struct {
	SchemaVersion            string `json:"schemaVersion"`
	Algorithm                string `json:"algorithm"`
	SeedNormalization        string `json:"seedNormalization"`
	Seed                     string `json:"seed"`
	SignedSeed               string `json:"signedSeed"`
	EffectiveSeed            string `json:"effectiveSeed"`
	CritPolicy               string `json:"critPolicy"`
	CriticalTriggeredEffects string `json:"criticalTriggeredEffects"`
	OtherRng                 string `json:"otherRng"`
	GoVersion                string `json:"goVersion"`
}

func makeSourceHostRandomnessReceipt(seedText string, parsedSeed uint64) *sourceHostRandomnessReceipt {
	signed := int64(parsedSeed)
	effective := signed % 2147483647
	if effective < 0 {
		effective += 2147483647
	}
	if effective == 0 {
		effective = 89482311
	}
	return &sourceHostRandomnessReceipt{
		SchemaVersion: "source-host-randomness-v1", Algorithm: "go-math-rand-rngSource-v1",
		SeedNormalization: "uint64-int64-mod2147483647-zero89482311-v1",
		Seed:              seedText, SignedSeed: strconv.FormatInt(signed, 10), EffectiveSeed: strconv.FormatInt(effective, 10),
		CritPolicy: "native-seeded", CriticalTriggeredEffects: "native-sampled", OtherRng: "native-sampled",
		GoVersion: runtime.Version(),
	}
}
