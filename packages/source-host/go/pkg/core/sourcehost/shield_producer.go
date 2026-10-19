package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/player/shield"

// ShieldProducer follows one actual native queued task. Its owner is the shield whose
// creation started the chain; the shield found by a later native gate may differ.
type ShieldProducer struct {
	ParentHookID           *int                `json:"parentHookId,omitempty"`
	SpawnAbilityProducerID *int                `json:"spawnAbilityProducerId,omitempty"`
	ID                     int                 `json:"id"`
	SiteID                 string              `json:"siteId"`
	OwnerInstanceID        *int                `json:"ownerInstanceId,omitempty"`
	ParentProducerID       *int                `json:"parentProducerId,omitempty"`
	TaskID                 int                 `json:"taskId"`
	QueuedFrame            int                 `json:"queuedFrame"`
	RunFrame               *int                `json:"runFrame,omitempty"`
	CompletedFrame         *int                `json:"completedFrame,omitempty"`
	State                  string              `json:"state"`
	GateObserved           bool                `json:"gateObserved"`
	GateInstanceID         *int                `json:"gateInstanceId,omitempty"`
	EntryFacts             map[string]float64  `json:"entryFacts,omitempty"`
	QueuedAttacks          []EventQueuedAttack `json:"queuedAttacks"`
}

func (b *Bridge) RegisterShieldProducer(siteID string, f func()) (func(), int) {
	id := len(b.ShieldProducers) + 1
	row := ShieldProducer{
		ID: id, SiteID: siteID, QueuedFrame: *b.Frame,
		State: "pending", QueuedAttacks: []EventQueuedAttack{},
	}
	if b.activeShieldHookID > 0 {
		parent := b.activeShieldHookID
		row.ParentHookID = &parent
		owner := b.ShieldHooks[parent-1].InstanceID
		row.OwnerInstanceID = &owner
	} else if b.activeShieldProducerID > 0 {
		parent := b.activeShieldProducerID
		row.ParentProducerID = &parent
		row.OwnerInstanceID = b.ShieldProducers[parent-1].OwnerInstanceID
	}
	if row.ParentHookID == nil && row.ParentProducerID == nil && b.activeProducerID > 0 {
		parent := b.activeProducerID
		row.SpawnAbilityProducerID = &parent
	}
	b.ShieldProducers = append(b.ShieldProducers, row)
	return func() {
		previous := b.activeShieldProducerID
		b.activeShieldProducerID = id
		frame := *b.Frame
		b.ShieldProducers[id-1].RunFrame = &frame
		queuedStart := len(b.queuedAttackReferences)
		f()
		row := &b.ShieldProducers[id-1]
		frame = *b.Frame
		row.CompletedFrame = &frame
		row.State = "completed"
		for _, reference := range b.queuedAttackReferences[queuedStart:] {
			if reference.shieldProducerID != id || reference.shieldHookID != 0 || reference.shieldEmitSiteID == "" {
				continue
			}
			queuedIndex := len(row.QueuedAttacks)
			row.QueuedAttacks = append(row.QueuedAttacks, EventQueuedAttack{
				QueueID: reference.queueID, Ability: reference.ability,
				AttackTagName: reference.attackTagName, Frame: reference.frame,
				EmitSiteID: reference.shieldEmitSiteID,
			})
			b.shieldAttackReferences = append(b.shieldAttackReferences, shieldAttackReference{
				producer: true, hookIndex: id - 1, queuedIndex: queuedIndex, attack: reference.attack,
			})
		}
		b.activeShieldProducerID = previous
	}, id
}

func (b *Bridge) BindShieldProducerTask(id, taskID int) {
	b.ShieldProducers[id-1].TaskID = taskID
}

// A native source may queue its first tick before creating/installing the
// shield. Bind that recorded task after Add, without moving either operation.
func (b *Bridge) BindShieldProducerOwner(id int, shd shield.Shield) {
	owner := b.shieldInstanceByObject[shd]
	b.ShieldProducers[id-1].OwnerInstanceID = &owner
}

func (b *Bridge) RecordShieldProducerGate(shd shield.Shield) {
	if b.activeShieldProducerID == 0 {
		return
	}
	row := &b.ShieldProducers[b.activeShieldProducerID-1]
	row.GateObserved = true
	if shd != nil {
		value := b.shieldInstanceByObject[shd]
		row.GateInstanceID = &value
	}
}

func (b *Bridge) RecordShieldProducerFact(key string, value float64) {
	if b.activeShieldProducerID == 0 {
		return
	}
	row := &b.ShieldProducers[b.activeShieldProducerID-1]
	if row.EntryFacts == nil {
		row.EntryFacts = make(map[string]float64)
	}
	row.EntryFacts[key] = value
}
