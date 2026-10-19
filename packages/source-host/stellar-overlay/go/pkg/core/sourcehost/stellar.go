package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/attacks"
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

func StellarDirectBranch(tag attacks.AttackTag) string {
	switch tag {
	case attacks.AttackTagDirectStellarConduct: return "stellar-conduct-direct"
	case attacks.AttackTagDirectStellarSwirl: return "stellar-swirl-direct"
	default: panic("source-host: no direct Stellar branch for attack tag")
	}
}

func StellarDeliveryBranch(element attributes.Element) string {
	switch element {
	case attributes.Anemo, attributes.Cryo: return "stellar-swirl-delivery"
	default: panic("source-host: Stellar Swirl delivery must be Anemo or Cryo")
	}
}

// Called at each a7 contributor's original snapshot and random-read position.
// The native value is never used when the synchronous resolver is installed.
func (b *Bridge) StellarContributor(atk *info.AttackEvent, target info.TargetKey, branch string, level int, levelBase, multiplier, reactionBonus, roll float64, critical bool, reactionRead *info.SourceHostScalarRead) (float64, int) {
	r := b.Request("stellar-contributor", atk.Info)
	r.DamageCategory = "stellar-contributor"
	r.TargetKey = int(target)
	r.SourceFrame = atk.SourceFrame
	r.SnapshotFrame = atk.Snapshot.SourceFrame
	r.Snapshot = SnapshotFields(atk.Snapshot)
	stats := atk.Snapshot.Stats
	r.SnapshotStats = &stats
	r.ScalarProvenance = ScalarProvenance(reactionRead)
	r.Input = map[string]any{
		"branch": branch, "characterLevel": level, "levelBaseDamage": levelBase,
		"reactionMultiplier": multiplier, "elementalMastery": stats[attributes.EM],
		"baseDamageBonus": atk.Info.BaseDmgBonus, "reactionBonus": reactionBonus,
		"flatDamage": atk.Info.FlatDmg, "elevation": atk.Info.Elevation,
		"critRate": stats[attributes.CR], "critDamage": stats[attributes.CD],
		"critRoll": roll, "isCrit": critical,
	}
	return b.Resolve(r)
}

func (b *Bridge) StellarRanked(atk info.AttackInfo, target info.TargetKey, branch string, originalIDs []int, ranked []info.SourceHostComponent, weights []float64, displayCritical bool) (float64, int) {
	r := b.Request("stellar-ranked", atk)
	r.DamageCategory = "stellar-ranked"
	r.TargetKey = int(target)
	r.ComponentIDs = originalIDs
	r.ComponentApplications = ranked
	rankedIDs := make([]int, len(ranked))
	for i, row := range ranked { rankedIDs[i] = row.ID }
	r.Input = map[string]any{
		"branch": branch, "rankedContributorIds": rankedIDs,
		"weights": weights, "displayIsCrit": displayCritical,
	}
	return b.Resolve(r)
}

func (b *Bridge) StellarConductEvent(atk *info.AttackEvent, target info.TargetKey) {
	r := b.Request("stellar-conduct-event", atk.Info)
	r.DamageCategory = "stellar-conduct-event"
	r.SourceFrame = atk.SourceFrame
	r.SnapshotFrame = atk.Snapshot.SourceFrame
	r.AttackID = atk.SourceHostAttackID
	r.TargetKey = int(target)
	r.Input = map[string]any{"branch": "stellar-conduct-event"}
	value, _ := b.Resolve(r)
	if value != 0 { panic("source-host: Stellar-Conduct state event cannot produce immediate damage") }
}
