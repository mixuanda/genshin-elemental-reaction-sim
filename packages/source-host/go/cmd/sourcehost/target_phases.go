//go:build js && wasm

package main

import (
	"fmt"

	"github.com/genshinsim/gcsim/pkg/core"
	"github.com/genshinsim/gcsim/pkg/core/sourcehost"
)

func validateTargetPhases(config *sourcehost.TargetPhaseConfig, targetCount int) error {
	if config == nil {
		return nil
	}
	if config.Policy != "declared-target-phases-v1" {
		return fmt.Errorf("unsupported targetPhases policy %q", config.Policy)
	}
	for i, row := range config.Phases {
		if row.TargetIndex < 0 || row.TargetIndex >= targetCount {
			return fmt.Errorf("target phase %q references target index %d outside declared targets", row.ID, row.TargetIndex)
		}
		if row.ID == "" || row.StartFrame < 0 || row.StartFrame >= row.EndFrame {
			return fmt.Errorf("target phase %q requires a nonempty id and 0 <= startFrame < endFrame", row.ID)
		}
		if row.Effects.Damage != "normal" && row.Effects.Damage != "immune" ||
			row.Effects.Aura != "normal" && row.Effects.Aura != "blocked" ||
			row.Effects.HitConfirm != "normal" && row.Effects.HitConfirm != "blocked" {
			return fmt.Errorf("target phase %q has unsupported effects", row.ID)
		}
		for _, previous := range config.Phases[:i] {
			if previous.TargetIndex != row.TargetIndex {
				continue
			}
			if previous.ID == row.ID {
				return fmt.Errorf("duplicate target phase id %q for target index %d", row.ID, row.TargetIndex)
			}
			if row.StartFrame < previous.EndFrame && previous.StartFrame < row.EndFrame {
				return fmt.Errorf("overlapping target phases %q and %q for target index %d", previous.ID, row.ID, row.TargetIndex)
			}
		}
	}
	return nil
}

func bindTargetPhases(config *sourcehost.TargetPhaseConfig, c *core.Core) {
	if config == nil {
		return
	}
	for i := range config.Phases {
		row := &config.Phases[i]
		row.TargetKey = int(c.Combat.Enemy(row.TargetIndex).Key())
	}
}
