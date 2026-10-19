package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/attacks"
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

func LunarBranch(tag attacks.AttackTag) string {
	switch tag {
	case attacks.AttackTagDirectLunarCharged:
		return "lunar-charged-direct"
	case attacks.AttackTagDirectLunarBloom:
		return "lunar-bloom-direct"
	case attacks.AttackTagDirectLunarCrystallize:
		return "lunar-crystallize-direct"
	case attacks.AttackTagReactionLunarCharge:
		return "lunar-charged-reaction"
	case attacks.AttackTagReactionLunarCrystallize:
		return "lunar-crystallize-reaction"
	default:
		panic("source-host: attack has no implemented Lunar formula branch")
	}
}

// LunarContributor consumes values already read at the original source point.
// In particular, it must not call Stats/ReactBonus or draw another random value.
func (b *Bridge) LunarContributor(atk *info.AttackEvent, target info.TargetKey, level int, levelBase, reactionBonus, roll float64, critical bool, reactionRead *info.SourceHostScalarRead) (float64, int) {
	r := b.Request("lunar-contributor", atk.Info)
	r.DamageCategory = "lunar-contributor"
	r.TargetKey = int(target)
	r.SourceFrame = atk.SourceFrame
	r.SnapshotFrame = atk.Snapshot.SourceFrame
	r.Snapshot = SnapshotFields(atk.Snapshot)
	stats := atk.Snapshot.Stats
	r.SnapshotStats = &stats
	r.ScalarProvenance = ScalarProvenance(reactionRead)
	r.Input = map[string]any{
		"branch": LunarBranch(atk.Info.AttackTag), "characterLevel": level, "levelBaseDamage": levelBase,
		"elementalMastery": stats[attributes.EM], "baseDamageBonus": atk.Info.BaseDmgBonus,
		"reactionBonus": reactionBonus, "flatDamage": atk.Info.FlatDmg, "elevation": atk.Info.Elevation,
		"critRate": stats[attributes.CR], "critDamage": stats[attributes.CD], "critRoll": roll, "isCrit": critical,
	}
	return b.Resolve(r)
}

// The source stable-sorts the TS contributor results for its existing log/read
// order and displayed-critical decision. TS validates this ranking and computes
// the authoritative weighted total; native weighted products are receipts only.
func (b *Bridge) LunarRanked(atk info.AttackInfo, target info.TargetKey, originalIDs []int, ranked []info.SourceHostComponent, weights []float64, displayCritical bool) (float64, int) {
	r := b.Request("lunar-ranked", atk)
	r.DamageCategory = "lunar-ranked"
	r.TargetKey = int(target)
	r.ComponentIDs = originalIDs
	r.ComponentApplications = ranked
	rankedIDs := make([]int, len(ranked))
	for i, row := range ranked {
		rankedIDs[i] = row.ID
	}
	r.Input = map[string]any{
		"branch": LunarBranch(atk.AttackTag), "rankedContributorIds": rankedIDs,
		"weights": weights, "displayIsCrit": displayCritical,
	}
	return b.Resolve(r)
}

// The source Lunar-Bloom event creates resource/core state; it is not a Lunar
// damage instance. Recording its non-damage formula never creates an HP event.
func (b *Bridge) LunarBloomEvent(atk *info.AttackEvent, target info.TargetKey) {
	r := b.Request("lunar-bloom-event", atk.Info)
	r.DamageCategory = "lunar-bloom-event"
	r.SourceFrame = atk.SourceFrame
	r.SnapshotFrame = atk.Snapshot.SourceFrame
	r.AttackID = atk.SourceHostAttackID
	r.TargetKey = int(target)
	r.Input = map[string]any{"branch": "lunar-bloom-event"}
	value, _ := b.Resolve(r)
	if value != 0 {
		panic("source-host: Lunar-Bloom state event cannot produce damage")
	}
}
