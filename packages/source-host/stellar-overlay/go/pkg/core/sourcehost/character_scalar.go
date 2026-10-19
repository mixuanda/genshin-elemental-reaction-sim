package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

func (b *Bridge) activeCharacterScalarStep() (*info.SourceHostScalarStep, *info.SourceHostScalarRead) {
	if len(b.activeFormulaSteps) == 0 {
		panic("character scalar Amount lacks an active scalar step")
	}
	step, ok := b.activeFormulaSteps[len(b.activeFormulaSteps)-1].(*info.SourceHostScalarStep)
	if !ok {
		panic("character scalar Amount is not the active scalar step")
	}
	read := b.activeScalarReadByStep[step]
	if read == nil {
		panic("character scalar Amount lacks its actual scalar read")
	}
	return step, read
}

// CharacterScalarRead delegates arithmetic at the original Amount point. The
// active scalar read supplies the recipient, frame and modifier key; statRead
// is only the original nested getter, already evaluated once by the caller.
func (b *Bridge) CharacterScalarRead(sourceHolderIndex int, ruleID string, state map[string]any, statRead *info.SourceHostStatRead, valueSources ...map[string]int) float64 {
	step, read := b.activeCharacterScalarStep()
	actor := sourceHolderIndex
	if read.ActorIndex != nil {
		actor = *read.ActorIndex
	}
	request := b.Request("character-scalar", info.AttackInfo{ActorIndex: actor, Abil: ruleID})
	request.DamageCategory = "character-scalar"
	request.Element = read.Element
	if read.TargetKey != nil {
		request.TargetKey = *read.TargetKey
	}
	request.Input = map[string]any{"ruleId": ruleID, "modifierKey": step.Key,
		"sourceHolderIndex": sourceHolderIndex, "phase": "read", "state": state}
	request.StatRead = statRead
	if len(valueSources) > 0 {
		request.ValueSources = valueSources[0]
	}
	value, _ := b.Resolve(request)
	return value
}

// CharacterScalarCreate writes a shared value into the original stored buff
// at its native creation or refresh frame. It never borrows an active Amount.
func (b *Bridge) CharacterScalarCreate(sourceHolderIndex int, modifierKey, ruleID string, state map[string]any, statRead *info.SourceHostStatRead) (float64, int) {
	request := b.Request("character-scalar", info.AttackInfo{ActorIndex: sourceHolderIndex, Abil: ruleID})
	request.DamageCategory, request.Element = "character-scalar", ""
	request.Input = map[string]any{"ruleId": ruleID, "modifierKey": modifierKey,
		"sourceHolderIndex": sourceHolderIndex, "phase": "creation", "state": state}
	request.StatRead = statRead
	return b.Resolve(request)
}

// CharacterScalarSnapshot associates the scalar actually returned by this
// Amount with its earlier creation calculation, including an initial zero.
func (b *Bridge) CharacterScalarSnapshot(value float64, creationID int) float64 {
	step, _ := b.activeCharacterScalarStep()
	step.FormulaCalculationIDs = append(step.FormulaCalculationIDs, creationID)
	step.CreationFormulaCalculationIDs = append(step.CreationFormulaCalculationIDs, creationID)
	return value
}
