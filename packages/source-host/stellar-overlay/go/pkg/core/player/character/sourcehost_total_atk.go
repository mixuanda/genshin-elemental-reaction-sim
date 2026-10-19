package character

import (
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// TotalAtkWithProvenance consumes the original SelectStat loop once and
// returns its exact receipt, including nested modifier formula calls.
func (c *CharWrapper) TotalAtkWithProvenance() (float64, *info.SourceHostStatRead) {
	stats, read := c.SelectStatWithProvenance(false, attributes.BaseATK, attributes.ATKP, attributes.ATK)
	return stats.TotalATK(), read
}
