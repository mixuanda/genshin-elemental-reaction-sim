package core

import "github.com/genshinsim/gcsim/pkg/core/info"

// SourceHostLabelHitCallback annotates the native callback slot already being
// executed by Enemy.HandleAttack. No callback function is wrapped or replaced.
func (c *Core) SourceHostLabelHitCallback(siteID string, callback info.AttackCB) {
	if c.SourceHost != nil {
		c.SourceHost.LabelActiveHitCallback(siteID, callback)
	}
}

func (c *Core) SourceHostHitCallbackFact(key string, value float64) {
	if c.SourceHost != nil {
		c.SourceHost.RecordActiveHitCallbackFact(key, value)
	}
}

func (c *Core) SourceHostQueueHitAttack(siteID string, a info.AttackInfo, p info.AttackPattern, snapshotDelay, dmgDelay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost == nil {
		c.QueueAttack(a, p, snapshotDelay, dmgDelay, callbacks...)
		return
	}
	end := c.SourceHost.BeginHitEmit(siteID)
	c.QueueAttack(a, p, snapshotDelay, dmgDelay, callbacks...)
	end()
}

func (c *Core) SourceHostQueueHitAttackEvent(siteID string, ae *info.AttackEvent, dmgDelay int) {
	if c.SourceHost == nil {
		c.QueueAttackEvent(ae, dmgDelay)
		return
	}
	end := c.SourceHost.BeginHitEmit(siteID)
	c.QueueAttackEvent(ae, dmgDelay)
	end()
}

func (c *Core) SourceHostQueueHitAttackWithSnap(siteID string, a info.AttackInfo, s info.Snapshot, p info.AttackPattern, dmgDelay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost == nil {
		c.QueueAttackWithSnap(a, s, p, dmgDelay, callbacks...)
		return
	}
	end := c.SourceHost.BeginHitEmit(siteID)
	c.QueueAttackWithSnap(a, s, p, dmgDelay, callbacks...)
	end()
}
