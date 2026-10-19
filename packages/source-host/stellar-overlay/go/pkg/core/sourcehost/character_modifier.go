package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// CharacterModifierVector is called only from an Amount return whose entire
// vector is fixed by source literals. Native Go still owns every gate and nil
// return. Each shared scalar replaces its original slot in the returned vector.
func (b *Bridge) CharacterModifierVector(sourceHolderIndex int, native []float64, ruleIDs []string, slots []int) []float64 {
	step, read := b.activeCharacterModifierStep()
	values := append([]float64(nil), native...)
	for i, ruleID := range ruleIDs {
		context := info.AttackInfo{ActorIndex: read.ActorIndex, Abil: ruleID}
		request := b.Request("character-modifier", context)
		request.DamageCategory = "character-modifier"
		if read.TargetKey != nil {
			request.TargetKey = *read.TargetKey
		}
		request.Input = map[string]any{
			"ruleId": ruleID, "modifierKey": step.Key, "sourceHolderIndex": sourceHolderIndex,
		}
		value, _ := b.Resolve(request)
		values[slots[i]] = value
	}
	return values
}

func (b *Bridge) activeCharacterModifierStep() (*info.SourceHostStatStep, *info.SourceHostStatRead) {
	step, ok := b.activeFormulaSteps[len(b.activeFormulaSteps)-1].(*info.SourceHostStatStep)
	if !ok {
		panic("character modifier Amount lacks an active stat step")
	}
	read := b.activeStatReadByStep[step]
	if read == nil {
		panic("character modifier Amount lacks its actual consumer read")
	}
	return step, read
}

// CharacterModifierDynamicRead delegates arithmetic at the original Amount
// point. The active step supplies the consumer and target; statRead is only an
// original nested getter, already evaluated once by the caller.
func (b *Bridge) CharacterModifierDynamicRead(sourceHolderIndex int, ruleID string, state map[string]any, statRead *info.SourceHostStatRead) float64 {
	step, read := b.activeCharacterModifierStep()
	request := b.Request("character-modifier", info.AttackInfo{ActorIndex: read.ActorIndex, Abil: ruleID})
	request.DamageCategory = "character-modifier"
	if read.TargetKey != nil {
		request.TargetKey = *read.TargetKey
	}
	request.Input = map[string]any{"ruleId": ruleID, "modifierKey": step.Key,
		"sourceHolderIndex": sourceHolderIndex, "phase": "read", "state": state}
	request.StatRead = statRead
	value, _ := b.Resolve(request)
	return value
}

// CharacterModifierDynamicCreate computes the stored buff number at its
// original creation frame. Its ID is captured and later linked by the Amount
// callback; creation never inherits an unrelated active consumer step.
func (b *Bridge) CharacterModifierDynamicCreate(sourceHolderIndex int, modifierKey, ruleID string, state map[string]any, statRead *info.SourceHostStatRead, additionalReads ...*info.SourceHostStatRead) (float64, int) {
	request := b.Request("character-modifier", info.AttackInfo{ActorIndex: sourceHolderIndex, Abil: ruleID})
	request.DamageCategory = "character-modifier"
	request.Input = map[string]any{"ruleId": ruleID, "modifierKey": modifierKey,
		"sourceHolderIndex": sourceHolderIndex, "phase": "creation", "state": state}
	if len(additionalReads) > 0 {
		request.StatReads = append([]*info.SourceHostStatRead{statRead}, additionalReads...)
	} else {
		request.StatRead = statRead
	}
	return b.Resolve(request)
}

// CharacterModifierSnapshot leaves the original stored vector untouched and
// binds creation receipts only when the original Amount really returns it.
func (b *Bridge) CharacterModifierSnapshot(native []float64, creationIDs ...int) []float64 {
	step, _ := b.activeCharacterModifierStep()
	step.FormulaCalculationIDs = append(step.FormulaCalculationIDs, creationIDs...)
	step.CreationFormulaCalculationIDs = append(step.CreationFormulaCalculationIDs, creationIDs...)
	return native
}
