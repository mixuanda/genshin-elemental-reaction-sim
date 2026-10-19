package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

type OwnedConstructMetadata struct {
	Type        string `json:"type"`
	ExpiryFrame int    `json:"expiryFrame"`
	LimitedList bool   `json:"limitedList"`
}

// OwnedEntity retains a native gadget or construct object. TargetKey is the
// native lookup key, not object identity; ID remains distinct across replacement.
type OwnedEntity struct {
	Construct       *OwnedConstructMetadata `json:"construct,omitempty"`
	ID              int                     `json:"id"`
	Kind            string                  `json:"kind"`
	SiteID          string                  `json:"siteId"`
	InvocationID    *int                    `json:"invocationId,omitempty"`
	SpawnProducerID *int                    `json:"spawnProducerId,omitempty"`
	ParentEntityID  *int                    `json:"parentEntityId,omitempty"`
	ActorIndex      int                     `json:"actorIndex"`
	TargetKey       int                     `json:"targetKey"`
	CreatedFrame    int                     `json:"createdFrame"`
	TickCount       int                     `json:"tickCount"`
	EndedFrame      *int                    `json:"endedFrame,omitempty"`
	EndReason       string                  `json:"endReason,omitempty"`
	TriggerIDs      []int                   `json:"triggerIds"`
	ProducerIDs     []int                   `json:"producerIds"`
}

type OwnedEntityQueuedAttack struct {
	EmitterEntityID *int   `json:"emitterEntityId,omitempty"`
	QueueID         int    `json:"queueId"`
	AttackID        *int   `json:"attackId,omitempty"`
	Ability         string `json:"ability"`
	AttackTagName   string `json:"attackTagName"`
	Frame           int    `json:"frame"`
	EmitSiteID      string `json:"emitSiteId"`
}

type OwnedEntityTrigger struct {
	EventCallID      *int                      `json:"eventCallId,omitempty"`
	ID               int                       `json:"id"`
	EntityID         int                       `json:"entityId"`
	SiteID           string                    `json:"siteId"`
	Kind             string                    `json:"kind"`
	StartedFrame     int                       `json:"startedFrame"`
	CompletedFrame   int                       `json:"completedFrame"`
	ChildProducerIDs []int                     `json:"childProducerIds"`
	QueuedAttacks    []OwnedEntityQueuedAttack `json:"queuedAttacks"`
	queuedStart      int
}

type OwnedConstructSelection struct {
	PrimaryEntityID    int   `json:"primaryEntityId"`
	ResonanceEntityIDs []int `json:"resonanceEntityIds"`
}

type OwnedEntityProducer struct {
	ConstructSelections []OwnedConstructSelection `json:"constructSelections,omitempty"`
	ConstructKeyPresent *bool                     `json:"constructKeyPresent,omitempty"`
	SnapshotEntityID    *int                      `json:"snapshotEntityId,omitempty"`
	TaskID              *int                      `json:"taskId,omitempty"`
	ID                  int                       `json:"id"`
	EntityID            int                       `json:"entityId"`
	ParentTriggerID     *int                      `json:"parentTriggerId,omitempty"`
	ParentProducerID    *int                      `json:"parentProducerId,omitempty"`
	SiteID              string                    `json:"siteId"`
	QueuedFrame         int                       `json:"queuedFrame"`
	StartedFrame        *int                      `json:"startedFrame,omitempty"`
	CompletedFrame      *int                      `json:"completedFrame,omitempty"`
	State               string                    `json:"state"`
	QueuedAttacks       []OwnedEntityQueuedAttack `json:"queuedAttacks"`
	queuedStart         int
}

type ownedEntityAttackReference struct {
	triggerIndex  int
	producerIndex int
	queuedIndex   int
	attack        *info.AttackEvent
}

func (b *Bridge) RegisterOwnedEntity(siteID string, actorIndex, targetKey int) {
	id := b.registerOwnedEntity(siteID, actorIndex, targetKey)
	b.ownedEntityByTargetKey[targetKey] = id
}

