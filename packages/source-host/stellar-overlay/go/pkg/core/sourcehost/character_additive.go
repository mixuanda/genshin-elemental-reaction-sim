package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// CharacterAdditiveCreate evaluates a source-owned value at its native creation
// point. The caller stores both the returned value and ID for later consumption.
func (b *Bridge) CharacterAdditiveCreate(holderIndex int, ruleID string, state map[string]any,
	statRead *info.SourceHostStatRead) (float64, int) {
	request := b.Request("character-additive", info.AttackInfo{ActorIndex: holderIndex})
	request.DamageCategory = "character-additive"
	request.StatRead = statRead
	request.Input = map[string]any{"ruleId": ruleID, "sourceHolderIndex": holderIndex,
		"phase": "creation", "state": state}
	return b.Resolve(request)
}

// CharacterAdditiveHit replaces only the flat-damage operand after the native
// hit gates and reads. The caller adds the returned value to the same attack.
func (b *Bridge) CharacterAdditiveHit(atk *info.AttackEvent, target info.TargetKey, ruleID string,
	holderIndex int, state map[string]any, statRead *info.SourceHostStatRead,
	valueSources ...map[string]int) float64 {
	return b.characterAdditiveHit(atk, target, ruleID, holderIndex, state, statRead, nil, valueSources...)
}

// CharacterAdditiveHitWithReads preserves the original order of multiple
// getter receipts without invoking either getter again.
func (b *Bridge) CharacterAdditiveHitWithReads(atk *info.AttackEvent, target info.TargetKey, ruleID string,
	holderIndex int, state map[string]any, statReads []*info.SourceHostStatRead,
	valueSources ...map[string]int) float64 {
	return b.characterAdditiveHit(atk, target, ruleID, holderIndex, state, nil, statReads, valueSources...)
}

func (b *Bridge) characterAdditiveHit(atk *info.AttackEvent, target info.TargetKey, ruleID string,
	holderIndex int, state map[string]any, statRead *info.SourceHostStatRead,
	statReads []*info.SourceHostStatRead, valueSources ...map[string]int) float64 {
	request := b.Request("character-additive", atk.Info)
	request.DamageCategory = "character-additive"
	request.SourceFrame = atk.SourceFrame
	request.SnapshotFrame = atk.Snapshot.SourceFrame
	request.AttackID = atk.SourceHostAttackID
	request.TargetKey = int(target)
	request.ComponentScope = "same-hit"
	request.SnapshotStats = &atk.Snapshot.Stats
	request.Snapshot = SnapshotFields(atk.Snapshot)
	request.StatRead = statRead
	request.StatReads = statReads
	if len(valueSources) > 0 {
		request.ValueSources = valueSources[0]
	}
	request.Input = map[string]any{"ruleId": ruleID, "sourceHolderIndex": holderIndex,
		"phase": "hit", "state": state}
	value, id := b.Resolve(request)

	// AttackInfo can share its component backing array with another attack copy.
	components := make([]info.SourceHostComponent, len(atk.Info.SourceHostComponents)+1)
	copy(components, atk.Info.SourceHostComponents)
	components[len(components)-1] = info.SourceHostComponent{ID: id, Multiplier: 1, Amount: value}
	atk.Info.SourceHostComponents = components
	return value
}
