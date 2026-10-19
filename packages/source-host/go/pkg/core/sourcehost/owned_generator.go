package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// OwnedGenerator binds one audited activation site to an exact native modifier
// object. Its lifetime is reported separately by StatusInstances.
type OwnedGenerator struct {
	ID                   int    `json:"id"`
	SiteID               string `json:"siteId"`
	InvocationID         *int   `json:"invocationId,omitempty"`
	StatusInstanceID     int    `json:"statusInstanceId"`
	HolderActorIndex     *int   `json:"holderActorIndex,omitempty"`
	ActivationProducerID *int   `json:"activationProducerId,omitempty"`
	ActorIndex           int    `json:"actorIndex"`
	ActivatedFrame       int    `json:"activatedFrame"`
	TriggerIDs           []int  `json:"triggerIds"`
}

type OwnedGeneratorQueuedAttack struct {
	QueueID       int    `json:"queueId"`
	AttackID      *int   `json:"attackId,omitempty"`
	Ability       string `json:"ability"`
	AttackTagName string `json:"attackTagName"`
	Frame         int    `json:"frame"`
	EmitSiteID    string `json:"emitSiteId"`
}

// A trigger is an actual successful call to an audited persistent emitter.
// Its origin retains the later N/E trigger and any callback ancestry unchanged.
type OwnedGeneratorTrigger struct {
	ID             int                          `json:"id"`
	GeneratorID    int                          `json:"generatorId"`
	SiteID         string                       `json:"siteId"`
	Kind           string                       `json:"kind"`
	Origin         info.SourceHostOrigin        `json:"origin"`
	StartedFrame   int                          `json:"startedFrame"`
	CompletedFrame int                          `json:"completedFrame"`
	QueuedAttacks  []OwnedGeneratorQueuedAttack `json:"queuedAttacks"`
	queuedStart    int
}

type ownedTriggerAttackReference struct {
	triggerIndex int
	queuedIndex  int
	attack       *info.AttackEvent
}

// RegisterOwnedGenerator uses an explicit source callsite and the newly
// installed status instance. Synchronous activation binds its exact active
// invocation; the existing delayed activation path remains Q-specific.
func (b *Bridge) RegisterOwnedGenerator(siteID string, owner *info.SourceHostStatusOwner) {
	if owner == nil {
		return
	}
	match := 0
	if b.activeAbilityInvocationID > 0 {
		invocation := b.AbilityInvocations[b.activeAbilityInvocationID-1]
		if invocation.ActorIndex == owner.ActorIndex &&
			invocation.ActionSequence == owner.CreationActionSequence {
			match = invocation.ID
		}
	}
	if match == 0 && owner.CreationActionSequence > 0 {
		for _, invocation := range b.AbilityInvocations {
			if invocation.ActionSequence == owner.CreationActionSequence &&
				invocation.ActorIndex == owner.ActorIndex && invocation.Action == "burst" {
				if match != 0 {
					match = 0
					break
				}
				match = invocation.ID
			}
		}
	}
	var invocationID *int
	if match > 0 {
		invocationID = &match
	}
	id := len(b.OwnedGenerators) + 1
	b.OwnedGenerators = append(b.OwnedGenerators, OwnedGenerator{
		ID: id, SiteID: siteID, InvocationID: invocationID,
		StatusInstanceID: owner.InstanceID, ActorIndex: owner.ActorIndex,
		ActivatedFrame: *b.Frame, TriggerIDs: []int{},
	})
	b.ownedGeneratorByStatus[owner.InstanceID] = id
}