func (b *Bridge) registerOwnedEntity(siteID string, actorIndex, targetKey int) int {
	id := len(b.OwnedEntities) + 1
	var invocationID, spawnProducerID, parentEntityID *int
	if b.activeProducerID > 0 {
		producer := b.AbilityProducers[b.activeProducerID-1]
		spawn := producer.ID
		spawnProducerID = &spawn
		if producer.InvocationID != nil {
			invocation := *producer.InvocationID
			invocationID = &invocation
		}
	} else if b.activeAbilityInvocationID > 0 {
		invocation := b.activeAbilityInvocationID
		invocationID = &invocation
	} else if b.activeOwnedEntityID > 0 {
		parent := b.OwnedEntities[b.activeOwnedEntityID-1]
		if parent.InvocationID != nil {
			invocation := *parent.InvocationID
			invocationID = &invocation
		}
	}
	if b.activeOwnedEntityID > 0 {
		parent := b.activeOwnedEntityID
		parentEntityID = &parent
	}
	b.OwnedEntities = append(b.OwnedEntities, OwnedEntity{
		ID: id, Kind: "gadget", SiteID: siteID, InvocationID: invocationID,
		SpawnProducerID: spawnProducerID, ParentEntityID: parentEntityID,
		ActorIndex: actorIndex, TargetKey: targetKey, CreatedFrame: *b.Frame,
		TriggerIDs: []int{}, ProducerIDs: []int{},
	})
	return id
}

// Trigger scopes are observational; attack origin and the native callback stay unchanged.
func (b *Bridge) BeginOwnedEntityTrigger(targetKey int, kind string) func() {
	return b.beginOwnedEntityTrigger(b.ownedEntityByTargetKey[targetKey], kind)
}

func (b *Bridge) beginOwnedEntityTrigger(entityID int, kind string) func() {
	if entityID == 0 {
		return func() {}
	}
	id := len(b.OwnedEntityTriggers) + 1
	entity := &b.OwnedEntities[entityID-1]
	entity.TriggerIDs = append(entity.TriggerIDs, id)
	previousEntity, previousTrigger, previousProducer := b.activeOwnedEntityID, b.activeOwnedEntityTriggerID, b.activeOwnedEntityProducerID
	b.activeOwnedEntityID, b.activeOwnedEntityTriggerID, b.activeOwnedEntityProducerID = entityID, id, 0
	b.OwnedEntityTriggers = append(b.OwnedEntityTriggers, OwnedEntityTrigger{
		ID: id, EntityID: entityID, SiteID: entity.SiteID + "." + kind,
		Kind: kind, StartedFrame: *b.Frame, ChildProducerIDs: []int{},
		QueuedAttacks: []OwnedEntityQueuedAttack{}, queuedStart: len(b.queuedAttackReferences),
	})
	return func() {
		row := &b.OwnedEntityTriggers[id-1]
		row.CompletedFrame = *b.Frame
		for _, reference := range b.queuedAttackReferences[row.queuedStart:] {
			if reference.entityID != entityID || reference.entityTriggerID != id || reference.entityEmitSiteID == "" {
				continue
			}
			queuedIndex := len(row.QueuedAttacks)
			row.QueuedAttacks = append(row.QueuedAttacks, ownedEntityAttack(reference))
			b.ownedEntityAttackReferences = append(b.ownedEntityAttackReferences, ownedEntityAttackReference{
				triggerIndex: id - 1, producerIndex: -1, queuedIndex: queuedIndex, attack: reference.attack,
			})
		}
		b.activeOwnedEntityID, b.activeOwnedEntityTriggerID, b.activeOwnedEntityProducerID = previousEntity, previousTrigger, previousProducer
	}
}

