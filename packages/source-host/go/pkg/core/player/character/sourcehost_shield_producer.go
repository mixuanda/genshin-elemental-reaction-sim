package character

import "github.com/genshinsim/gcsim/pkg/core/player/shield"

// The actual shield gate supplies ownership, while QueueCharTask retains its
// original local clock and immediate path. No gameplay Origin is rewritten.
func (c *CharWrapper) SourceHostQueueShieldCharTask(siteID string, owner shield.Shield, f func(), delay int) {
	callback := f
	producerID := 0
	if c.SourceHost != nil {
		callback, producerID = c.SourceHost.RegisterShieldProducer(siteID, f)
		c.SourceHost.BindShieldProducerOwner(producerID, owner)
	}
	c.QueueCharTask(callback, delay)
	if producerID > 0 && delay != 0 {
		c.SourceHost.BindShieldProducerTask(producerID, c.SourceHost.TaskTracker.LastScheduledID())
	}
}
