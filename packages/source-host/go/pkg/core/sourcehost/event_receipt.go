package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/event"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// These rows observe actual native event calls. A registered global listener is
// not thereby owned by the attack that happens to trigger it.
type EventRegistration struct {
	ID           int                   `json:"id"`
	EventType    int                   `json:"eventType"`
	SlotIndex    int                   `json:"slotIndex"`
	Key          string                `json:"key"`
	CreatedFrame int                   `json:"createdFrame"`
	Origin       info.SourceHostOrigin `json:"origin"`
	State        string                `json:"state"`
	EndedFrame   *int                  `json:"endedFrame,omitempty"`
	SiteID       string                `json:"siteId,omitempty"`
}

type EventEmission struct {
	ID                    int    `json:"id"`
	EventType             int    `json:"eventType"`
	Mode                  string `json:"mode"`
	Frame                 int    `json:"frame"`
	TargetKey             int    `json:"targetKey"`
	ParentQueueID         *int   `json:"parentQueueId,omitempty"`
	ParentAttackID        *int   `json:"parentAttackId,omitempty"`
	ParentDispatchID      *int   `json:"parentDispatchId,omitempty"`
	ParentEmissionID      *int   `json:"parentEmissionId,omitempty"`
	ListenerIDs           []int  `json:"listenerIds"`
	SuppressedListenerIDs []int  `json:"suppressedListenerIds"`
	CompletedFrame        int    `json:"completedFrame"`
	attack                *info.AttackEvent
}

type EventQueuedAttack struct {
	QueueID       int    `json:"queueId"`
	AttackID      *int   `json:"attackId,omitempty"`
	Ability       string `json:"ability"`
	AttackTagName string `json:"attackTagName"`
	Frame         int    `json:"frame"`
	EmitSiteID    string `json:"emitSiteId"`
}

type EventListenerCall struct {
	ID             int                 `json:"id"`
	EmissionID     int                 `json:"emissionId"`
	RegistrationID int                 `json:"registrationId"`
	SlotIndex      int                 `json:"slotIndex"`
	EventType      int                 `json:"eventType"`
	Key            string              `json:"key"`
	SiteID         string              `json:"siteId,omitempty"`
	StartedFrame   int                 `json:"startedFrame"`
	CompletedFrame int                 `json:"completedFrame"`
	QueuedAttacks  []EventQueuedAttack `json:"queuedAttacks"`
	EntryFacts     map[string]float64  `json:"entryFacts,omitempty"`
	queuedStart    int
}

type EventProducer struct {
	ID               int                 `json:"id"`
	SiteID           string              `json:"siteId"`
	ListenerCallID   int                 `json:"listenerCallId"`
	ParentProducerID *int                `json:"parentProducerId,omitempty"`
	TaskID           int                 `json:"taskId"`
	QueuedFrame      int                 `json:"queuedFrame"`
	RunFrame         *int                `json:"runFrame,omitempty"`
	CompletedFrame   *int                `json:"completedFrame,omitempty"`
	State            string              `json:"state"`
	QueuedAttacks    []EventQueuedAttack `json:"queuedAttacks"`
	EntryFacts       map[string]float64  `json:"entryFacts,omitempty"`
}

type eventAttackReference struct {
	producer    bool
	rowIndex    int
	queuedIndex int
	attack      *info.AttackEvent
}

func (b *Bridge) RegisterEventListener(eventType, slotIndex int, key string, origin info.SourceHostOrigin) int {
	id := len(b.EventRegistrations) + 1
	b.EventRegistrations = append(b.EventRegistrations, EventRegistration{
		ID: id, EventType: eventType, SlotIndex: slotIndex, Key: key,
		CreatedFrame: *b.Frame, Origin: origin, State: "active",
	})
	return id
}

func (b *Bridge) EndEventListenerRegistration(id int, state string) {
	if id == 0 || b.EventRegistrations[id-1].State != "active" {
		return
	}
	frame := *b.Frame
	row := &b.EventRegistrations[id-1]
	row.State = state
	row.EndedFrame = &frame
}

