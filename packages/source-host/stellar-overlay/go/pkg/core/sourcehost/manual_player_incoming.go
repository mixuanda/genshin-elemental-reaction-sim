package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// ManualPlayerIncoming identifies Dehya's source-owned off-field self hit.
// The source path deliberately skips the ordinary avatar damage calculator.
func (b *Bridge) ManualPlayerIncoming(atk *info.AttackEvent, target info.TargetKey,
	raw float64, rawSourceID int) (float64, int, int) {
	b.PrepareAttack(atk)
	previousAttackID := b.CurrentPlayerAttackID
	b.CurrentPlayerAttackID = atk.SourceHostAttackID
	request := b.Request("player-manual-incoming", atk.Info)
	request.AttackID, request.TargetKey = atk.SourceHostAttackID, int(target)
	request.SourceFrame, request.DamageCategory = atk.SourceFrame, "player-manual-incoming"
	request.Input = map[string]any{"rawDamage": raw}
	if rawSourceID > 0 {
		id := rawSourceID
		request.RawCalculationID = &id
		request.ComponentIDs = []int{id}
	}
	value, id := b.Resolve(request)
	atk.SourceHostCalculationID = id
	return value, id, previousAttackID
}

// PlayerDrainAmountID selects the actual last minimum result if shields ran,
// or the raw player-hit result when no shield applied.
func (b *Bridge) PlayerDrainAmountID(rawID int) int {
	steps := b.playerSteps[b.CurrentPlayerAttackID]
	if steps != nil && len(steps.shieldIDs) > 0 {
		return steps.shieldIDs[len(steps.shieldIDs)-1]
	}
	return rawID
}

func (b *Bridge) ManualPlayerApplied(atk *info.AttackEvent, target info.TargetKey,
	damagedActor, activeActor int, raw, afterShield, drainAttempted float64, previousAttackID int) {
	b.PlayerApplied(atk, target, activeActor, raw, afterShield, drainAttempted, false)
	b.PlayerApplications[len(b.PlayerApplications)-1].DamagedActorIndex = &damagedActor
	b.CurrentPlayerAttackID = previousAttackID
}
