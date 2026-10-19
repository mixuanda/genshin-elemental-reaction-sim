package sourcehost

import (
	"sort"

	"github.com/genshinsim/gcsim/pkg/core/info"
)

// FlatPriorComponent records the component that was active immediately before
// a native FlatDmg write. Scope preserves the two separate component arrays.
type FlatPriorComponent struct {
	ID         int     `json:"id"`
	Multiplier float64 `json:"multiplier"`
	Amount     float64 `json:"amount"`
	Scope      string  `json:"scope"`
}

// CharacterFlatPrior reads only the existing component receipts. It does not
// read stats or mutate an attack, and may be called before a snapshot exists.
func CharacterFlatPrior(ai *info.AttackInfo, snapshot *info.Snapshot) []FlatPriorComponent {
	prior := []FlatPriorComponent{}
	if snapshot != nil {
		for _, component := range snapshot.SourceHostComponents {
			prior = append(prior, FlatPriorComponent{component.ID, component.Multiplier, component.Amount, "snapshot"})
		}
	}
	if ai != nil {
		for _, component := range ai.SourceHostComponents {
			prior = append(prior, FlatPriorComponent{component.ID, component.Multiplier, component.Amount, "attack-info"})
		}
	}
	return prior
}

func (b *Bridge) CharacterFlatPrior(ai *info.AttackInfo, snapshot *info.Snapshot) []FlatPriorComponent {
	return CharacterFlatPrior(ai, snapshot)
}

// CharacterFlatCompute evaluates the entire result of the source's next set,
// add, or multiply clause. Call at the original expression position with the
// original state leaves and ordered getter receipts; no getter is repeated.
func (b *Bridge) CharacterFlatCompute(actorIndex int, ruleID string, priorFlat float64,
	state map[string]any, statReads []*info.SourceHostStatRead, snapshot *info.Snapshot,
	priorComponents []FlatPriorComponent, valueSources ...map[string]int) (float64, int) {
	return b.CharacterFlatComputeForActor(actorIndex, actorIndex, ruleID, priorFlat, state,
		statReads, snapshot, priorComponents, valueSources...)
}

// CharacterFlatComputeForActor preserves the actual damage actor separately
// from the holder whose source-owned numeric clause is being evaluated.
func (b *Bridge) CharacterFlatComputeForActor(actorIndex, holderIndex int, ruleID string, priorFlat float64,
	state map[string]any, statReads []*info.SourceHostStatRead, snapshot *info.Snapshot,
	priorComponents []FlatPriorComponent, valueSources ...map[string]int) (float64, int) {
	request := b.Request("character-flat", info.AttackInfo{ActorIndex: actorIndex})
	request.DamageCategory = "character-flat"
	request.ComponentScope = "queued-attack"
	request.SnapshotFrame = 0
	if snapshot != nil {
		request.SnapshotFrame = snapshot.SourceFrame
		request.SnapshotStats = &snapshot.Stats
		request.Snapshot = SnapshotFields(*snapshot)
	}
	request.StatReads = statReads
	prior := append([]FlatPriorComponent{}, priorComponents...)
	request.PriorComponents = &prior
	seen := make(map[int]bool)
	for _, component := range prior {
		if !seen[component.ID] {
			request.ComponentIDs = append(request.ComponentIDs, component.ID)
			seen[component.ID] = true
		}
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
	request.Input = map[string]any{"ruleId": ruleID, "sourceHolderIndex": holderIndex,
		"priorFlatDamage": priorFlat, "state": state}
	return b.Resolve(request)
}

// CharacterFlatAttach replaces the active component lineage after the caller
// writes the shared full result to the original FlatDmg slot. Replacement
// isolates already queued AttackInfo/Snapshot copies that share old slices.
func CharacterFlatAttach(ai *info.AttackInfo, snapshot *info.Snapshot, id int, value float64) {
	if snapshot != nil {
		snapshot.SourceHostComponents = []info.SourceHostComponent{}
	}
	ai.SourceHostComponents = []info.SourceHostComponent{{ID: id, Multiplier: 1, Amount: value}}
}

func (b *Bridge) CharacterFlatAttach(ai *info.AttackInfo, snapshot *info.Snapshot, id int, value float64) {
	CharacterFlatAttach(ai, snapshot, id, value)
}
