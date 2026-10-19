package enemy

import (
	"github.com/genshinsim/gcsim/pkg/core/attacks"
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/glog"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/sourcehost"
)

// calcSourceHost preserves source sampling and RNG order; only arithmetic is
// delegated. Its returned value enters the original applyDamage/callback path.
func (e *Enemy) calcSourceHost(atk *info.AttackEvent, evt glog.Event, group float64) (float64, bool) {
	if atk.Info.AttackTag.IsDirect() {
		return e.calcSourceHostDirectSpecial(atk, evt, group)
	}
	b := e.Core.SourceHost
	kind := "damage"
	if atk.Info.AttackTag.IsLunarReact() {
		kind = "lunar-delivery"
	} else if atk.Info.AttackTag.IsStellarReact() {
		kind = "stellar-delivery"
	}
	r := e.sourceHostDamageRequest(atk, kind)
	if kind == "damage" && atk.Info.AttackTag.IsReaction() {
		r.DamageCategory = "transformative"
	}
	bonus := 0.0
	if atk.Info.AttackTag < attacks.AttackTagNoneStat {
		if stat := attributes.EleToDmgP(atk.Info.Element); stat > -1 {
			bonus += atk.Snapshot.Stats[stat]
		}
		bonus += atk.Snapshot.Stats[attributes.DmgP]
	}
	scalingStat := "atk"
	scalingValue := atk.Snapshot.Stats.TotalATK()
	switch {
	case atk.Info.UseHP:
		scalingStat = "hp"
		scalingValue = atk.Snapshot.Stats.MaxHP()
	case atk.Info.UseDef:
		scalingStat = "def"
		scalingValue = atk.Snapshot.Stats.TotalDEF()
	case atk.Info.UseEM:
		scalingStat = "em"
		scalingValue = atk.Snapshot.Stats[attributes.EM]
	}
	// These mutations and reads are in the same order as pinned enemy.calc.
	atk.Snapshot.Stats[attributes.CR] = max(0, min(1, atk.Snapshot.Stats[attributes.CR]))
	resistance, resistanceRead := e.resistWithProvenance(&atk.Info, evt)
	defenseRaw, defenseRead := e.defAdjWithProvenance(evt)
	defenseAdjustment := min(defenseRaw, 0.9)
	sourcehost.RecordScalarMin(defenseRead, defenseRaw, 0.9, defenseAdjustment)
	defenseIgnore := min(atk.Info.IgnoreDefPercent, 1.0)
	isCrit := atk.Info.HitWeakPoint
	var roll *float64
	if !isCrit {
		value := e.Core.Rand.Float64()
		roll = &value
		isCrit = value <= atk.Snapshot.Stats[attributes.CR]
	}
	reactionBonus := 0.0
	var reactionRead *info.SourceHostScalarRead
	if atk.Info.Amped {
		reactionBonus, reactionRead = e.Core.Player.ByIndex(atk.Info.ActorIndex).ReactBonusWithProvenance(atk.Info)
	}
	r.ScalarProvenance = sourcehost.ScalarProvenance(resistanceRead, defenseRead, reactionRead)
	r.Input = map[string]any{
		"scalingStat": scalingStat, "scalingValue": scalingValue, "scaling": atk.Info.Mult,
		"baseDamageBonus": atk.Info.BaseDmgBonus, "flatDamage": atk.Info.FlatDmg, "damageBonus": bonus,
		"characterLevel": atk.Snapshot.CharLvl, "enemyLevel": e.Level,
		"defenseAdjustment": defenseAdjustment, "defenseIgnore": defenseIgnore, "effectiveResistance": resistance,
		"critRate": atk.Snapshot.Stats[attributes.CR], "critDamage": atk.Snapshot.Stats[attributes.CD],
		"isCrit": isCrit, "critRoll": roll, "hitWeakPoint": atk.Info.HitWeakPoint,
		"elementalMastery": atk.Snapshot.Stats[attributes.EM], "amped": atk.Info.Amped,
		"amplifyingMultiplier": atk.Info.AmpMult, "amplifyingReaction": string(atk.Info.AmpType),
		"reactionBonus": reactionBonus, "groupMultiplier": group, "elevation": atk.Info.Elevation,
	}
	if kind == "lunar-delivery" {
		r.Input["branch"] = sourcehost.LunarBranch(atk.Info.AttackTag)
	} else if kind == "stellar-delivery" {
		r.Input["branch"] = sourcehost.StellarDeliveryBranch(atk.Info.Element)
	}
	value, id := b.Resolve(r)
	atk.SourceHostCalculationID = id
	return value, isCrit
}

// Capture the exact incoming snapshot without a second stateful attribute read.
func (e *Enemy) sourceHostDamageRequest(atk *info.AttackEvent, kind string) sourcehost.Request {
	r := e.Core.SourceHost.Request(kind, atk.Info)
	if kind != "damage" {
		r.DamageCategory = kind
	}
	r.SourceFrame = atk.SourceFrame
	r.SnapshotFrame = atk.Snapshot.SourceFrame
	r.AttackID = atk.SourceHostAttackID
	r.TargetKey = int(e.Key())
	if atk.Info.SourceHostMultiplierID > 0 {
		id := atk.Info.SourceHostMultiplierID
		r.MultiplierCalculationID = &id
	}
	r.Snapshot = sourcehost.SnapshotFields(atk.Snapshot)
	rawStats := atk.Snapshot.Stats
	r.SnapshotStats = &rawStats
	r.ComponentApplications = append(r.ComponentApplications, atk.Snapshot.SourceHostComponents...)
	r.ComponentApplications = append(r.ComponentApplications, atk.Info.SourceHostComponents...)
	for _, v := range r.ComponentApplications {
		r.ComponentIDs = append(r.ComponentIDs, v.ID)
	}
	return r
}
