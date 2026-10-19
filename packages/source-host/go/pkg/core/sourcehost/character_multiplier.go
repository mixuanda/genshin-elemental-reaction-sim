package sourcehost

import (
	"sort"

	"github.com/genshinsim/gcsim/pkg/core/info"
)

// CharacterMultiplierCompute evaluates the full next Mult value at the
// original write point. State and statReads are the original observed leaves;
// this helper never invokes a character getter or changes the attack.
func (b *Bridge) CharacterMultiplierCompute(actor int, ruleID string, prior float64,
	state map[string]any, statReads []*info.SourceHostStatRead, priorID int,
	valueSources ...map[string]int) (float64, int) {
	request := b.Request("character-multiplier", info.AttackInfo{ActorIndex: actor})
	request.DamageCategory = "character-multiplier"
	request.StatReads = statReads
	seen := make(map[int]bool)
	if priorID > 0 {
		request.PriorMultiplierCalculationID = &priorID
		request.ComponentIDs = append(request.ComponentIDs, priorID)
		seen[priorID] = true
	}
	if len(valueSources) > 0 {
		request.ValueSources = valueSources[0]
		keys := make([]string, 0, len(request.ValueSources))
		for key := range request.ValueSources {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			id := request.ValueSources[key]
			if !seen[id] {
				request.ComponentIDs = append(request.ComponentIDs, id)
				seen[id] = true
			}
		}
	}
	request.Input = map[string]any{"ruleId": ruleID, "sourceHolderIndex": actor,
		"priorMultiplier": prior, "state": state}
	return b.Resolve(request)
}

// CharacterMultiplierAttach only preserves lineage. The source callback writes
// the shared numeric result to AttackInfo.Mult at its original assignment.
func (b *Bridge) CharacterMultiplierAttach(ai *info.AttackInfo, id int) {
	ai.SourceHostMultiplierID = id
}
