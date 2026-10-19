package core

import (
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/player/shield"
)

func (c *Core) SourceHostWithShieldBirth(siteID string, f func()) {
	if c.SourceHost == nil {
		f()
		return
	}
	end := c.SourceHost.BeginShieldBirth(siteID)
	f()
	end()
}

// Refresh damage precedes Add/OnOverwrite in some native shield skills. Bind
// that source call explicitly to the exact old object consumed by the refresh.
func (c *Core) SourceHostWithShieldTrigger(shd shield.Shield, siteID, cause string, f func()) {
	if c.SourceHost == nil {
		f()
		return
	}
	end := c.SourceHost.BeginShieldHook(shd, siteID, cause)
	f()
	end()
}

func (c *Core) SourceHostQueueShieldAttack(siteID string, a info.AttackInfo, p info.AttackPattern, snapshotDelay, dmgDelay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost == nil {
		c.QueueAttack(a, p, snapshotDelay, dmgDelay, callbacks...)
		return
	}
	end := c.SourceHost.BeginShieldEmit(siteID)
	c.QueueAttack(a, p, snapshotDelay, dmgDelay, callbacks...)
	end()
}

// The returned sidecar ID allows a source that queues before Add to bind the
// actual installed shield later in the same native update.
func (c *Core) SourceHostQueueShieldTask(siteID string, f func(), delay int) int {
	callback := f
	producerID := 0
	if c.SourceHost != nil {
		callback, producerID = c.SourceHost.RegisterShieldProducer(siteID, f)
	}
	c.Tasks.Add(callback, delay)
	if producerID > 0 {
		c.SourceHost.BindShieldProducerTask(producerID, c.SourceHost.TaskTracker.LastScheduledID())
	}
	return producerID
}

func (c *Core) SourceHostBindShieldTask(producerID int, shd shield.Shield) {
	if c.SourceHost != nil && producerID > 0 {
		c.SourceHost.BindShieldProducerOwner(producerID, shd)
	}
}

func (c *Core) SourceHostShieldTaskGate(shd shield.Shield) {
	if c.SourceHost != nil {
		c.SourceHost.RecordShieldProducerGate(shd)
	}
}

func (c *Core) SourceHostShieldTaskFact(key string, value float64) {
	if c.SourceHost != nil {
		c.SourceHost.RecordShieldProducerFact(key, value)
	}
}

func (c *Core) SourceHostShieldInstanceID(shd shield.Shield) int {
	if c.SourceHost == nil {
		return 0
	}
	return c.SourceHost.ShieldInstanceID(shd)
}

func (c *Core) SourceHostShieldHookFact(key string, value float64) {
	if c.SourceHost != nil {
		c.SourceHost.RecordShieldHookFact(key, value)
	}
}
