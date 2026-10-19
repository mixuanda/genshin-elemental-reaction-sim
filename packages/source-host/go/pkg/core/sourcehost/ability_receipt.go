package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// AbilityInvocation encloses one synchronous native character method call.
// It does not assert that later tasks or entities exhaust that skill's damage.
type AbilityInvocation struct {
	ID                         int                   `json:"id"`
	ActionSequence             int                   `json:"actionSequence"`
	ActorIndex                 int                   `json:"actorIndex"`
	CharacterKey               string                `json:"characterKey"`
	Action                     string                `json:"action"`
	Params                     map[string]int        `json:"params"`
	EntryFacts                 map[string]float64    `json:"entryFacts"`
	Constellation              int                   `json:"constellation"`
	Ascension                  int                   `json:"ascension"`
	StartedFrame               int                   `json:"startedFrame"`
	ReturnedFrame              int                   `json:"returnedFrame"`
	Success                    bool                  `json:"success"`
	AnimationQueuedCallbacks   int                   `json:"animationQueuedCallbacks"`
	HasOnRemoved               bool                  `json:"hasOnRemoved"`
	QueuedAttacks              []AbilityQueuedAttack `json:"queuedAttacks"`
	queuedStart                int
	previousActiveInvocationID int
}

type AbilityQueuedAttack struct {
	QueueID       int    `json:"queueId"`
	AttackID      *int   `json:"attackId,omitempty"`
	Ability       string `json:"ability"`
	AttackTagName string `json:"attackTagName"`
	Frame         int    `json:"frame"`
}

type AttackDispatchCompletion struct {
	DispatchID       int                   `json:"dispatchId"`
	AttackID         int                   `json:"attackId"`
	Frame            int                   `json:"frame"`
	Origin           info.SourceHostOrigin `json:"origin"`
	EnemyTargetKeys  []int                 `json:"enemyTargetKeys"`
	SkippedEnemyKeys []int                 `json:"skippedEnemyKeys"`
	SkipsEnemies     bool                  `json:"skipsEnemies"`
}

type queuedAttackReference struct {
	attack             *info.AttackEvent
	queueID            int
	frame              int
	origin             info.SourceHostOrigin
	actorIndex         int
	ability            string
	attackTagName      string
	producerID         int
	ownedTriggerID     int
	emitSiteID         string
	entityID           int
	entityTriggerID    int
	entityProducerID   int
	entityEmitSiteID   string
	constructEmitterID int
	hitCallbackID      int
	hitEmitSiteID      string
	eventCallID        int
	eventProducerID    int
	eventEmitSiteID    string
	shieldProducerID   int
	shieldHookID       int
	shieldEmitSiteID   string
}

type invocationAttackReference struct {
	invocationIndex int
	queuedIndex     int
	attack          *info.AttackEvent
}

func (b *Bridge) BeginAbilityInvocation(actorIndex int, characterKey, action string, params map[string]int, constellation, ascension int) int {
	copiedParams := make(map[string]int, len(params))
	for key, value := range params {
		copiedParams[key] = value
	}
	origin := b.Origin.Snapshot()
	id := len(b.AbilityInvocations) + 1
	b.AbilityInvocations = append(b.AbilityInvocations, AbilityInvocation{
		ID: id, ActionSequence: origin.CreationActionSequence,
		ActorIndex: actorIndex, CharacterKey: characterKey, Action: action,
		Params: copiedParams, EntryFacts: map[string]float64{},
		Constellation: constellation, Ascension: ascension,
		StartedFrame: *b.Frame, QueuedAttacks: []AbilityQueuedAttack{},
		queuedStart:                len(b.queuedAttackReferences),
		previousActiveInvocationID: b.activeAbilityInvocationID,
	})
	b.activeAbilityInvocationID = id
	return id
}

// RecordAbilityFact captures a value already read by the current native ability.
func (b *Bridge) RecordAbilityFact(siteID string, value float64) {
	id := b.activeAbilityInvocationID
	if id == 0 {
		return
	}
	b.AbilityInvocations[id-1].EntryFacts[siteID] = value
}

func (b *Bridge) RecordAbilityBoolFact(siteID string, value bool) {
	if value {
		b.RecordAbilityFact(siteID, 1)
	} else {
		b.RecordAbilityFact(siteID, 0)
	}
}

func (b *Bridge) EndAbilityInvocation(id int, success bool, queuedCallbacks int, hasOnRemoved bool) {
	row := &b.AbilityInvocations[id-1]
	row.ReturnedFrame = *b.Frame
	row.Success = success
	row.AnimationQueuedCallbacks = queuedCallbacks
	row.HasOnRemoved = hasOnRemoved
	for _, reference := range b.queuedAttackReferences[row.queuedStart:] {
		if reference.producerID != 0 || reference.entityID != 0 || reference.ownedTriggerID != 0 || reference.hitCallbackID != 0 || reference.shieldHookID != 0 || reference.shieldProducerID != 0 ||
			reference.origin.Via != "action" ||
			reference.origin.ParentAttackID != 0 ||
			reference.origin.CreationActionSequence != row.ActionSequence ||
			reference.actorIndex != row.ActorIndex {
			continue
		}
		queuedIndex := len(row.QueuedAttacks)
		row.QueuedAttacks = append(row.QueuedAttacks, AbilityQueuedAttack{
			QueueID: reference.queueID, Ability: reference.ability,
			AttackTagName: reference.attackTagName, Frame: reference.frame,
		})
		b.invocationAttackReferences = append(b.invocationAttackReferences, invocationAttackReference{
			invocationIndex: id - 1, queuedIndex: queuedIndex, attack: reference.attack,
		})
	}
	b.activeAbilityInvocationID = row.previousActiveInvocationID
}

// Queued observations retain each occurrence's identity even when native
// source code reuses the same AttackEvent pointer for several immediate hits.
func (b *Bridge) FinalizeAbilityInvocations() {
	for _, reference := range b.invocationAttackReferences {
		row := &b.AbilityInvocations[reference.invocationIndex].QueuedAttacks[reference.queuedIndex]
		if attackID := b.AttackObservations[row.QueueID-1].AttackID; attackID != nil {
			id := *attackID
			row.AttackID = &id
		}
	}
	for _, reference := range b.producerAttackReferences {
		row := &b.AbilityProducers[reference.producerIndex].QueuedAttacks[reference.queuedIndex]
		if attackID := b.AttackObservations[row.QueueID-1].AttackID; attackID != nil {
			id := *attackID
			row.AttackID = &id
		}
	}
}

func (b *Bridge) CompleteAttackDispatch(attack *info.AttackEvent, checked, dead []int, skipsEnemies bool) {
	b.AttackDispatchCompletions = append(b.AttackDispatchCompletions, AttackDispatchCompletion{
		DispatchID: attack.SourceHostDispatchID, AttackID: attack.SourceHostAttackID,
		Frame: *b.Frame, Origin: b.AttackOrigin(attack), EnemyTargetKeys: checked,
		SkippedEnemyKeys: dead, SkipsEnemies: skipsEnemies,
	})
}
