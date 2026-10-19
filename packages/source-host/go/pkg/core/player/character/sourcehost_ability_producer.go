package character

// SourceHostQueueCharTask preserves QueueCharTask's immediate delay-zero path
// and the character-local task clock for all other delays.
func (c *CharWrapper) SourceHostQueueCharTask(siteID string, f func(), delay int) {
	callback := f
	producerID := 0
	if c.SourceHost != nil {
		callback, producerID = c.SourceHost.RegisterAbilityProducer(siteID, c.Index(), f)
	}
	c.QueueCharTask(callback, delay)
	if producerID > 0 && delay != 0 {
		c.SourceHost.BindAbilityProducerTask(producerID, c.SourceHost.TaskTracker.LastScheduledID())
	}
}

// Keep the native character clock while retaining the exact callback that
// registered this delayed shield update; callback context never spans a delay.
func (c *CharWrapper) SourceHostQueueHitCallbackCharTask(siteID string, f func(), delay int) {
	callback := f
	producerID := 0
	if c.SourceHost != nil {
		callback, producerID = c.SourceHost.RegisterHitCallbackAbilityProducer(siteID, c.Index(), f)
	}
	c.QueueCharTask(callback, delay)
	if producerID > 0 && delay != 0 {
		c.SourceHost.BindAbilityProducerTask(producerID, c.SourceHost.TaskTracker.LastScheduledID())
	}
}
