package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// ArtifactResistanceScalar resolves the debuff's signed Value once at its
// original creation point. Later resistance getters only read the stored value.
func (b *Bridge) ArtifactResistanceScalar(holder int, ruleID string, target info.TargetKey, element attributes.Element, attack *info.AttackInfo, attackID int) (float64, int) {
	context := info.AttackInfo{ActorIndex: holder, Element: element}
	if attack != nil {
		context = *attack
		context.ActorIndex = holder
		context.Element = element
	}
	request := b.Request("artifact-scalar", context)
	request.ActorIndex, request.ActorKey = holder, b.ActorKeys[holder]
	request.TargetKey, request.Element = int(target), element.String()
	request.AttackID, request.DamageCategory = attackID, "artifact-scalar"
	request.Input = map[string]any{"ruleId": ruleID}
	// Creation happens during a native event, not inside a modifier Amount. Do
	// not attach this ID to an unrelated active scalar/stat read; the ResistMod
	// retains it until a later resistance getter actually applies the debuff.
	active := b.activeFormulaSteps
	b.activeFormulaSteps = nil
	defer func() { b.activeFormulaSteps = active }()
	return b.Resolve(request)
}

// The formula ran at creation time; attach its receipt only if the original
// resistance getter actually applies this still-live modifier.
func FinishArtifactResistanceStep(step *info.SourceHostScalarStep, mod *info.ResistMod) {
	if step == nil || mod.SourceHostArtifactResistance == nil {
		return
	}
	meta := *mod.SourceHostArtifactResistance
	step.FormulaCalculationIDs = append(step.FormulaCalculationIDs, meta.FormulaCalculationID)
	step.ArtifactResistance = &meta
}
