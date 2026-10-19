package sourcehost

// Only the audited spawn wrapper supplies ownership. All native construct
// objects are observed so resonance locations can retain their own identity.
func (b *Bridge) BeginConstructBirth(site string, actor int, object any) func() {
	oldObject, oldSite, oldActor := b.pendingConstructObject, b.pendingConstructSite, b.pendingConstructActor
	b.pendingConstructObject, b.pendingConstructSite, b.pendingConstructActor = object, site, actor
	return func() {
		b.pendingConstructObject, b.pendingConstructSite, b.pendingConstructActor = oldObject, oldSite, oldActor
	}
}

func (b *Bridge) ConstructCreated(object any, key int, kind string, expiry int, limited bool) {
	if b.constructEntityByObject == nil {
		b.constructEntityByObject = make(map[any]int)
	}
	owned := object == b.pendingConstructObject && b.pendingConstructSite != ""
	site, actor := "native.construct", -1
	if owned {
		site, actor = b.pendingConstructSite, b.pendingConstructActor
	}
	id := b.registerOwnedEntity(site, actor, key)
	row := &b.OwnedEntities[id-1]
	row.Kind = "construct"
	row.Construct = &OwnedConstructMetadata{Type: kind, ExpiryFrame: expiry, LimitedList: limited}
	if !owned {
		row.InvocationID, row.SpawnProducerID, row.ParentEntityID = nil, nil, nil
	}
	b.constructEntityByObject[object] = id
	// OnConstructSpawned listeners may create other objects; the annotation is
	// consumed before the unchanged native event is emitted.
	if owned {
		b.pendingConstructObject, b.pendingConstructSite = nil, ""
	}
}

func (b *Bridge) ConstructEnded(object any, reason string) {
	id := b.constructEntityByObject[object]
	if id == 0 {
		return
	}
	row := &b.OwnedEntities[id-1]
	frame := *b.Frame
	row.EndedFrame, row.EndReason = &frame, reason
	// Keep the historical object binding: a previously queued native resonance
	// task can still run after removal, including native key-collision cases.
}

func (b *Bridge) BeginConstructTrigger(object any, kind string) func() {
	id := b.constructEntityByObject[object]
	if id == 0 || b.OwnedEntities[id-1].EndedFrame != nil {
		return func() {}
	}
	end := b.beginOwnedEntityTrigger(id, kind)
	if b.activeEventCallID > 0 {
		call := b.activeEventCallID
		b.OwnedEntityTriggers[b.activeOwnedEntityTriggerID-1].EventCallID = &call
	}
	return end
}

func (b *Bridge) RegisterConstructProducer(site string, object any, f func()) (func(), int) {
	previousEntity, previousTrigger, previousProducer := b.activeOwnedEntityID, b.activeOwnedEntityTriggerID, b.activeOwnedEntityProducerID
	b.activeOwnedEntityID, b.activeOwnedEntityTriggerID, b.activeOwnedEntityProducerID = b.constructEntityByObject[object], 0, 0
	callback, id := b.RegisterOwnedEntityProducer(site, f)
	b.activeOwnedEntityID, b.activeOwnedEntityTriggerID, b.activeOwnedEntityProducerID = previousEntity, previousTrigger, previousProducer
	return callback, id
}

func (b *Bridge) RecordConstructProducerCheck(present bool, snapshotObject any) {
	if b.activeOwnedEntityProducerID == 0 {
		return
	}
	row := &b.OwnedEntityProducers[b.activeOwnedEntityProducerID-1]
	row.ConstructKeyPresent = &present
	if id := b.constructEntityByObject[snapshotObject]; id > 0 {
		row.SnapshotEntityID = &id
	}
}

func (b *Bridge) BeginConstructEmit(site string, object any) func() {
	previousEmitter := b.pendingConstructEmitterID
	b.pendingConstructEmitterID = b.constructEntityByObject[object]
	end := b.BeginOwnedEntityEmit(site)
	return func() { end(); b.pendingConstructEmitterID = previousEmitter }
}

// IDs are observed from the native selection slice; no spatial predicate or
// native construct lookup is rerun by this receipt.
func (b *Bridge) RecordConstructSelection(primary any, others []any) {
	if b.activeOwnedEntityProducerID == 0 {
		return
	}
	row := &b.OwnedEntityProducers[b.activeOwnedEntityProducerID-1]
	ids := make([]int, len(others))
	for i, object := range others {
		ids[i] = b.constructEntityByObject[object]
	}
	row.ConstructSelections = append(row.ConstructSelections, OwnedConstructSelection{
		PrimaryEntityID: b.constructEntityByObject[primary], ResonanceEntityIDs: ids,
	})
}
