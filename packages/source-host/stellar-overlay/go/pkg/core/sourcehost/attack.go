package sourcehost

import (
	"fmt"

	"github.com/genshinsim/gcsim/pkg/core/attacks"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// The a7 source added tags after the Lunar range. Keep source names in receipts.
var specialAttackTagNames = map[attacks.AttackTag]string{
	attacks.AttackTagReactionStellarSwirl: "AttackTagReactionStellarSwirl",
	attacks.AttackTagDirectStellarConduct: "AttackTagDirectStellarConduct",
	attacks.AttackTagDirectStellarSwirl:   "AttackTagDirectStellarSwirl",
}

func AttackTagName(tag attacks.AttackTag) string {
	if name, ok := specialAttackTagNames[tag]; ok {
		return name
	}
	return fmt.Sprintf("AttackTag(%d)", tag)
}

// BeginAttackDispatch identifies one actual ApplyAttack invocation. Save and
// restore the field because a callback may recursively reuse this AttackEvent.
// Per-target copies keep their invocation ID for deferred application tasks.
func (b *Bridge) BeginAttackDispatch(a *info.AttackEvent) func() {
	previous := a.SourceHostDispatchID
	b.dispatchSequence++
	a.SourceHostDispatchID = b.dispatchSequence
	return func() { a.SourceHostDispatchID = previous }
}

func (b *Bridge) PrepareAttack(a *info.AttackEvent) {
	if a.SourceHostAttackID == 0 {
		a.SourceHostAttackID = b.NextAttackID()
	}
	if a.SourceHostQueuedObservationIndex > 0 {
		row := &b.AttackObservations[a.SourceHostQueuedObservationIndex-1]
		if row.AttackID == nil {
			id := a.SourceHostAttackID
			row.AttackID = &id
		}
	}
}

// BeginImmediateAttackOccurrence scopes only observational identity for an
// audited synchronous QueueAttackEvent(a, 0) in ordinary ability scope. The
// native event and all of its gameplay/snapshot mutations remain untouched.
func (b *Bridge) BeginImmediateAttackOccurrence(a *info.AttackEvent) func() {
	origin, queueID := a.SourceHostOrigin, a.SourceHostQueuedObservationIndex
	attackID, dispatchID := a.SourceHostAttackID, a.SourceHostDispatchID
	a.SourceHostOrigin = nil
	a.SourceHostQueuedObservationIndex = 0
	a.SourceHostAttackID = 0
	a.SourceHostDispatchID = 0
	return func() {
		a.SourceHostOrigin, a.SourceHostQueuedObservationIndex = origin, queueID
		a.SourceHostAttackID, a.SourceHostDispatchID = attackID, dispatchID
	}
}

// CaptureAttack stores origin at initial native AttackEvent creation, before
// snapshot delay or other callbacks can change the active execution context.
func (b *Bridge) CaptureAttack(a *info.AttackEvent) {
	emitSiteID := b.pendingOwnedEmitSite
	b.pendingOwnedEmitSite = ""
	constructEmitterID := b.pendingConstructEmitterID
	b.pendingConstructEmitterID = 0
	entityEmitSiteID := b.pendingOwnedEntityEmitSite
	b.pendingOwnedEntityEmitSite = ""
	hitEmitSiteID := b.pendingHitEmitSite
	b.pendingHitEmitSite = ""
	shieldEmitSiteID := b.pendingShieldEmitSite
	b.pendingShieldEmitSite = ""
	eventEmitSiteID := b.pendingEventEmitSite
	b.pendingEventEmitSite = ""
	if a.SourceHostOrigin != nil {
		return
	}
	origin := b.Origin.CaptureForChild()
	a.SourceHostOrigin = &origin
	b.AttackObservations = append(b.AttackObservations, AttackObservation{
		Stage: "queued", Frame: *b.Frame, Origin: origin,
	})
	a.SourceHostQueuedObservationIndex = len(b.AttackObservations)
	b.queuedAttackReferences = append(b.queuedAttackReferences, queuedAttackReference{attack: a, queueID: a.SourceHostQueuedObservationIndex, frame: *b.Frame, origin: origin, actorIndex: a.Info.ActorIndex, ability: a.Info.Abil, attackTagName: AttackTagName(a.Info.AttackTag), producerID: b.activeProducerID, ownedTriggerID: b.activeOwnedTriggerID, emitSiteID: emitSiteID, entityID: b.activeOwnedEntityID, entityTriggerID: b.activeOwnedEntityTriggerID, entityProducerID: b.activeOwnedEntityProducerID, entityEmitSiteID: entityEmitSiteID, constructEmitterID: constructEmitterID, hitCallbackID: b.activeHitCallbackID, hitEmitSiteID: hitEmitSiteID, eventCallID: b.activeEventCallID, eventProducerID: b.activeEventProducerID, eventEmitSiteID: eventEmitSiteID, shieldHookID: b.activeShieldHookID, shieldProducerID: b.activeShieldProducerID, shieldEmitSiteID: shieldEmitSiteID})
}

func (b *Bridge) AttackOrigin(a *info.AttackEvent) info.SourceHostOrigin {
	if a.SourceHostOrigin == nil {
		return info.SourceHostOrigin{Via: "unassigned"}
	}
	return *a.SourceHostOrigin
}

func (b *Bridge) ObserveAttackDispatch(a *info.AttackEvent) {
	id := a.SourceHostAttackID
	b.AttackObservations = append(b.AttackObservations, AttackObservation{
		AttackID: &id, DispatchID: a.SourceHostDispatchID, Stage: "dispatched", Frame: *b.Frame, Origin: b.AttackOrigin(a),
	})
}

func (b *Bridge) ObserveAttackTarget(a *info.AttackEvent, target info.TargetKey, stage, reason string) {
	key := int(target)
	id := a.SourceHostAttackID
	b.AttackObservations = append(b.AttackObservations, AttackObservation{
		AttackID: &id, DispatchID: a.SourceHostDispatchID, Stage: stage, Frame: *b.Frame,
		TargetKey: &key, Reason: reason, Origin: b.AttackOrigin(a),
	})
}
