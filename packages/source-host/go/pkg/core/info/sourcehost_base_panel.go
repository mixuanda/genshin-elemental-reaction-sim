package info

import "github.com/genshinsim/gcsim/pkg/core/attributes"

// SourceHostBaseStep is one operand from the native character or weapon
// catalog recipe. Set and add are deliberately distinct.
type SourceHostBaseStep struct {
	StatIndex         int      `json:"statIndex"`
	Operation         string   `json:"operation"`
	Kind              string   `json:"kind"`
	Value             float64  `json:"value"`
	Base              *float64 `json:"base,omitempty"`
	CurveKey          string   `json:"curveKey,omitempty"`
	CurveIndex        *int     `json:"curveIndex,omitempty"`
	CurveMultiplier   *float64 `json:"curveMultiplier,omitempty"`
	PromotionIndex    *int     `json:"promotionIndex,omitempty"`
	PromotionMaxLevel *int     `json:"promotionMaxLevel,omitempty"`
}

// SourceHostBasePanel retains the actual initialization input and native
// catalog operations. Sampled profile stats are an external RNG input here.
type SourceHostBasePanel struct {
	Version                    string                      `json:"version"`
	ActorIndex                 int                         `json:"actorIndex"`
	CharacterKey               string                      `json:"characterKey"`
	CharacterLevel             int                         `json:"characterLevel"`
	CharacterMaxLevel          int                         `json:"characterMaxLevel"`
	WeaponKey                  string                      `json:"weaponKey"`
	WeaponLevel                int                         `json:"weaponLevel"`
	WeaponMaxLevel             int                         `json:"weaponMaxLevel"`
	WeaponRefinement           int                         `json:"weaponRefinement"`
	InputOrigin                string                      `json:"inputOrigin"`
	ConfiguredStats            attributes.Stats            `json:"configuredStats"`
	ConfiguredLabels           map[string]attributes.Stats `json:"configuredLabels,omitempty"`
	CharacterPromotionIndex    *int                        `json:"characterPromotionIndex,omitempty"`
	CharacterPromotionMaxLevel *int                        `json:"characterPromotionMaxLevel,omitempty"`
	WeaponPromotionIndex       *int                        `json:"weaponPromotionIndex,omitempty"`
	WeaponPromotionMaxLevel    *int                        `json:"weaponPromotionMaxLevel,omitempty"`
	CharacterSteps             []SourceHostBaseStep        `json:"characterSteps"`
	WeaponSteps                []SourceHostBaseStep        `json:"weaponSteps"`
	CharacterStats             attributes.Stats            `json:"characterStats"`
	WeaponStats                attributes.Stats            `json:"weaponStats"`
	Result                     attributes.Stats            `json:"result"`
}