func eventArgs(args []any) (info.Target, *info.AttackEvent) {
	var target info.Target
	var attack *info.AttackEvent
	for _, arg := range args {
		if target == nil {
			target, _ = arg.(info.Target)
		}
		if attack == nil {
			attack, _ = arg.(*info.AttackEvent)
		}
	}
	return target, attack
}

func (b *Bridge) BeginEventEmission(eventType int, mode string, args ...any) int {
	target, attack := eventArgs(args)
	id := len(b.EventEmissions) + 1
	row := EventEmission{
		ID: id, EventType: eventType, Mode: mode, Frame: *b.Frame,
		ListenerIDs: []int{}, SuppressedListenerIDs: []int{}, attack: attack,
	}
	if target != nil {
		row.TargetKey = int(target.Key())
	}
	if attack != nil {
		if attack.SourceHostQueuedObservationIndex > 0 {
			value := attack.SourceHostQueuedObservationIndex
			row.ParentQueueID = &value
		}
		if attack.SourceHostAttackID > 0 {
			value := attack.SourceHostAttackID
			row.ParentAttackID = &value
		}
		if attack.SourceHostDispatchID > 0 {
			value := attack.SourceHostDispatchID
			row.ParentDispatchID = &value
		}
	}
	if b.activeEventEmissionID > 0 {
		value := b.activeEventEmissionID
		row.ParentEmissionID = &value
	}
	b.EventEmissions = append(b.EventEmissions, row)
	b.activeEventEmissionID = id
	return id
}

func (b *Bridge) CompleteEventEmission(id int) {
	row := &b.EventEmissions[id-1]
	row.CompletedFrame = *b.Frame
	if row.ParentEmissionID == nil {
		b.activeEventEmissionID = 0
	} else {
		b.activeEventEmissionID = *row.ParentEmissionID
	}
}

func (b *Bridge) SuppressEventListener(emissionID, registrationID int) {
	b.EventEmissions[emissionID-1].SuppressedListenerIDs = append(b.EventEmissions[emissionID-1].SuppressedListenerIDs, registrationID)
}

func (b *Bridge) BeginEventListenerCall(emissionID, registrationID, slotIndex int, key string) func() {
	id := len(b.EventListenerCalls) + 1
	b.EventEmissions[emissionID-1].ListenerIDs = append(b.EventEmissions[emissionID-1].ListenerIDs, id)
	previous := b.activeEventCallID
	b.activeEventCallID = id
	b.EventListenerCalls = append(b.EventListenerCalls, EventListenerCall{
		ID: id, EmissionID: emissionID, RegistrationID: registrationID,
		SlotIndex: slotIndex, EventType: b.EventEmissions[emissionID-1].EventType,
		Key: key, StartedFrame: *b.Frame, QueuedAttacks: []EventQueuedAttack{},
		queuedStart: len(b.queuedAttackReferences),
	})
	return func() {
		row := &b.EventListenerCalls[id-1]
		row.CompletedFrame = *b.Frame
		for _, reference := range b.queuedAttackReferences[row.queuedStart:] {
			if reference.eventCallID != id || reference.eventEmitSiteID == "" {
				continue
			}
			queuedIndex := len(row.QueuedAttacks)
			row.QueuedAttacks = append(row.QueuedAttacks, EventQueuedAttack{
				QueueID: reference.queueID, Ability: reference.ability,
				AttackTagName: reference.attackTagName, Frame: reference.frame,
				EmitSiteID: reference.eventEmitSiteID,
			})
			b.eventAttackReferences = append(b.eventAttackReferences, eventAttackReference{
				rowIndex: id - 1, queuedIndex: queuedIndex, attack: reference.attack,
			})
		}
		b.activeEventCallID = previous
	}
}

