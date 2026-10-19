package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

func appendArtifactComponent(atk *info.AttackInfo, id int, value float64) {
	// AttackInfo is copied by the combat queue; preserve the previously
	// captured component slice instead of mutating another attack's backing array.
	components := make([]info.SourceHostComponent, len(atk.SourceHostComponents)+1)
	copy(components, atk.SourceHostComponents)
	components[len(components)-1] = info.SourceHostComponent{ID: id, Multiplier: 1, Amount: value}
	atk.SourceHostComponents = components
}

func (b *Bridge) resolveArtifactAdditive(atk *info.AttackInfo, attackID, targetKey, sourceFrame, snapshotFrame int,
	ruleID string, sourceValue float64, statRead *info.SourceHostStatRead, artifactState map[string]any, scope string) float64 {
	request := b.Request("artifact-additive", *atk)
	request.DamageCategory = "artifact-additive"
	request.AttackID = attackID
	request.TargetKey = targetKey
	request.SourceFrame = sourceFrame
	request.SnapshotFrame = snapshotFrame
	request.StatRead = statRead
	request.ArtifactState = artifactState
	request.ComponentScope = scope
	request.Input = map[string]any{"ruleId": ruleID, "sourceValue": sourceValue}
	value, id := b.Resolve(request)
	appendArtifactComponent(atk, id, value)
	return value
}

// ArtifactAdditiveHit is called at the original FlatDmg calculation point,
// after the native hit gate. It returns the amount added to that same attack.
func (b *Bridge) ArtifactAdditiveHit(atk *info.AttackEvent, target info.TargetKey, ruleID string,
	sourceValue float64, statRead *info.SourceHostStatRead, artifactState map[string]any) float64 {
	return b.resolveArtifactAdditive(&atk.Info, atk.SourceHostAttackID, int(target), atk.SourceFrame,
		atk.Snapshot.SourceFrame, ruleID, sourceValue, statRead, artifactState, "same-hit")
}

// ArtifactAdditiveQueued returns one amount for a queued attack; its component
// ID travels with AttackInfo and can be applied to multiple targets next frame.
func (b *Bridge) ArtifactAdditiveQueued(atk *info.AttackInfo, ruleID string,
	sourceValue float64, artifactState map[string]any) float64 {
	return b.resolveArtifactAdditive(atk, 0, 0, *b.Frame, *b.Frame, ruleID, sourceValue, nil, artifactState, "queued-attack")
}
