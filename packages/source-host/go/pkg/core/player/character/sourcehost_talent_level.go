package character

import (
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/keys"
)

// These wrappers call the original getter once at the original table-index
// expression. The getter does not mutate its inputs; reading them afterwards
// records the same base talent, constellation, unlock and passive tag.
func (c *CharWrapper) SourceHostTalentLvlAttack(read *info.SourceHostTalentTableRead, position int) int {
	value := c.TalentLvlAttack()
	passive := c.Tags[keys.ChildePassive]
	read.IndexSources = append(read.IndexSources, info.SourceHostTalentIndexSource{
		Position: position, Kind: "attack", BaseTalent: c.Talents.Attack,
		Constellation: c.Base.Cons, ConstellationUnlock: c.NormalCon,
		PassiveTagValue: &passive, Value: value,
	})
	return value
}

func (c *CharWrapper) SourceHostTalentLvlSkill(read *info.SourceHostTalentTableRead, position int) int {
	value := c.TalentLvlSkill()
	passive := c.Tags[keys.SkirkPassive]
	read.IndexSources = append(read.IndexSources, info.SourceHostTalentIndexSource{
		Position: position, Kind: "skill", BaseTalent: c.Talents.Skill,
		Constellation: c.Base.Cons, ConstellationUnlock: c.SkillCon,
		PassiveTagValue: &passive, Value: value,
	})
	return value
}

func (c *CharWrapper) SourceHostTalentLvlBurst(read *info.SourceHostTalentTableRead, position int) int {
	value := c.TalentLvlBurst()
	read.IndexSources = append(read.IndexSources, info.SourceHostTalentIndexSource{
		Position: position, Kind: "burst", BaseTalent: c.Talents.Burst,
		Constellation: c.Base.Cons, ConstellationUnlock: c.BurstCon,
		Value: value,
	})
	return value
}
