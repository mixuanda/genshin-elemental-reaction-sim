package sourcehost

import (
	"sort"

	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// DrainSourceCompute runs where the source writes DrainInfo.Amount. The
// returned scalar, not the caller's duplicate arithmetic, enters native Drain.
func (b *Bridge) DrainSourceCompute(actorIndex int, ruleID string, state map[string]any,
	statReads []*info.SourceHostStatRead, valueSources ...map[string]int) (float64, int) {
	request := b.Request("character-drain", info.AttackInfo{ActorIndex: actorIndex, Abil: ruleID, Element: attributes.NoElement})
	request.DamageCategory = "character-drain"
	request.Input = map[string]any{"ruleId": ruleID, "sourceHolderIndex": actorIndex, "state": state}
	request.StatReads = statReads
	request.SnapshotFrame = 0
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