// The source callback passes through its own args, tying a site label to the
// exact running emission instead of a nearby event with the same key.
func (b *Bridge) LabelActiveEventListener(siteID string, args ...any) {
	id := b.activeEventCallID
	if id == 0 {
		return
	}
	row := &b.EventListenerCalls[id-1]
	emission := &b.EventEmissions[row.EmissionID-1]
	target, attack := eventArgs(args)
	// OnSkill is emitted without arguments by the native action dispatcher.
	// Its current emission/call pair supplies identity without a target hit.
	if emission.EventType == int(event.OnSkill) {
		if len(args) != 0 {
			return
		}
	} else if target == nil || int(target.Key()) != emission.TargetKey || attack != emission.attack {
		return
	}
	row.SiteID = siteID
	b.EventRegistrations[row.RegistrationID-1].SiteID = siteID
}

func (b *Bridge) RecordActiveEventListenerFact(key string, value float64) {
	if b.activeEventCallID == 0 {
		return
	}
	row := &b.EventListenerCalls[b.activeEventCallID-1]
	if row.EntryFacts == nil {
		row.EntryFacts = make(map[string]float64)
	}
	row.EntryFacts[key] = value
}

func (b *Bridge) BeginEventEmit(siteID string) func() {
	previous := b.pendingEventEmitSite
	b.pendingEventEmitSite = siteID
	return func() { b.pendingEventEmitSite = previous }
}

func (b *Bridge) RegisterEventProducer(siteID string, f func()) (func(), int) {
	listenerID := b.activeEventCallID
	var parentID *int
	if listenerID == 0 && b.activeEventProducerID > 0 {
		value := b.activeEventProducerID
		parentID = &value
		listenerID = b.EventProducers[value-1].ListenerCallID
	}
	if listenerID == 0 {
		return f, 0
	}
	id := len(b.EventProducers) + 1
	b.EventProducers = append(b.EventProducers, EventProducer{
		ID: id, SiteID: siteID, ListenerCallID: listenerID, ParentProducerID: parentID,
		QueuedFrame: *b.Frame, State: "pending", QueuedAttacks: []EventQueuedAttack{},
	})
	return func() {
		previous := b.activeEventProducerID
		b.activeEventProducerID = id
		frame := *b.Frame
		b.EventProducers[id-1].RunFrame = &frame
		queuedStart := len(b.queuedAttackReferences)
		f()
		row := &b.EventProducers[id-1]
		frame = *b.Frame
		row.CompletedFrame = &frame
		row.State = "completed"
		for _, reference := range b.queuedAttackReferences[queuedStart:] {
			if reference.eventProducerID != id || reference.eventCallID != 0 || reference.eventEmitSiteID == "" {
				continue
			}
			queuedIndex := len(row.QueuedAttacks)
			row.QueuedAttacks = append(row.QueuedAttacks, EventQueuedAttack{
				QueueID: reference.queueID, Ability: reference.ability,
				AttackTagName: reference.attackTagName, Frame: reference.frame,
				EmitSiteID: reference.eventEmitSiteID,
			})
			b.eventAttackReferences = append(b.eventAttackReferences, eventAttackReference{
				producer: true, rowIndex: id - 1, queuedIndex: queuedIndex, attack: reference.attack,
			})
		}
		b.activeEventProducerID = previous
	}, id
}

// Facts belong to the audited task currently running, including child tasks.
func (b *Bridge) RecordActiveEventProducerFact(key string, value float64) {
	if b.activeEventProducerID == 0 {
		return
	}
	row := &b.EventProducers[b.activeEventProducerID-1]
	if row.EntryFacts == nil {
		row.EntryFacts = make(map[string]float64)
	}
	row.EntryFacts[key] = value
}

func (b *Bridge) BindEventProducerTask(id, taskID int) {
	if id > 0 {
		b.EventProducers[id-1].TaskID = taskID
	}
}

func (b *Bridge) FinalizeEventAttacks() {
	for _, reference := range b.eventAttackReferences {
		if reference.attack.SourceHostAttackID == 0 {
			continue
		}
		id := reference.attack.SourceHostAttackID
		if reference.producer {
			b.EventProducers[reference.rowIndex].QueuedAttacks[reference.queuedIndex].AttackID = &id
		} else {
			b.EventListenerCalls[reference.rowIndex].QueuedAttacks[reference.queuedIndex].AttackID = &id
		}
	}
}