func (b *Bridge) RegisterOwnedEntityProducer(siteID string, f func()) (func(), int) {
	entityID := b.activeOwnedEntityID
	if entityID == 0 {
		return f, 0
	}
	id := len(b.OwnedEntityProducers) + 1
	var parentTriggerID, parentProducerID *int
	if b.activeOwnedEntityTriggerID > 0 {
		parent := b.activeOwnedEntityTriggerID
		parentTriggerID = &parent
		b.OwnedEntityTriggers[parent-1].ChildProducerIDs = append(b.OwnedEntityTriggers[parent-1].ChildProducerIDs, id)
	}
	if b.activeOwnedEntityProducerID > 0 {
		parent := b.activeOwnedEntityProducerID
		parentProducerID = &parent
	}
	b.OwnedEntities[entityID-1].ProducerIDs = append(b.OwnedEntities[entityID-1].ProducerIDs, id)
	b.OwnedEntityProducers = append(b.OwnedEntityProducers, OwnedEntityProducer{
		ID: id, EntityID: entityID, ParentTriggerID: parentTriggerID,
		ParentProducerID: parentProducerID, SiteID: siteID, QueuedFrame: *b.Frame,
		State: "pending", QueuedAttacks: []OwnedEntityQueuedAttack{},
	})
	return func() {
		previousEntity, previousTrigger, previousProducer := b.activeOwnedEntityID, b.activeOwnedEntityTriggerID, b.activeOwnedEntityProducerID
		b.activeOwnedEntityID, b.activeOwnedEntityTriggerID, b.activeOwnedEntityProducerID = entityID, 0, id
		row := &b.OwnedEntityProducers[id-1]
		started := *b.Frame
		row.StartedFrame = &started
		row.queuedStart = len(b.queuedAttackReferences)
		f()
		completed := *b.Frame
		row = &b.OwnedEntityProducers[id-1]
		row.CompletedFrame = &completed
		row.State = "completed"
		for _, reference := range b.queuedAttackReferences[row.queuedStart:] {
			if reference.entityID != entityID || reference.entityProducerID != id || reference.entityEmitSiteID == "" {
				continue
			}
			queuedIndex := len(row.QueuedAttacks)
			row.QueuedAttacks = append(row.QueuedAttacks, ownedEntityAttack(reference))
			b.ownedEntityAttackReferences = append(b.ownedEntityAttackReferences, ownedEntityAttackReference{
				triggerIndex: -1, producerIndex: id - 1, queuedIndex: queuedIndex, attack: reference.attack,
			})
		}
		b.activeOwnedEntityID, b.activeOwnedEntityTriggerID, b.activeOwnedEntityProducerID = previousEntity, previousTrigger, previousProducer
	}, id
}

func ownedEntityAttack(reference queuedAttackReference) OwnedEntityQueuedAttack {
	var emitterID *int
	if reference.constructEmitterID > 0 {
		value := reference.constructEmitterID
		emitterID = &value
	}
	return OwnedEntityQueuedAttack{
		EmitterEntityID: emitterID,
		QueueID:         reference.queueID, Ability: reference.ability,
		AttackTagName: reference.attackTagName, Frame: reference.frame,
		EmitSiteID: reference.entityEmitSiteID,
	}
}

// BeginOwnedEntityEmit marks exactly one explicit QueueAttack* call.
func (b *Bridge) BeginOwnedEntityEmit(siteID string) func() {
	previous := b.pendingOwnedEntityEmitSite
	b.pendingOwnedEntityEmitSite = siteID
	return func() { b.pendingOwnedEntityEmitSite = previous }
}

func (b *Bridge) FinalizeOwnedEntityAttacks() {
	for _, reference := range b.ownedEntityAttackReferences {
		if reference.attack.SourceHostAttackID <= 0 {
			continue
		}
		id := reference.attack.SourceHostAttackID
		if reference.triggerIndex >= 0 {
			b.OwnedEntityTriggers[reference.triggerIndex].QueuedAttacks[reference.queuedIndex].AttackID = &id
		} else {
			b.OwnedEntityProducers[reference.producerIndex].QueuedAttacks[reference.queuedIndex].AttackID = &id
		}
	}
}

func (b *Bridge) BeginOwnedEntityTermination(targetKey int, reason string) func() {
	previous := b.ownedEntityTerminationReason[targetKey]
	b.ownedEntityTerminationReason[targetKey] = reason
	return func() {
		if previous == "" {
			delete(b.ownedEntityTerminationReason, targetKey)
		} else {
			b.ownedEntityTerminationReason[targetKey] = previous
		}
	}
}

func (b *Bridge) EndOwnedEntityForKey(targetKey int, replaced bool) {
	id := b.ownedEntityByTargetKey[targetKey]
	if id == 0 {
		return
	}
	row := &b.OwnedEntities[id-1]
	frame := *b.Frame
	row.EndedFrame = &frame
	reason := b.ownedEntityTerminationReason[targetKey]
	if reason == "" {
		reason = "removed"
		if replaced {
			reason = "replaced"
		}
	}
	row.EndReason = reason
	delete(b.ownedEntityByTargetKey, targetKey)
}

// Observe the actual combat loop's Tick call, independently of emitted attacks
// or OnThinkInterval. A terminal instance is removed from the active key map.
func (b *Bridge) RecordOwnedEntityTick(targetKey int) {
	if id := b.ownedEntityByTargetKey[targetKey]; id > 0 {
		b.OwnedEntities[id-1].TickCount++
	}
}

func (b *Bridge) BindOwnedEntityProducerTask(id, taskID int) {
	b.OwnedEntityProducers[id-1].TaskID = &taskID
}
