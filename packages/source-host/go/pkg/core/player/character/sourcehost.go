package character

import "github.com/genshinsim/gcsim/pkg/core/sourcehost"

// SourceHostBridge exposes the already-installed host to the shared reaction
// helpers without repeating live Stat/Stats/ReactBonus reads.
func (c *CharWrapper) SourceHostBridge() *sourcehost.Bridge { return c.SourceHost }
