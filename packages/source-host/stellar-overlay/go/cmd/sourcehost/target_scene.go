//go:build js && wasm

package main

import (
	"encoding/json"

	"github.com/genshinsim/gcsim/pkg/core"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// targetScene is captured after native target and character initialization,
// before the first simulation frame or scripted action. The declaration index
// is presentation metadata; targetKey comes from the actual native object.
type targetScene struct {
	DamageMode              bool                `json:"damageMode"`
	PrimaryTargetIndex      int                 `json:"primaryTargetIndex"`
	InitialDefaultTargetKey int                 `json:"initialDefaultTargetKey"`
	Targets                 []targetSceneTarget `json:"targets"`
}

type targetSceneTarget struct {
	DeclarationIndex int             `json:"declarationIndex"`
	TargetKey        int             `json:"targetKey"`
	Profile          json.RawMessage `json:"profile"`
	Position         targetPosition  `json:"position"`
	InitialHP        float64         `json:"initialHP"`
	InitialMaxHP     float64         `json:"initialMaxHP"`
}

type targetPosition struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Radius float64 `json:"radius"`
}

func captureTargetScene(config *info.ActionList, c *core.Core, primaryTargetIndex int) targetScene {
	targets := make([]targetSceneTarget, len(config.Targets))
	for i, profile := range config.Targets {
		native := c.Combat.Enemy(i).(info.Enemy)
		targets[i] = targetSceneTarget{
			DeclarationIndex: i,
			TargetKey:        int(native.Key()),
			Profile:          json.RawMessage(encode(profile)),
			Position:         targetPosition{X: profile.Pos.X, Y: profile.Pos.Y, Radius: profile.Pos.R},
			InitialHP:        native.HP(),
			InitialMaxHP:     native.MaxHP(),
		}
	}
	return targetScene{
		DamageMode:              c.Combat.DamageMode,
		PrimaryTargetIndex:      primaryTargetIndex,
		InitialDefaultTargetKey: int(c.Combat.DefaultTarget),
		Targets:                 targets,
	}
}
