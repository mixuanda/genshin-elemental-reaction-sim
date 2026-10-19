package character

import (
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/sourcehost"
)

// MaxHPWithProvenance is one original SelectStat evaluation and its exact read.
func (c *CharWrapper) MaxHPWithProvenance() (float64, *info.SourceHostStatRead) {
	stats, read := c.SelectStatWithProvenance(false, attributes.BaseHP, attributes.HPP, attributes.HP)
	return stats.MaxHP(), read
}

// HealBonusWithProvenance preserves the original modifier iteration, expiry
// pruning and one Amount call for each active closure.
func (c *CharWrapper) HealBonusWithProvenance() (float64, *info.SourceHostScalarRead) {
	n := 0
	amt := 0.0
	var read *info.SourceHostScalarRead
	if c.SourceHost != nil {
		actor := c.Index()
		read = c.SourceHost.NewScalarRead("heal-bonus", 0, &actor, nil, "")
	}
	for _, v := range c.mods {
		m, ok := v.(*HealBonusMod)
		if !ok {
			c.mods[n] = v
			n++
			continue
		}
		step := sourcehost.NewScalarStep(read, m.Key(), m.Expiry(), m.AffectedByHitlag(), amt, "", true)
		if m.Expiry() > *c.f || m.Expiry() == -1 {
			c.beginSourceHostScalarStep(step, read)
			value := m.Amount()
			c.endSourceHostScalarStep(step)
			amt += value
			sourcehost.FinishScalarStep(step, "applied", &value, amt, m.Expiry())
			c.mods[n] = v
			n++
		} else {
			sourcehost.FinishScalarStep(step, "expired", nil, amt, m.Expiry())
		}
	}
	c.mods = c.mods[:n]
	if read != nil {
		read.Sum, read.Output = amt, amt
	}
	return amt, read
}
