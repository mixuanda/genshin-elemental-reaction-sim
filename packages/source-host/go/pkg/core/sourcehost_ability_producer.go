package core

// SourceHostQueueTask annotates only audited source producer callbacks. It
// delegates scheduling unchanged to the native core task queue.
func (c *Core) SourceHostQueueTask(siteID string, actorIndex int, f func(), delay int) {
	callback := f
	producerID := 0
	if c.SourceHost != nil {
		callback, producerID = c.SourceHost.RegisterAbilityProducer(siteID, actorIndex, f)
	}
	c.Tasks.Add(callback, delay)
	if producerID > 0 {
		c.SourceHost.BindAbilityProducerTask(producerID, c.SourceHost.TaskTracker.LastScheduledID())
	}
}

// SourceHostAbilityProducerFact records a previously computed callback-local
// value without repeating a source getter or target selection.
func (c *Core) SourceHostAbilityProducerFact(name string, value float64) {
	if c.SourceHost != nil {
		c.SourceHost.RecordActiveAbilityProducerFact(name, value)
	}
}
