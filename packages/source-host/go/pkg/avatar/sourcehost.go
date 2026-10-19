package avatar

import (
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/sourcehost"
)

// calcSourceHost samples the same state in the same order as Player.calc.
// The resolver's value enters the original shield and Drain path unchanged.
func (p *Player) calcSourceHost(atk *info.AttackEvent) (float64, bool) {
	st := attributes.EleToDmgP(atk.Info.Element)
	elePer := 0.0
	if st > -1 {
		elePer = atk.Snapshot.Stats[st]
	}
	dmgBonus := elePer + atk.Snapshot.Stats[attributes.DmgP]

	var scalingStat string
	var scalingValue float64
	switch {
	case atk.Info.UseHP:
		scalingStat, scalingValue = "hp", atk.Snapshot.Stats.MaxHP()
	case atk.Info.UseDef:
		scalingStat, scalingValue = "def", atk.Snapshot.Stats.TotalDEF()
	case atk.Info.UseEM:
		scalingStat, scalingValue = "em", atk.Snapshot.Stats[attributes.EM]
	default:
		scalingStat, scalingValue = "atk", atk.Snapshot.Stats.TotalATK()
	}

	// Keep the two original CR mutations before the player DEF read and RNG.
	if atk.Snapshot.Stats[attributes.CR] < 0 {
		atk.Snapshot.Stats[attributes.CR] = 0
	}
	if atk.Snapshot.Stats[attributes.CR] > 1 {
		atk.Snapshot.Stats[attributes.CR] = 1
	}
	char := p.Core.Player.ActiveChar()
	def := char.TotalDef(false)
	defIgn := min(atk.Info.IgnoreDefPercent, 1.0)

	isCrit := atk.Info.HitWeakPoint
	var roll *float64
	if !isCrit {
		value := p.Core.Rand.Float64()
		roll = &value
		isCrit = value <= atk.Snapshot.Stats[attributes.CR]
	}

	em := atk.Snapshot.Stats[attributes.EM]
	reactionBonus := 0.0
	var reactionRead *info.SourceHostScalarRead
	if atk.Info.Amped {
		reactionBonus, reactionRead = p.Core.Player.ByIndex(atk.Info.ActorIndex).ReactBonusWithProvenance(atk.Info)
	}
	group := 1.0
	if !atk.Info.SourceIsSim {
		group = p.GroupTagDamageMult(atk.Info.ICDTag, atk.Info.ICDGroup, atk.Info.ActorIndex)
	}

	b := p.Core.SourceHost
	r := b.Request("player-incoming", atk.Info)
	r.DamageCategory = "player-incoming"
	r.SourceFrame = atk.SourceFrame
	r.SnapshotFrame = atk.Snapshot.SourceFrame
	r.AttackID = atk.SourceHostAttackID
	r.TargetKey = int(p.Key())
	r.Snapshot = sourcehost.SnapshotFields(atk.Snapshot)
	rawStats := atk.Snapshot.Stats
	r.SnapshotStats = &rawStats
	r.ComponentApplications = append(r.ComponentApplications, atk.Snapshot.SourceHostComponents...)
	r.ComponentApplications = append(r.ComponentApplications, atk.Info.SourceHostComponents...)
	for _, component := range r.ComponentApplications {
		r.ComponentIDs = append(r.ComponentIDs, component.ID)
	}
	r.ScalarProvenance = sourcehost.ScalarProvenance(reactionRead)
	r.Input = map[string]any{
		"scalingStat": scalingStat, "scalingValue": scalingValue, "scaling": atk.Info.Mult,
		"flatDamage": atk.Info.FlatDmg, "damageBonus": dmgBonus,
		"playerDefense": def, "defenseIgnore": defIgn, "playerResistance": 0.0,
		"attackerLevel": atk.Snapshot.CharLvl,
		"critRate":      atk.Snapshot.Stats[attributes.CR], "critDamage": atk.Snapshot.Stats[attributes.CD],
		"isCrit": isCrit, "critRoll": roll, "hitWeakPoint": atk.Info.HitWeakPoint,
		"elementalMastery": em, "amped": atk.Info.Amped,
		"amplifyingMultiplier": atk.Info.AmpMult, "reactionBonus": reactionBonus,
		"groupMultiplier": group,
	}
	value, id := b.Resolve(r)
	atk.SourceHostCalculationID = id
	return value, isCrit
}
