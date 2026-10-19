package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

type TargetPhaseConfig struct {
	Policy string                       `json:"policy"`
	Phases []info.SourceHostTargetPhase `json:"phases"`
}

func (b *Bridge) MatchTargetPhase(target info.TargetKey, frame int) *info.SourceHostTargetPhaseMatch {
	if b.TargetPhases == nil {
		return nil
	}
	for _, row := range b.TargetPhases.Phases {
		if row.TargetKey == int(target) && row.StartFrame <= frame && frame < row.EndFrame {
			return &info.SourceHostTargetPhaseMatch{SourceHostTargetPhase: row, Policy: b.TargetPhases.Policy, Frame: frame}
		}
	}
	return nil
}

// TargetPhaseFutureState includes only windows that can still affect future
// input, with frame offsets relative to the current native boundary.
func (b *Bridge) TargetPhaseFutureState(target info.TargetKey, frame int) []map[string]any {
	rows := []map[string]any{}
	if b.TargetPhases == nil {
		return rows
	}
	for _, row := range b.TargetPhases.Phases {
		if row.TargetKey != int(target) || row.EndFrame <= frame {
			continue
		}
		startsIn := row.StartFrame - frame
		if startsIn < 0 {
			startsIn = 0
		}
		rows = append(rows, map[string]any{
			"id": row.ID, "targetKey": row.TargetKey, "startsInFrames": startsIn,
			"endsInFrames": row.EndFrame - frame, "effects": row.Effects,
		})
	}
	return rows
}

// TargetApplication delegates the final target gate to the shared formula.
// The outgoing calculation and its raw damage remain separate lineage.
func (b *Bridge) TargetApplication(atk *info.AttackEvent, target info.TargetKey, raw, hpBefore float64, damageMode bool) float64 {
	if atk.SourceHostTargetPhase == nil {
		return raw
	}
	request := b.Request("target-application", atk.Info)
	request.DamageCategory = "target-application"
	request.SourceFrame = atk.SourceFrame
	request.SnapshotFrame = atk.Snapshot.SourceFrame
	request.AttackID = atk.SourceHostAttackID
	request.TargetKey = int(target)
	request.RawCalculationID = &atk.SourceHostCalculationID
	request.TargetPhase = atk.SourceHostTargetPhase
	request.Input = map[string]any{"rawDamage": raw, "hpBefore": hpBefore, "damageMode": damageMode}
	value, id := b.Resolve(request)
	atk.SourceHostApplicationCalculationID = id
	return value
}
