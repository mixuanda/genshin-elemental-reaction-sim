package info

// SourceHostStatusOwner identifies the exact Status instance that authorized a
// persistent-effect trigger. Refreshing the status creates a distinct instance.
type SourceHostStatusOwner struct {
	ActorIndex             int    `json:"actorIndex"`
	StatusKey              string `json:"statusKey"`
	InstanceID             int    `json:"instanceId"`
	CreatedFrame           int    `json:"createdFrame"`
	CreationActionSequence int    `json:"creationActionSequence,omitempty"`
}

// SourceHostOrigin is explicit native execution lineage. Zero IDs mean unknown.
type SourceHostOrigin struct {
	StatusOwner            *SourceHostStatusOwner `json:"statusOwner,omitempty"`
	CreationActionSequence int                    `json:"creationActionSequence,omitempty"`
	TriggerActionSequence  int                    `json:"triggerActionSequence,omitempty"`
	ParentAttackID         int                    `json:"parentAttackId,omitempty"`
	Via                    string                 `json:"via"`
	EventKey               string                 `json:"eventKey,omitempty"`
	EventType              *int                   `json:"eventType,omitempty"`
}

// SourceHostOriginTracker belongs to one simulation; no global state is shared.
type SourceHostOriginTracker struct {
	Current        SourceHostOrigin
	ActiveAttackID int
}

func (t *SourceHostOriginTracker) Snapshot() SourceHostOrigin {
	if t.Current.Via == "" {
		return SourceHostOrigin{Via: "unassigned"}
	}
	return t.Current
}

func (t *SourceHostOriginTracker) CaptureForChild() SourceHostOrigin {
	origin := t.Snapshot()
	if t.ActiveAttackID > 0 {
		origin.ParentAttackID = t.ActiveAttackID
	}
	return origin
}

func (t *SourceHostOriginTracker) enter(origin SourceHostOrigin, attackID int) func() {
	previous, previousAttack := t.Current, t.ActiveAttackID
	t.Current, t.ActiveAttackID = origin, attackID
	return func() { t.Current, t.ActiveAttackID = previous, previousAttack }
}

func (t *SourceHostOriginTracker) BeginAction(sequence int) func() {
	return t.enter(SourceHostOrigin{CreationActionSequence: sequence, TriggerActionSequence: sequence, Via: "action"}, 0)
}

func (t *SourceHostOriginTracker) BeginTask(saved SourceHostOrigin) func() {
	saved.Via = "task"
	return t.enter(saved, 0)
}

func (t *SourceHostOriginTracker) BeginEvent(saved SourceHostOrigin, key string, kind int, args ...any) func() {
	current := t.Snapshot()
	origin := saved
	// Effect ownership follows the triggering context, never a stale hook registration.
	origin.StatusOwner = current.StatusOwner
	origin.TriggerActionSequence = current.TriggerActionSequence
	origin.Via = "event-callback"
	origin.EventKey = key
	origin.EventType = &kind
	origin.ParentAttackID = t.ActiveAttackID
	for _, arg := range args {
		if attack, ok := arg.(*AttackEvent); ok && attack.SourceHostAttackID > 0 {
			origin.ParentAttackID = attack.SourceHostAttackID
			break
		}
	}
	return t.enter(origin, origin.ParentAttackID)
}

// BeginStatusOwner changes only the explicitly observed effect owner. Callback
// ancestry, trigger action, and attack parent remain those of the current call.
func (t *SourceHostOriginTracker) BeginStatusOwner(owner *SourceHostStatusOwner) func() {
	origin := t.Snapshot()
	origin.StatusOwner = owner
	return t.enter(origin, t.ActiveAttackID)
}

func (t *SourceHostOriginTracker) BeginAttack(saved *SourceHostOrigin, attackID int) func() {
	origin := SourceHostOrigin{Via: "unassigned"}
	if saved != nil {
		origin = *saved
	}
	return t.enter(origin, attackID)
}
