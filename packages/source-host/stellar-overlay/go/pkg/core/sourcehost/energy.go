package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// CharacterEnergy delegates one numeric operation after the original caller
// has chosen its recipient, source, timing, and any particle ER getter.
func (b *Bridge) CharacterEnergy(actorIndex int, source string, element attributes.Element,
	input map[string]any, statRead *info.SourceHostStatRead, amountCalculationID int) (float64, int) {
	request := b.Request("character-energy", info.AttackInfo{ActorIndex: actorIndex, Abil: source, Element: element})
	request.DamageCategory = "character-energy"
	request.StatRead = statRead
	request.Input = input
	if input["operation"] == "flat-change" {
		switch source {
		case "exile-4pc":
			input["artifactRule"] = "exile"
		case "scholar-4pc":
			input["artifactRule"] = "scholar"
		case "scroll-2pc":
			input["artifactRule"] = "scroll"
		case "shim-4pc":
			input["artifactRule"] = "reminiscence"
		}
	}
	if amountCalculationID > 0 {
		request.ComponentIDs = []int{amountCalculationID}
	}
	return b.Resolve(request)
}

// RecordEnergyApplication is called after the original Energy assignment and
// before its original event emission. Particle amount alone has no application.
func (b *Bridge) RecordEnergyApplication(calculationID, actorIndex int, source, operation string,
	before, after, requestedAmount, energyMax float64, amountCalculationID int) {
	var amountID *int
	if amountCalculationID > 0 {
		id := amountCalculationID
		amountID = &id
	}
	b.EnergyApplications = append(b.EnergyApplications, EnergyApplication{
		ID: len(b.EnergyApplications) + 1, CalculationID: calculationID, Frame: *b.Frame,
		ActorIndex: actorIndex, ActorKey: b.ActorKeys[actorIndex], Source: source, Operation: operation,
		EnergyBefore: before, EnergyAfter: after, RequestedAmount: requestedAmount,
		EnergyMax: energyMax, AmountCalculationID: amountID,
	})
}
