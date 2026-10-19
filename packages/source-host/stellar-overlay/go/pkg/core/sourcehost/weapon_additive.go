package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// WeaponAdditive replaces only the native flat-damage arithmetic after the
// original OnEnemyHit gates and one original stat read have completed.
func (b *Bridge) WeaponAdditive(atk *info.AttackEvent, target info.TargetKey, ruleID string, refinement int, statValue float64, statRead *info.SourceHostStatRead, weaponState map[string]any) float64 {
	request := b.Request("weapon-additive", atk.Info)
	request.DamageCategory = "weapon-additive"
	request.SourceFrame = atk.SourceFrame
	request.SnapshotFrame = atk.Snapshot.SourceFrame
	request.AttackID = atk.SourceHostAttackID
	request.TargetKey = int(target)
	request.StatRead = statRead
	request.WeaponState = weaponState
	request.Input = map[string]any{"ruleId": ruleID, "refinement": refinement, "statValue": statValue}
	value, id := b.Resolve(request)

	// AttackInfo can share a component backing array with another attack copy.
	components := make([]info.SourceHostComponent, len(atk.Info.SourceHostComponents)+1)
	copy(components, atk.Info.SourceHostComponents)
	components[len(components)-1] = info.SourceHostComponent{ID: id, Multiplier: 1, Amount: value}
	atk.Info.SourceHostComponents = components
	return value
}
