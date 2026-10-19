package core

import "github.com/genshinsim/gcsim/pkg/core/info"

// These helpers preserve native queue calls and label only their AttackEvent
// creation as an audited persistent-generator emission site.
func (c *Core) SourceHostQueueOwnedAttack(siteID string, a info.AttackInfo, p info.AttackPattern, snapshotDelay, dmgDelay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost == nil {
		c.QueueAttack(a, p, snapshotDelay, dmgDelay, callbacks...)
		return
	}
	end := c.SourceHost.BeginOwnedEmit(siteID)
	c.QueueAttack(a, p, snapshotDelay, dmgDelay, callbacks...)
	end()
}

func (c *Core) SourceHostQueueOwnedAttackWithSnap(siteID string, a info.AttackInfo, s info.Snapshot, p info.AttackPattern, dmgDelay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost == nil {
		c.QueueAttackWithSnap(a, s, p, dmgDelay, callbacks...)
		return
	}
	end := c.SourceHost.BeginOwnedEmit(siteID)
	c.QueueAttackWithSnap(a, s, p, dmgDelay, callbacks...)
	end()
}

// SourceHostQueueOwnedEventAttackEvent labels the same native queue call for
// both an audited status-owned trigger and its actual event listener. Their
// shared queue identity connects ownership to later event/callback descendants.
func (c *Core) SourceHostQueueOwnedEventAttackEvent(ownedSiteID, eventSiteID string, ae *info.AttackEvent, dmgDelay int) {
	if c.SourceHost == nil {
		c.QueueAttackEvent(ae, dmgDelay)
		return
	}
	end := c.SourceHost.BeginOwnedEmit(ownedSiteID)
	c.SourceHostQueueEventAttackEvent(eventSiteID, ae, dmgDelay)
	end()
}

// SourceHostQueueOwnedEventAttack labels one native QueueAttack call for both
// the exact persistent modifier trigger and the existing event component.
func (c *Core) SourceHostQueueOwnedEventAttack(ownedSiteID, eventSiteID string, a info.AttackInfo, p info.AttackPattern, snapshotDelay, dmgDelay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost == nil {
		c.QueueAttack(a, p, snapshotDelay, dmgDelay, callbacks...)
		return
	}
	end := c.SourceHost.BeginOwnedEmit(ownedSiteID)
	c.SourceHostQueueEventAttack(eventSiteID, a, p, snapshotDelay, dmgDelay, callbacks...)
	end()
}
