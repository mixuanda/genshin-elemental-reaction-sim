package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// HitCallbackBatch identifies the native end-of-frame damage/callback task for
// one enemy target. ApplyAttack may return before this task has run.
type HitCallbackBatch struct {
	ID                int    `json:"id"`
	ParentQueueID     *int   `json:"parentQueueId,omitempty"`
	ParentAttackID    int    `json:"parentAttackId"`
	ParentDispatchID  int    `json:"parentDispatchId"`
	TargetKey         int    `json:"targetKey"`
	QueuedFrame       int    `json:"queuedFrame"`
	RunFrame          *int   `json:"runFrame,omitempty"`
	CompletedFrame    *int   `json:"completedFrame,omitempty"`
	State             string `json:"state"`
	CallbackCount     int    `json:"callbackCount"`
	CallbackIDs       []int  `json:"callbackIds"`
	HitConfirmBlocked bool   `json:"hitConfirmBlocked"`
}

type HitCallbackQueuedAttack struct {
	QueueID       int    `json:"queueId"`
	AttackID      *int   `json:"attackId,omitempty"`
	Ability       string `json:"ability"`
	AttackTagName string `json:"attackTagName"`
	Frame         int    `json:"frame"`
	EmitSiteID    string `json:"emitSiteId"`
}

type HitCallback struct {
	ID             int                       `json:"id"`
	BatchID        int                       `json:"batchId"`
	CallbackIndex  int                       `json:"callbackIndex"`
	SiteID         string                    `json:"siteId,omitempty"`
	StartedFrame   int                       `json:"startedFrame"`
	CompletedFrame int                       `json:"completedFrame"`
	QueuedAttacks  []HitCallbackQueuedAttack `json:"queuedAttacks"`
	EntryFacts     map[string]float64        `json:"entryFacts,omitempty"`
	queuedStart    int
}

type hitCallbackAttackReference struct {
	callbackIndex int
	queuedIndex   int
	attack        *info.AttackEvent
}

func (b *Bridge) RegisterHitCallbackBatch(atk *info.AttackEvent, targetKey int, blocked bool) int {
	id := len(b.HitCallbackBatches) + 1
	var queueID *int
	if atk.SourceHostQueuedObservationIndex > 0 {
		value := atk.SourceHostQueuedObservationIndex
		queueID = &value
	}
	b.HitCallbackBatches = append(b.HitCallbackBatches, HitCallbackBatch{
		ID: id, ParentQueueID: queueID, ParentAttackID: atk.SourceHostAttackID,
		ParentDispatchID: atk.SourceHostDispatchID, TargetKey: targetKey,
		QueuedFrame: *b.Frame, State: "pending", CallbackCount: len(atk.Callbacks),
		CallbackIDs: []int{}, HitConfirmBlocked: blocked,
	})
	return id
}

func (b *Bridge) BeginHitCallbackBatchRun(id int) {
	frame := *b.Frame
	b.HitCallbackBatches[id-1].RunFrame = &frame
}

func (b *Bridge) CompleteHitCallbackBatch(id int, blocked bool) {
	frame := *b.Frame
	row := &b.HitCallbackBatches[id-1]
	row.CompletedFrame = &frame
	row.State = "completed"
	if blocked {
		row.State = "blocked"
	}
}

// The callback slot is the actual index in the native callback slice after
// nil callbacks were filtered at attack construction.
func (b *Bridge) BeginHitCallback(id, callbackIndex int, atk *info.AttackEvent, targetKey int) func() {
	callbackID := len(b.HitCallbacks) + 1
	b.HitCallbackBatches[id-1].CallbackIDs = append(b.HitCallbackBatches[id-1].CallbackIDs, callbackID)
	previousID, previousAttack, previousTarget := b.activeHitCallbackID, b.activeHitCallbackAttack, b.activeHitCallbackTargetKey
	b.activeHitCallbackID, b.activeHitCallbackAttack, b.activeHitCallbackTargetKey = callbackID, atk, targetKey
	b.HitCallbacks = append(b.HitCallbacks, HitCallback{
		ID: callbackID, BatchID: id, CallbackIndex: callbackIndex,
		StartedFrame: *b.Frame, QueuedAttacks: []HitCallbackQueuedAttack{},
		queuedStart: len(b.queuedAttackReferences),
	})
	return func() {
		row := &b.HitCallbacks[callbackID-1]
		row.CompletedFrame = *b.Frame
		for _, reference := range b.queuedAttackReferences[row.queuedStart:] {
			if reference.hitCallbackID != callbackID || reference.hitEmitSiteID == "" {
				continue
			}
			queuedIndex := len(row.QueuedAttacks)
			row.QueuedAttacks = append(row.QueuedAttacks, HitCallbackQueuedAttack{
				QueueID: reference.queueID, Ability: reference.ability,
				AttackTagName: reference.attackTagName, Frame: reference.frame,
				EmitSiteID: reference.hitEmitSiteID,
			})
			b.hitCallbackAttackReferences = append(b.hitCallbackAttackReferences, hitCallbackAttackReference{
				callbackIndex: callbackID - 1, queuedIndex: queuedIndex, attack: reference.attack,
			})
		}
		b.activeHitCallbackID, b.activeHitCallbackAttack, b.activeHitCallbackTargetKey = previousID, previousAttack, previousTarget
	}
}

// Audited callback bodies label the already executing native slot. This does
// not wrap or replace the callback function and does not change origin.
func (b *Bridge) LabelActiveHitCallback(siteID string, callback info.AttackCB) {
	id := b.activeHitCallbackID
	if id == 0 || callback.AttackEvent != b.activeHitCallbackAttack ||
		int(callback.Target.Key()) != b.activeHitCallbackTargetKey {
		return
	}
	b.HitCallbacks[id-1].SiteID = siteID
}

func (b *Bridge) RecordActiveHitCallbackFact(key string, value float64) {
	if b.activeHitCallbackID == 0 {
		return
	}
	row := &b.HitCallbacks[b.activeHitCallbackID-1]
	if row.EntryFacts == nil {
		row.EntryFacts = make(map[string]float64)
	}
	row.EntryFacts[key] = value
}

func (b *Bridge) BeginHitEmit(siteID string) func() {
	previous := b.pendingHitEmitSite
	b.pendingHitEmitSite = siteID
	return func() { b.pendingHitEmitSite = previous }
}

func (b *Bridge) FinalizeHitCallbackAttacks() {
	for _, reference := range b.hitCallbackAttackReferences {
		if reference.attack.SourceHostAttackID <= 0 {
			continue
		}
		id := reference.attack.SourceHostAttackID
		b.HitCallbacks[reference.callbackIndex].QueuedAttacks[reference.queuedIndex].AttackID = &id
	}
}
