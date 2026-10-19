package core

import "github.com/genshinsim/gcsim/pkg/core/info"

// SourceHostLabelEventListener labels the native hook already running for
// these exact event arguments; it never wraps or replaces the hook function.
func (c *Core) SourceHostLabelEventListener(siteID string, args ...any) {
	if c.SourceHost != nil {
		c.SourceHost.LabelActiveEventListener(siteID, args...)
	}
}

func (c *Core) SourceHostEventListenerFact(key string, value float64) {
	if c.SourceHost != nil {
		c.SourceHost.RecordActiveEventListenerFact(key, value)
	}
}

func (c *Core) SourceHostEventProducerFact(key string, value float64) {
	if c.SourceHost != nil {
		c.SourceHost.RecordActiveEventProducerFact(key, value)
	}
}

func (c *Core) SourceHostQueueEventAttack(siteID string, a info.AttackInfo, p info.AttackPattern, snapshotDelay, dmgDelay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost == nil {
		c.QueueAttack(a, p, snapshotDelay, dmgDelay, callbacks...)
		return
	}
	end := c.SourceHost.BeginEventEmit(siteID)
	c.QueueAttack(a, p, snapshotDelay, dmgDelay, callbacks...)
	end()
}

func (c *Core) SourceHostQueueEventAttackWithSnap(siteID string, a info.AttackInfo, s info.Snapshot, p info.AttackPattern, dmgDelay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost == nil {
		c.QueueAttackWithSnap(a, s, p, dmgDelay, callbacks...)
		return
	}
	end := c.SourceHost.BeginEventEmit(siteID)
	c.QueueAttackWithSnap(a, s, p, dmgDelay, callbacks...)
	end()
}

func (c *Core) SourceHostQueueEventAttackEvent(siteID string, ae *info.AttackEvent, dmgDelay int) {
	if c.SourceHost == nil {
		c.QueueAttackEvent(ae, dmgDelay)
		return
	}
	end := c.SourceHost.BeginEventEmit(siteID)
	c.QueueAttackEvent(ae, dmgDelay)
	end()
}

// The event producer is a sidecar for the same native core task and delay.
func (c *Core) SourceHostQueueEventTask(siteID string, f func(), delay int) {
	callback := f
	producerID := 0
	if c.SourceHost != nil {
		callback, producerID = c.SourceHost.RegisterEventProducer(siteID, f)
	}
	c.Tasks.Add(callback, delay)
	if producerID > 0 {
		c.SourceHost.BindEventProducerTask(producerID, c.SourceHost.TaskTracker.LastScheduledID())
	}
}
