package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// AbilityProducer is an explicitly annotated source callback, not an inferred
// descendant of an action. The source audit determines which site IDs count
// toward an intrinsic skill contract.
type AbilityProducer struct {
	ID                  int                   `json:"id"`
	InvocationID        *int                  `json:"invocationId,omitempty"`
	ParentHitCallbackID *int                  `json:"parentHitCallbackId,omitempty"`
	TaskID              *int                  `json:"taskId,omitempty"`
	ParentProducerID    *int                  `json:"parentProducerId,omitempty"`
	SiteID              string                `json:"siteId"`
	ActorIndex          int                   `json:"actorIndex"`
	QueuedFrame         int                   `json:"queuedFrame"`
	StartedFrame        *int                  `json:"startedFrame,omitempty"`
	CompletedFrame      *int                  `json:"completedFrame,omitempty"`
	State               string                `json:"state"`
	QueuedAttacks       []AbilityQueuedAttack `json:"queuedAttacks"`
	EntryFacts          map[string]float64    `json:"entryFacts,omitempty"`
	queuedStart         int
	actionSequence      int
}

type producerAttackReference struct {
	producerIndex int
	queuedIndex   int
	attack        *info.AttackEvent
}

// RegisterAbilityProducer captures only an explicit currently executing
// invocation or producer. The returned callback keeps the native scheduler.
func (b *Bridge) RegisterAbilityProducer(siteID string, actorIndex int, f func()) (func(), int) {
	id := len(b.AbilityProducers) + 1
	var invocationID, parentProducerID *int
	var actionSequence int
	if b.activeProducerID > 0 {
		parent := b.activeProducerID
		parentProducerID = &parent
		parentRow := &b.AbilityProducers[parent-1]
		if parentRow.InvocationID != nil {
			bound := *parentRow.InvocationID
			invocationID = &bound
		}
		actionSequence = parentRow.actionSequence
	} else if b.activeAbilityInvocationID > 0 {
		bound := b.activeAbilityInvocationID
		invocationID = &bound
		actionSequence = b.AbilityInvocations[bound-1].ActionSequence
	}
	b.AbilityProducers = append(b.AbilityProducers, AbilityProducer{
		ID: id, InvocationID: invocationID, ParentProducerID: parentProducerID,
		SiteID: siteID, ActorIndex: actorIndex, QueuedFrame: *b.Frame,
		State: "pending", QueuedAttacks: []AbilityQueuedAttack{}, actionSequence: actionSequence,
	})
	return func() {
		previous := b.activeProducerID
		b.activeProducerID = id
		row := &b.AbilityProducers[id-1]
		started := *b.Frame
		row.StartedFrame = &started
		row.queuedStart = len(b.queuedAttackReferences)
		entryOrigin := b.Origin.CaptureForChild()
		f()
		completed := *b.Frame
		row = &b.AbilityProducers[id-1]
		row.CompletedFrame = &completed
		row.State = "completed"
		for _, reference := range b.queuedAttackReferences[row.queuedStart:] {
			if reference.producerID != id || reference.entityID != 0 || reference.ownedTriggerID != 0 || reference.hitCallbackID != 0 || reference.shieldHookID != 0 || reference.shieldProducerID != 0 ||
				row.InvocationID == nil || reference.actorIndex != row.ActorIndex {
				continue
			}
			if row.ParentHitCallbackID != nil {
				// Exact callback ancestry is bound at registration. Enemy tasks do
				// not rebind Origin. Nested attacks change ancestry, and independent
				// event emits keep their own owner, so neither becomes an intrinsic root.
				if reference.origin != entryOrigin || reference.eventCallID != 0 || reference.eventProducerID != 0 || reference.eventEmitSiteID != "" {
					continue
				}
			} else if reference.origin.CreationActionSequence != row.actionSequence || reference.origin.ParentAttackID != 0 ||
				(reference.origin.Via != "task" && reference.origin.Via != "action") {
				continue
			}
			queuedIndex := len(row.QueuedAttacks)
			row.QueuedAttacks = append(row.QueuedAttacks, AbilityQueuedAttack{
				QueueID: reference.queueID, Ability: reference.ability,
				AttackTagName: reference.attackTagName, Frame: reference.frame,
			})
			b.producerAttackReferences = append(b.producerAttackReferences, producerAttackReference{
				producerIndex: id - 1, queuedIndex: queuedIndex, attack: reference.attack,
			})
		}
		b.activeProducerID = previous
	}, id
}

// RecordActiveAbilityProducerFact stores a value already computed inside the
// exact running producer callback; it does not read native state again.
func (b *Bridge) RecordActiveAbilityProducerFact(name string, value float64) {
	if b.activeProducerID == 0 {
		return
	}
	row := &b.AbilityProducers[b.activeProducerID-1]
	if row.EntryFacts == nil {
		row.EntryFacts = make(map[string]float64)
	}
	row.EntryFacts[name] = value
}

// The callback-to-task edge is explicit. Invocation ancestry is recovered from
// the exact parent queue census, never from the current origin or action frame.
func (b *Bridge) RegisterHitCallbackAbilityProducer(siteID string, actorIndex int, f func()) (func(), int) {
	callback, id := b.RegisterAbilityProducer(siteID, actorIndex, f)
	row := &b.AbilityProducers[id-1]
	row.ParentProducerID, row.InvocationID = nil, nil
	row.actionSequence = 0
	if b.activeHitCallbackID == 0 {
		return callback, id
	}
	parentID := b.activeHitCallbackID
	row.ParentHitCallbackID = &parentID
	batch := b.HitCallbackBatches[b.HitCallbacks[parentID-1].BatchID-1]
	if batch.ParentQueueID == nil {
		return callback, id
	}
	for _, invocation := range b.AbilityInvocations {
		for _, attack := range invocation.QueuedAttacks {
			if attack.QueueID == *batch.ParentQueueID && invocation.ActorIndex == actorIndex {
				value := invocation.ID
				row.InvocationID = &value
				row.actionSequence = invocation.ActionSequence
				return callback, id
			}
		}
	}
	for _, producer := range b.AbilityProducers[:id-1] {
		for _, attack := range producer.QueuedAttacks {
			if attack.QueueID == *batch.ParentQueueID && producer.ActorIndex == actorIndex {
				row.InvocationID = producer.InvocationID
				row.actionSequence = producer.actionSequence
				return callback, id
			}
		}
	}
	return callback, id
}

func (b *Bridge) BindAbilityProducerTask(id, taskID int) {
	b.AbilityProducers[id-1].TaskID = &taskID
}
