package sourcehost

import (
	"sort"

	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// HealSourceCompute runs at the original HealInfo.Src or Bonus producer. The
// returned value is stored by that producer; later targets consume its ID.
func (b *Bridge) HealSourceCompute(actorIndex int, ruleID string, state map[string]any,
	statReads []*info.SourceHostStatRead, snapshot *info.Snapshot,
	valueSources ...map[string]int) (float64, int) {
	request := b.Request("character-healing", info.AttackInfo{ActorIndex: actorIndex, Abil: ruleID, Element: attributes.NoElement})
	request.DamageCategory = "character-healing"
	request.Input = map[string]any{"operation": "source", "ruleId": ruleID,
		"sourceHolderIndex": actorIndex, "state": state}
	request.StatReads = statReads
	request.SnapshotFrame = 0
	if snapshot != nil {
		request.SnapshotFrame = snapshot.SourceFrame
		request.SnapshotStats = &snapshot.Stats
		request.Snapshot = SnapshotFields(*snapshot)
	}
	if len(valueSources) > 0 {
		request.ValueSources = valueSources[0]
		keys := make([]string, 0, len(request.ValueSources))
		for key := range request.ValueSources {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		seen := make(map[int]bool)
		for _, key := range keys {
			id := request.ValueSources[key]
			if !seen[id] {
				request.ComponentIDs = append(request.ComponentIDs, id)
				seen[id] = true
			}
		}
	}
	return b.Resolve(request)
}

// CharacterHealing returns the scalar used at this original healing stage.
// Getter receipts are passed from the one actual read at the call site.
func (b *Bridge) CharacterHealing(actorIndex int, source string, input map[string]any,
	statRead *info.SourceHostStatRead, bonusRead *info.SourceHostScalarRead, componentIDs []int) (float64, int) {
	request := b.Request("character-healing", info.AttackInfo{ActorIndex: actorIndex, Abil: source, Element: attributes.NoElement})
	request.DamageCategory = "character-healing"
	request.Input = input
	request.StatRead = statRead
	request.ScalarProvenance = ScalarProvenance(bonusRead)
	if len(componentIDs) > 0 {
		request.ComponentIDs = append([]int{}, componentIDs...)
	}
	return b.Resolve(request)
}

// The source character interface dynamically dispatches ReceiveHeal. This
// stack links the actual character override and template ReceiveHeal stages for this Heal.
func (b *Bridge) BeginHealing(amountID int) {
	b.healingContexts = append(b.healingContexts, healingContext{amountID: amountID})
}

func (b *Bridge) CurrentHealingAmountID() int {
	if len(b.healingContexts) == 0 {
		return 0
	}
	return b.healingContexts[len(b.healingContexts)-1].amountID
}

// RecordHealingDelegation makes the native template receive stage consume the
// observed character branch receipt while Heal retains its original amount ID.
func (b *Bridge) RecordHealingDelegation(id int) {
	if len(b.healingContexts) == 0 {
		return
	}
	b.healingContexts[len(b.healingContexts)-1].amountID = id
}

func (b *Bridge) RecordHealingReceive(id int) {
	if len(b.healingContexts) == 0 {
		return
	}
	b.healingContexts[len(b.healingContexts)-1].receiveID = id
}

func (b *Bridge) EndHealing() int {
	last := len(b.healingContexts) - 1
	if last < 0 {
		return 0
	}
	id := b.healingContexts[last].receiveID
	b.healingContexts = b.healingContexts[:last]
	return id
}

// RecordHealingApplication uses only values already read for the original log
// and callback; it never asks the character to recompute HP or debt.
func (b *Bridge) RecordHealingApplication(actorIndex, callerIndex int, source string,
	baseID, bonusID, amountID, receiveID, overhealID int,
	previousHP, previousDebt, currentHP, currentDebt, finalAmount, received, overheal float64) {
	var receive *int
	if receiveID > 0 {
		id := receiveID
		receive = &id
	}
	b.HealingApplications = append(b.HealingApplications, HealingApplication{
		ID: len(b.HealingApplications) + 1, Frame: *b.Frame, ActorIndex: actorIndex,
		ActorKey: b.ActorKeys[actorIndex], Source: source, CallerIndex: callerIndex, TargetIndex: actorIndex,
		BaseCalculationID: baseID, BonusCalculationID: bonusID, AmountCalculationID: amountID,
		ReceiveCalculationID: receive, OverhealCalculationID: overhealID,
		PreviousHP: previousHP, PreviousHPDebt: previousDebt, CurrentHP: currentHP, CurrentHPDebt: currentDebt,
		FinalAmount: finalAmount, ReceivedAmount: received, Overheal: overheal,
	})
}
