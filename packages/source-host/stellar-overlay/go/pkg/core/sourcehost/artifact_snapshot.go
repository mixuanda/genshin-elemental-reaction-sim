package sourcehost

import (
	"fmt"

	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// ArtifactSnapshot delegates a native event callback's direct CR addition.
// The callback retains its own event, aura/status, and target gates. This
// receipt describes a snapshot write, not a modifier Amount or stat getter.
func (b *Bridge) ArtifactSnapshot(ae *info.AttackEvent, target info.TargetKey, holder int, callbackKey, ruleID string, input map[string]any) {
	before := ae.Snapshot.Stats
	index := int(target)
	step := &info.SourceHostStatStep{
		Index: 0, Key: callbackKey, ExpiryBefore: -1, ExpiryAfter: -1,
		AffectedStat: int(attributes.CR), Outcome: "applied",
		Before: before, AfterAmount: before, After: before,
		AttackChanges: []info.SourceHostNumericChange{}, Dependencies: []*info.SourceHostStatRead{},
	}
	b.BeginStatFormulaStep(step)
	value := b.ArtifactScalar(ae.Info.ActorIndex, ruleID, input, &ae.Info, ae.SourceHostAttackID, target)
	b.EndStatFormulaStep(step)
	read := &info.SourceHostStatRead{
		ID: fmt.Sprintf("artifact-snapshot-%d", step.FormulaCalculationIDs[0]),
		Kind: "artifact-snapshot", Frame: *b.Frame,
		ActorIndex: ae.Info.ActorIndex, TargetKey: &index, EffectSourceActorIndex: &holder,
		Selector: []attributes.Stat{attributes.CR}, NonExtra: false,
		Base: before, Result: before, Steps: []*info.SourceHostStatStep{step},
	}

	returned := make([]float64, attributes.EndStatType)
	returned[attributes.CR] = value
	step.Returned = returned
	ae.Snapshot.Stats[attributes.CR] += value
	step.After = ae.Snapshot.Stats
	read.Result = ae.Snapshot.Stats
	AppendAttackStatRead(&ae.Snapshot, read)
}
