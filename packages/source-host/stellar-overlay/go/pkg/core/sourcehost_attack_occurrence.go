package core

import "github.com/genshinsim/gcsim/pkg/core/info"

// SourceHostQueueAttackEventImmediateOccurrence observes repeated synchronous
// uses of one native event in ordinary ability scope. No delay parameter is
// accepted: deferred reuse needs a different task identity contract.
func (c *Core) SourceHostQueueAttackEventImmediateOccurrence(ae *info.AttackEvent) {
	if c.SourceHost == nil {
		c.QueueAttackEvent(ae, 0)
		return
	}
	end := c.SourceHost.BeginImmediateAttackOccurrence(ae)
	c.QueueAttackEvent(ae, 0)
	end()
}
