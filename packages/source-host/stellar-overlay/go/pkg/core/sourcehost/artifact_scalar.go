package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// ArtifactScalar delegates only an already-applicable modifier Amount to the
// shared formula. Native callbacks, stack counters, expiries and nil gates stay
// in their original Go locations.
func (b *Bridge) ArtifactScalar(actor int, ruleID string, state map[string]any, attack *info.AttackInfo, attackID int, targetKeys ...info.TargetKey) float64 {
	context := info.AttackInfo{ActorIndex: actor}
	if attack != nil {
		context = *attack
	}
	request := b.Request("artifact-scalar", context)
	request.ActorIndex, request.ActorKey = actor, b.ActorKeys[actor]
	request.AttackID, request.DamageCategory = attackID, "artifact-scalar"
	if len(targetKeys) > 0 {
		request.TargetKey = int(targetKeys[0])
	}
	if attack == nil {
		request.Ability, request.Element = ruleID, ""
	}
	request.Input = make(map[string]any, len(state)+1)
	for key, value := range state {
		request.Input[key] = value
	}
	request.Input["ruleId"] = ruleID
	value, _ := b.Resolve(request)
	return value
}

// The stack is shared across characters because synchronous modifier reads
// can nest. Only the top Amount step receives a direct formula calculation ID.
func (b *Bridge) BeginStatFormulaStep(step *info.SourceHostStatStep, reads ...*info.SourceHostStatRead) {
	if step != nil {
		b.activeFormulaSteps = append(b.activeFormulaSteps, step)
		if len(reads) > 0 {
			b.activeStatReadByStep[step] = reads[0]
		}
	}
}

func (b *Bridge) EndStatFormulaStep(step *info.SourceHostStatStep) {
	b.endFormulaStep(step)
	delete(b.activeStatReadByStep, step)
}

func (b *Bridge) BeginScalarFormulaStep(step *info.SourceHostScalarStep, reads ...*info.SourceHostScalarRead) {
	if step != nil {
		b.activeFormulaSteps = append(b.activeFormulaSteps, step)
		if len(reads) > 0 {
			b.activeScalarReadByStep[step] = reads[0]
		}
	}
}

func (b *Bridge) EndScalarFormulaStep(step *info.SourceHostScalarStep) {
	b.endFormulaStep(step)
	delete(b.activeScalarReadByStep, step)
}

func (b *Bridge) endFormulaStep(step any) {
	if step == nil {
		return
	}
	n := len(b.activeFormulaSteps)
	if n == 0 || b.activeFormulaSteps[n-1] != step {
		panic("source-host modifier Amount formula step order changed")
	}
	b.activeFormulaSteps = b.activeFormulaSteps[:n-1]
}
