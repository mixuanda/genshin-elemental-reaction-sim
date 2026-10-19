package enemy

// SourceHostQueueHitCallbackAbilityTask retains the exact callback-to-producer
// edge while keeping QueueEnemyTask's native local clock and unbound Origin.
func (e *Enemy) SourceHostQueueHitCallbackAbilityTask(siteID string, actorIndex int, f func(), delay int) {
	callback := f
	producerID := 0
	if e.Core.SourceHost != nil {
		callback, producerID = e.Core.SourceHost.RegisterHitCallbackAbilityProducer(siteID, actorIndex, f)
	}
	e.QueueEnemyTask(callback, delay)
	if producerID > 0 && delay != 0 {
		e.Core.SourceHost.BindAbilityProducerTask(producerID, e.Core.SourceHost.TaskTracker.LastScheduledID())
	}
}
