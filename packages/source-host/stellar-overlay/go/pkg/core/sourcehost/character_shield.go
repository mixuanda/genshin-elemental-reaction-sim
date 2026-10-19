package sourcehost

import (
	"sort"

	"github.com/genshinsim/gcsim/pkg/core/info"
)

// CharacterShieldCompute runs at the original HP creation or refresh write.
// Its scalar response is the value assigned to the real native shield.
func (b *Bridge) CharacterShieldCompute(actorIndex int, ruleID string, state map[string]any,
	statReads []*info.SourceHostStatRead, snapshot *info.Snapshot,
	valueSources ...map[string]int) (float64, int) {
	request := b.Request("character-shield", info.AttackInfo{ActorIndex: actorIndex, Abil: ruleID})
	request.DamageCategory = "character-shield"
	request.StatReads = statReads
	if ruleID == "char-shield-crystallize-bonus-total" {
		request.ScalarProvenance = ScalarProvenance(b.shieldBonusRead)
	}
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
	request.Input = map[string]any{"ruleId": ruleID, "sourceHolderIndex": actorIndex, "state": state}
	return b.Resolve(request)
}
