package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/player/shield"
)

// An instance identifies one actual Add installation, including re-addition of
// the same native object. The frame key and mutable HP source are not identity.
type ShieldInstance struct {
	ID                          int                   `json:"id"`
	ActorIndex                  int                   `json:"actorIndex"`
	TargetIndex                 int                   `json:"targetIndex"`
	Type                        int                   `json:"type"`
	Description                 string                `json:"description"`
	SourceKeyFrame              int                   `json:"sourceKeyFrame"`
	CreatedFrame                int                   `json:"createdFrame"`
	NativeExpiryFrame           int                   `json:"nativeExpiryFrame"`
	InitialHP                   float64               `json:"initialHP"`
	BirthHPSourceCalculationID  *int                  `json:"birthHPSourceCalculationId,omitempty"`
	CreationOrigin              info.SourceHostOrigin `json:"creationOrigin"`
	CreationSiteID              string                `json:"creationSiteId,omitempty"`
	InvocationID                *int                  `json:"invocationId,omitempty"`
	SpawnProducerID             *int                  `json:"spawnProducerId,omitempty"`
	CreationCallbackID          *int                  `json:"creationCallbackId,omitempty"`
	CreationEventListenerCallID *int                  `json:"creationEventListenerCallId,omitempty"`
	ReplacesInstanceID          *int                  `json:"replacesInstanceId,omitempty"`
	ReplacedByInstanceID        *int                  `json:"replacedByInstanceId,omitempty"`
	TerminalFrame               *int                  `json:"terminalFrame,omitempty"`
	TerminalReason              string                `json:"terminalReason,omitempty"`
	LastHP                      float64               `json:"lastHP"`
	LastHPSourceCalculationID   *int                  `json:"lastHPSourceCalculationId,omitempty"`
}

type ShieldHook struct {
	AbilityProducerID   *int                `json:"abilityProducerId,omitempty"`
	ShieldProducerID    *int                `json:"shieldProducerId,omitempty"`
	HitCallbackID       *int                `json:"hitCallbackId,omitempty"`
	EventListenerCallID *int                `json:"eventListenerCallId,omitempty"`
	EntryFacts          map[string]float64  `json:"entryFacts,omitempty"`
	ID                  int                 `json:"id"`
	InstanceID          int                 `json:"instanceId"`
	SiteID              string              `json:"siteId,omitempty"`
	Cause               string              `json:"cause"`
	StartedFrame        int                 `json:"startedFrame"`
	CompletedFrame      int                 `json:"completedFrame"`
	PlayerAttackID      *int                `json:"playerAttackId,omitempty"`
	HPBefore            float64             `json:"hpBefore"`
	HPAfter             float64             `json:"hpAfter"`
	QueuedAttacks       []EventQueuedAttack `json:"queuedAttacks"`
}

type shieldAttackReference struct {
	producer    bool
	hookIndex   int
	queuedIndex int
	attack      *info.AttackEvent
}

func shieldHPSource(shd shield.Shield) *int {
	if source, ok := shd.(interface{ SourceHostHPSource() int }); ok {
		if value := source.SourceHostHPSource(); value > 0 {
			return &value
		}
	}
	return nil
}

func (b *Bridge) BeginShieldBirth(siteID string) func() {
	previous := b.pendingShieldBirthSite
	b.pendingShieldBirthSite = siteID
	return func() { b.pendingShieldBirthSite = previous }
}

// ShieldAdded runs after the original overwrite hook and installation, before
// OnShielded. All audited native Shield implementations have pointer identity.
func (b *Bridge) ShieldAdded(shd, replaced shield.Shield) {
	id := len(b.ShieldInstances) + 1
	row := ShieldInstance{
		ID: id, ActorIndex: shd.ShieldOwner(), TargetIndex: shd.ShieldTarget(),
		Type: int(shd.Type()), Description: shd.Desc(), SourceKeyFrame: shd.Key(),
		CreatedFrame: *b.Frame, NativeExpiryFrame: shd.Expiry(),
		InitialHP: shd.CurrentHP(), BirthHPSourceCalculationID: shieldHPSource(shd),
		CreationOrigin: b.Origin.Snapshot(), CreationSiteID: b.pendingShieldBirthSite,
		LastHP: shd.CurrentHP(), LastHPSourceCalculationID: shieldHPSource(shd),
	}
	if replaced != nil {
		previous := b.shieldInstanceByObject[replaced]
		row.ReplacesInstanceID = &previous
		b.ShieldInstances[previous-1].ReplacedByInstanceID = &id
	}
	// Only an explicit birth site can claim ability ownership. C6 callbacks
	// remain callback-owned even while an enclosing producer is executing.
	if row.CreationSiteID != "" {
		switch {
		case b.activeHitCallbackID > 0:
			value := b.activeHitCallbackID
			row.CreationCallbackID = &value
		case b.activeEventCallID > 0:
			value := b.activeEventCallID
			row.CreationEventListenerCallID = &value
		case b.activeProducerID > 0:
			value := b.activeProducerID
			row.SpawnProducerID = &value
			row.InvocationID = b.AbilityProducers[value-1].InvocationID
		case b.activeAbilityInvocationID > 0:
			value := b.activeAbilityInvocationID
			row.InvocationID = &value
		}
	}
	b.ShieldInstances = append(b.ShieldInstances, row)
	b.shieldInstanceByObject[shd] = id
}

