package sourcehost

// PhaseInput is emitted by the native evaluator at an actual input marker.
// Its environment is carried into normalizedState.input, never inferred from a label.
type PhaseInput struct {
	RepeatID             string         `json:"repeatId"`
	Position             int            `json:"position"`
	Iteration            int            `json:"iteration"`
	FutureInputSignature string         `json:"futureInputSignature"`
	VerifiedRepeat       bool           `json:"verifiedRepeat"`
	InputState           map[string]any `json:"-"`
	InputGaps            []string       `json:"-"`
}
type PhaseConfig struct {
	WarmupFrames               int `json:"warmupFrames"`
	MaxPeriod                  int `json:"maxPeriod"`
	RequiredConsecutivePeriods int `json:"requiredConsecutivePeriods"`
	MaxObservations            int `json:"maxObservations"`
}
type PhaseCoverage struct {
	Complete  bool     `json:"complete"`
	Providers []string `json:"providers"`
	Gaps      []string `json:"gaps"`
}
type PhaseObservation struct {
	Boundary         string         `json:"boundary"`
	Frame            int            `json:"frame"`
	InputPhase       PhaseInput     `json:"inputPhase"`
	Determinism      string         `json:"determinism"`
	NormalizedState  map[string]any `json:"normalizedState"`
	Coverage         PhaseCoverage  `json:"coverage"`
	CumulativeDamage float64        `json:"cumulativeDamage"`
	// Sum of actual enemy applications after the previous marker, not a subtraction of large cumulative totals.
	DamageSincePreviousBoundary *float64 `json:"damageSincePreviousBoundary,omitempty"`
}