// RegisterOwnedGeneratorFromProducer binds a delayed activation to its exact
// source producer. A party-wide buff keeps the modifier holder separate from the
// attack emitter; neither the action frame nor event ancestry supplies this edge.
func (b *Bridge) RegisterOwnedGeneratorFromProducer(siteID string, actorIndex int, owner *info.SourceHostStatusOwner) {
	if owner == nil || b.activeProducerID == 0 {
		return
	}
	producer := b.AbilityProducers[b.activeProducerID-1]
	if producer.InvocationID == nil || producer.ActorIndex != actorIndex {
		return
	}
	invocation := b.AbilityInvocations[*producer.InvocationID-1]
	if invocation.ActorIndex != actorIndex || invocation.ActionSequence != owner.CreationActionSequence {
		return
	}
	invocationID, producerID, holder := invocation.ID, producer.ID, owner.ActorIndex
	id := len(b.OwnedGenerators) + 1
	b.OwnedGenerators = append(b.OwnedGenerators, OwnedGenerator{
		ID: id, SiteID: siteID, InvocationID: &invocationID,
		StatusInstanceID: owner.InstanceID, ActorIndex: actorIndex,
		HolderActorIndex: &holder, ActivationProducerID: &producerID,
		ActivatedFrame: *b.Frame, TriggerIDs: []int{},
	})
	b.ownedGeneratorByStatus[owner.InstanceID] = id
}

// BeginOwnedGeneratorTrigger records an actual successful emitter invocation.
// Missing/unbound modifier ownership remains unknown and creates no skill claim.
func (b *Bridge) BeginOwnedGeneratorTrigger(siteID, kind string, owner *info.SourceHostStatusOwner) func() {
	if owner == nil || siteID == "" {
		return func() {}
	}
	generatorID := b.ownedGeneratorByStatus[owner.InstanceID]
	if generatorID == 0 {
		return func() {}
	}
	id := len(b.OwnedGeneratorTriggers) + 1
	b.OwnedGenerators[generatorID-1].TriggerIDs = append(b.OwnedGenerators[generatorID-1].TriggerIDs, id)
	previous := b.activeOwnedTriggerID
	b.activeOwnedTriggerID = id
	b.OwnedGeneratorTriggers = append(b.OwnedGeneratorTriggers, OwnedGeneratorTrigger{
		ID: id, GeneratorID: generatorID, SiteID: siteID, Kind: kind,
		Origin: b.Origin.Snapshot(), StartedFrame: *b.Frame,
		QueuedAttacks: []OwnedGeneratorQueuedAttack{},
		queuedStart:   len(b.queuedAttackReferences),
	})
	return func() {
		row := &b.OwnedGeneratorTriggers[id-1]
		row.CompletedFrame = *b.Frame
		generator := b.OwnedGenerators[generatorID-1]
		for _, reference := range b.queuedAttackReferences[row.queuedStart:] {
			if reference.ownedTriggerID != id || reference.emitSiteID == "" ||
				reference.actorIndex != generator.ActorIndex ||
				reference.origin.StatusOwner == nil ||
				reference.origin.StatusOwner.InstanceID != generator.StatusInstanceID {
				continue
			}
			queuedIndex := len(row.QueuedAttacks)
			row.QueuedAttacks = append(row.QueuedAttacks, OwnedGeneratorQueuedAttack{
				QueueID: reference.queueID, Ability: reference.ability,
				AttackTagName: reference.attackTagName, Frame: reference.frame,
				EmitSiteID: reference.emitSiteID,
			})
			b.ownedTriggerAttackReferences = append(b.ownedTriggerAttackReferences, ownedTriggerAttackReference{
				triggerIndex: id - 1, queuedIndex: queuedIndex, attack: reference.attack,
			})
		}
		b.activeOwnedTriggerID = previous
	}
}

// BeginOwnedEmit labels only the next native CaptureAttack in this explicit
// queue call. Clearing the label there prevents synchronous on-hit descendants
// from inheriting their parent's emission site when damage delay is zero.
func (b *Bridge) BeginOwnedEmit(siteID string) func() {
	previous := b.pendingOwnedEmitSite
	b.pendingOwnedEmitSite = siteID
	return func() { b.pendingOwnedEmitSite = previous }
}

// IDs are copied only after native execution; allocation timing is unchanged.
func (b *Bridge) FinalizeOwnedGeneratorTriggers() {
	for _, reference := range b.ownedTriggerAttackReferences {
		if reference.attack.SourceHostAttackID <= 0 {
			continue
		}
		id := reference.attack.SourceHostAttackID
		b.OwnedGeneratorTriggers[reference.triggerIndex].QueuedAttacks[reference.queuedIndex].AttackID = &id
	}
}
