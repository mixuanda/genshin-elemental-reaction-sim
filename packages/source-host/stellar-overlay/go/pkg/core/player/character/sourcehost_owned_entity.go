package character

// SourceHostQueueOwnedEntityCharTask keeps QueueCharTask's original delay-zero
// behavior and character-local clock while retaining the exact entity owner.
func (c *CharWrapper) SourceHostQueueOwnedEntityCharTask(siteID string, f func(), delay int) {
	callback := f
	producerID := 0
	if c.SourceHost != nil {
		callback, producerID = c.SourceHost.RegisterOwnedEntityProducer(siteID, f)
	}
	c.QueueCharTask(callback, delay)
	if producerID > 0 && delay != 0 {
		c.SourceHost.BindOwnedEntityProducerTask(producerID, c.SourceHost.TaskTracker.LastScheduledID())
	}
}
