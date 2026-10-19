package enemy

import (
	"github.com/genshinsim/gcsim/pkg/core/attacks"
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/glog"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/sourcehost"
	"github.com/genshinsim/gcsim/pkg/reactable"
)

// Direct Lunar has a different read order from ordinary damage: ReactBonus,
// defense, resistance, then the clamped critical draw. Keep that order intact.
func (e *Enemy) calcSourceHostDirectSpecial(atk *info.AttackEvent, evt glog.Event, group float64) (float64, bool) {
	kind := "lunar-direct"
	if atk.Info.AttackTag.IsStellarDirect() { kind = "stellar-direct" }
	r := e.sourceHostDamageRequest(atk, kind)
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
	reactionBonus, reactionRead := e.Core.Player.ByIndex(atk.Info.ActorIndex).ReactBonusWithProvenance(atk.Info)
	defenseRaw, defenseRead := e.defAdjWithProvenance(evt)
	defenseAdjustment := min(defenseRaw, 0.9)
	sourcehost.RecordScalarMin(defenseRead, defenseRaw, 0.9, defenseAdjustment)
	defenseIgnore := min(atk.Info.IgnoreDefPercent, 1.0)
	resistance, resistanceRead := e.resistWithProvenance(&atk.Info, evt)
	r.ScalarProvenance = sourcehost.ScalarProvenance(reactionRead, defenseRead, resistanceRead)
	atk.Snapshot.Stats[attributes.CR] = max(0, min(1, atk.Snapshot.Stats[attributes.CR]))
	isCrit := atk.Info.HitWeakPoint
	var roll *float64
	if !isCrit {
		value := e.Core.Rand.Float64()
		roll = &value
		isCrit = value <= atk.Snapshot.Stats[attributes.CR]
	}
	branch := ""
	if kind == "stellar-direct" { branch = sourcehost.StellarDirectBranch(atk.Info.AttackTag) } else { branch = sourcehost.LunarBranch(atk.Info.AttackTag) }
	r.Input = map[string]any{
		"branch": branch,
		"scalingStat": scalingStat, "scalingValue": scalingValue, "scaling": atk.Info.Mult,
		"baseDamageBonus": atk.Info.BaseDmgBonus, "flatDamage": atk.Info.FlatDmg, "damageBonus": 0.0,
		"characterLevel": atk.Snapshot.CharLvl, "enemyLevel": e.Level,
		"defenseAdjustment": defenseAdjustment, "defenseIgnore": defenseIgnore, "effectiveResistance": resistance,
		"critRate": atk.Snapshot.Stats[attributes.CR], "critDamage": atk.Snapshot.Stats[attributes.CD],
		"isCrit": isCrit, "critRoll": roll, "hitWeakPoint": atk.Info.HitWeakPoint,
		"elementalMastery": atk.Snapshot.Stats[attributes.EM], "amped": atk.Info.Amped,
		"amplifyingMultiplier": atk.Info.AmpMult, "amplifyingReaction": string(atk.Info.AmpType),
		"reactionBonus": reactionBonus, "groupMultiplier": group, "elevation": atk.Info.Elevation,
	}
	if atk.Info.AttackTag == attacks.AttackTagDirectStellarConduct {
		count := e.Core.Player.Chars()[atk.Info.ActorIndex].Tags[reactable.PolestarFieldStacksKey]
		r.Input["polestarApplicationCount"] = count
	}
	// The resolver explicitly refuses non-ignored DEF, retaining the source TODO
	// as a conflict rather than silently claiming a verified ordinary DEF stage.
	value, id := e.Core.SourceHost.Resolve(r)
	atk.SourceHostCalculationID = id
	return value, isCrit
}