func (b *Bridge) ShieldEnded(shd shield.Shield, reason string) {
	row := &b.ShieldInstances[b.shieldInstanceByObject[shd]-1]
	frame := *b.Frame
	row.TerminalFrame = &frame
	row.TerminalReason = reason
	row.LastHP = shd.CurrentHP()
	row.LastHPSourceCalculationID = shieldHPSource(shd)
}

func (b *Bridge) BeginShieldHook(shd shield.Shield, siteID, cause string) func() {
	id := len(b.ShieldHooks) + 1
	instanceID := b.shieldInstanceByObject[shd]
	row := ShieldHook{
		ID: id, InstanceID: instanceID, SiteID: siteID, Cause: cause,
		StartedFrame: *b.Frame, HPBefore: shd.CurrentHP(), QueuedAttacks: []EventQueuedAttack{},
	}
	if b.activeProducerID > 0 {
		value := b.activeProducerID
		row.AbilityProducerID = &value
	}
	if b.activeShieldProducerID > 0 {
		value := b.activeShieldProducerID
		row.ShieldProducerID = &value
	}
	if b.activeHitCallbackID > 0 {
		value := b.activeHitCallbackID
		row.HitCallbackID = &value
	}
	if b.activeEventCallID > 0 {
		value := b.activeEventCallID
		row.EventListenerCallID = &value
	}
	if cause == "damage" && b.CurrentPlayerAttackID > 0 {
		value := b.CurrentPlayerAttackID
		row.PlayerAttackID = &value
	}
	b.ShieldHooks = append(b.ShieldHooks, row)
	previous := b.activeShieldHookID
	b.activeShieldHookID = id
	queuedStart := len(b.queuedAttackReferences)
	return func() {
		row := &b.ShieldHooks[id-1]
		row.CompletedFrame = *b.Frame
		row.HPAfter = shd.CurrentHP()
		instance := &b.ShieldInstances[instanceID-1]
		instance.LastHP = row.HPAfter
		instance.LastHPSourceCalculationID = shieldHPSource(shd)
		for _, reference := range b.queuedAttackReferences[queuedStart:] {
			if reference.shieldHookID != id || reference.shieldEmitSiteID == "" {
				continue
			}
			queuedIndex := len(row.QueuedAttacks)
			row.QueuedAttacks = append(row.QueuedAttacks, EventQueuedAttack{
				QueueID: reference.queueID, Ability: reference.ability,
				AttackTagName: reference.attackTagName, Frame: reference.frame,
				EmitSiteID: reference.shieldEmitSiteID,
			})
			b.shieldAttackReferences = append(b.shieldAttackReferences, shieldAttackReference{
				hookIndex: id - 1, queuedIndex: queuedIndex, attack: reference.attack,
			})
		}
		b.activeShieldHookID = previous
	}
}

func (b *Bridge) BeginShieldEmit(siteID string) func() {
	previous := b.pendingShieldEmitSite
	b.pendingShieldEmitSite = siteID
	return func() { b.pendingShieldEmitSite = previous }
}

func (b *Bridge) FinalizeShields() {
	for shd, id := range b.shieldInstanceByObject {
		row := &b.ShieldInstances[id-1]
		if row.TerminalFrame == nil {
			row.LastHP = shd.CurrentHP()
			row.LastHPSourceCalculationID = shieldHPSource(shd)
		}
	}
	for _, reference := range b.shieldAttackReferences {
		if reference.attack.SourceHostAttackID > 0 {
			id := reference.attack.SourceHostAttackID
			if reference.producer {
				b.ShieldProducers[reference.hookIndex].QueuedAttacks[reference.queuedIndex].AttackID = &id
			} else {
				b.ShieldHooks[reference.hookIndex].QueuedAttacks[reference.queuedIndex].AttackID = &id
			}
		}
	}
}

// Lookup only the already observed native object, without querying gameplay state.
func (b *Bridge) ShieldInstanceID(shd shield.Shield) int { return b.shieldInstanceByObject[shd] }

func (b *Bridge) RecordShieldHookFact(key string, value float64) {
	if b.activeShieldHookID == 0 {
		return
	}
	row := &b.ShieldHooks[b.activeShieldHookID-1]
	if row.EntryFacts == nil {
		row.EntryFacts = make(map[string]float64)
	}
	row.EntryFacts[key] = value
}
