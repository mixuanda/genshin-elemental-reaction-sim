package core

import (
	"github.com/genshinsim/gcsim/pkg/core/construct"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

func (c *Core) SourceHostNewConstruct(site string, actor int, object construct.Construct, refresh bool) {
	if c.SourceHost != nil {
		end := c.SourceHost.BeginConstructBirth(site, actor, object)
		defer end()
	}
	c.Constructs.New(object, refresh)
}

func (c *Core) SourceHostBeginConstructTrigger(object any, kind string) func() {
	if c.SourceHost == nil {
		return func() {}
	}
	return c.SourceHost.BeginConstructTrigger(object, kind)
}

func (c *Core) SourceHostQueueConstructTask(site string, object any, f func(), delay int) {
	callback, producerID := f, 0
	if c.SourceHost != nil {
		callback, producerID = c.SourceHost.RegisterConstructProducer(site, object, f)
	}
	c.Tasks.Add(callback, delay)
	if producerID > 0 {
		c.SourceHost.BindOwnedEntityProducerTask(producerID, c.SourceHost.TaskTracker.LastScheduledID())
	}
}

func (c *Core) SourceHostQueueOwnedEntityTask(site string, f func(), delay int) {
	callback, producerID := f, 0
	if c.SourceHost != nil {
		callback, producerID = c.SourceHost.RegisterOwnedEntityProducer(site, f)
	}
	c.Tasks.Add(callback, delay)
	if producerID > 0 {
		c.SourceHost.BindOwnedEntityProducerTask(producerID, c.SourceHost.TaskTracker.LastScheduledID())
	}
}

func (c *Core) SourceHostQueueConstructAttackWithSnap(site string, object any, a info.AttackInfo, s info.Snapshot, p info.AttackPattern, delay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost != nil {
		end := c.SourceHost.BeginConstructEmit(site, object)
		defer end()
	}
	c.QueueAttackWithSnap(a, s, p, delay, callbacks...)
}

func (c *Core) SourceHostQueueConstructEventAttackWithSnap(site, eventSite string, a info.AttackInfo, s info.Snapshot, p info.AttackPattern, delay int, callbacks ...info.AttackCBFunc) {
	if c.SourceHost != nil {
		end := c.SourceHost.BeginOwnedEntityEmit(site)
		defer end()
	}
	c.SourceHostQueueEventAttackWithSnap(eventSite, a, s, p, delay, callbacks...)
}

func (c *Core) SourceHostConstructResonanceSelection(primary construct.Construct, others []construct.Construct) {
	if c.SourceHost == nil {
		return
	}
	objects := make([]any, len(others))
	for i, object := range others {
		objects[i] = object
	}
	c.SourceHost.RecordConstructSelection(primary, objects)
}
