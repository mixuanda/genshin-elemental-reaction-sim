package core

import "github.com/genshinsim/gcsim/pkg/core/info"

// SourceHostAddOwnedGadget registers only source-audited entity spawn sites.
// Native AddGadget, including its type-limit kill, runs before the new key is read.
func (c *Core) SourceHostAddOwnedGadget(siteID string, actorIndex int, g info.Gadget) {
	c.Combat.AddGadget(g)
	if c.SourceHost != nil {
		c.SourceHost.RegisterOwnedEntity(siteID, actorIndex, int(g.Key()))
	}
}

func (c *Core) SourceHostQueueOwnedEntityAttackWithSnap(siteID string, a info.AttackInfo, s info.Snapshot, p info.AttackPattern, dmgDelay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost == nil {
		c.QueueAttackWithSnap(a, s, p, dmgDelay, callbacks...)
		return
	}
	end := c.SourceHost.BeginOwnedEntityEmit(siteID)
	c.QueueAttackWithSnap(a, s, p, dmgDelay, callbacks...)
	end()
}

func (c *Core) SourceHostQueueOwnedEntityAttackEvent(siteID string, ae *info.AttackEvent, dmgDelay int) {
	if c.SourceHost == nil {
		c.QueueAttackEvent(ae, dmgDelay)
		return
	}
	end := c.SourceHost.BeginOwnedEntityEmit(siteID)
	c.QueueAttackEvent(ae, dmgDelay)
	end()
}

// A custom gadget may emit after its embedded Gadget.Tick has returned. Scope
// only that source-audited callback to the exact registered native target key.
func (c *Core) SourceHostTriggerOwnedEntity(targetKey int, kind string, f func()) {
	if c.SourceHost == nil {
		f()
		return
	}
	end := c.SourceHost.BeginOwnedEntityTrigger(targetKey, kind)
	f()
	end()
}
