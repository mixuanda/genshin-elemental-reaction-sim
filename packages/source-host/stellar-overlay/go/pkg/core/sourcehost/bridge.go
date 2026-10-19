// Package sourcehost carries the synchronous, authoritative gidps formula boundary.
// It owns no combat lifecycle, attribute reads, random draws, or resumable state.
package sourcehost

import (
	"encoding/json"
	"fmt"
	"math"

	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/player/shield"
)

const Protocol = "gidps-source-host-v1"
const SourceCommit = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"

type Request struct {
	Origin                       info.SourceHostOrigin                `json:"origin"`
	Protocol                     string                               `json:"protocol"`
	SourceCommit                 string                               `json:"sourceCommit"`
	ID                           int                                  `json:"id"`
	Kind                         string                               `json:"kind"`
	Frame                        int                                  `json:"frame"`
	ActorIndex                   int                                  `json:"actorIndex"`
	ActorKey                     string                               `json:"actorKey"`
	Ability                      string                               `json:"ability"`
	AttackTag                    int                                  `json:"attackTag"`
	AttackTagName                string                               `json:"attackTagName"`
	Element                      string                               `json:"element"`
	SourceFrame                  int                                  `json:"sourceFrame"`
	SnapshotFrame                int                                  `json:"snapshotFrame"`
	AttackID                     int                                  `json:"attackId"`
	TargetKey                    int                                  `json:"targetKey"`
	DamageCategory               string                               `json:"damageCategory"`
	ComponentIDs                 []int                                `json:"componentIds"`
	HPBeforeCalculationID        *int                                 `json:"hpBeforeCalculationId,omitempty"`
	BonusCalculationID           *int                                 `json:"bonusCalculationId,omitempty"`
	AmountCalculationID          *int                                 `json:"amountCalculationId,omitempty"`
	RawCalculationID             *int                                 `json:"rawCalculationId,omitempty"`
	TargetPhase                  *info.SourceHostTargetPhaseMatch     `json:"phase,omitempty"`
	IncomingCalculationID        *int                                 `json:"incomingCalculationId,omitempty"`
	MultiplierCalculationID      *int                                 `json:"multiplierCalculationId,omitempty"`
	TalentTableRead              *info.SourceHostTalentTableRead      `json:"talentTableRead,omitempty"`
	TalentExpressionRead         *info.SourceHostTalentExpressionRead `json:"talentExpressionRead,omitempty"`
	PriorMultiplierCalculationID *int                                 `json:"priorMultiplierCalculationId,omitempty"`
	ComponentApplications        []info.SourceHostComponent           `json:"componentApplications"`
	PriorComponents              *[]FlatPriorComponent                `json:"priorComponents,omitempty"`
	SnapshotStats                *attributes.Stats                    `json:"snapshotStats"`
	Snapshot                     map[string]any                       `json:"snapshot"`
	RawAttack                    info.AttackInfo                      `json:"rawAttack"`
	StatRead                     *info.SourceHostStatRead             `json:"statRead,omitempty"`
	StatReads                    []*info.SourceHostStatRead           `json:"statReads,omitempty"`
	ValueSources                 map[string]int                       `json:"valueSources,omitempty"`
	WeaponState                  map[string]any                       `json:"weaponState,omitempty"`
	ArtifactState                map[string]any                       `json:"artifactState,omitempty"`
	ComponentScope               string                               `json:"componentScope,omitempty"`
	Input                        map[string]any                       `json:"input"`
	ScalarProvenance             *info.SourceHostScalarProvenance     `json:"scalarProvenance,omitempty"`
}

type Calculation struct {
	Request Request `json:"request"`
	Value   float64 `json:"value"`
}

type AttackObservation struct {
	AttackID   *int                  `json:"attackId,omitempty"`
	DispatchID int                   `json:"dispatchId,omitempty"`
	Stage      string                `json:"stage"`
	Frame      int                   `json:"frame"`
	TargetKey  *int                  `json:"targetKey,omitempty"`
	Reason     string                `json:"reason,omitempty"`
	Origin     info.SourceHostOrigin `json:"origin"`
}

// StatusInstance records a real Status object and its observed physical end or
// its live state at the final simulation frame. It does not infer an expiry tick.
type StatusInstance struct {
	ActorIndex             int    `json:"actorIndex"`
	StatusKey              string `json:"statusKey"`
	InstanceID             int    `json:"instanceId"`
	CreatedFrame           int    `json:"createdFrame"`
	CreationActionSequence int    `json:"creationActionSequence,omitempty"`
	InitialExpiryFrame     int    `json:"initialExpiryFrame"`
	FinalExpiryFrame       int    `json:"finalExpiryFrame"`
	EndState               string `json:"endState"`
	EndFrame               int    `json:"endFrame"`
	ReplacedByInstanceID   *int   `json:"replacedByInstanceId,omitempty"`
	NativeOverwrite        bool   `json:"nativeOverwrite"`
}

// PendingAttackStage corresponds to one native core task scheduled for an
// AttackEvent. Multiple tasks may independently reference the same event.
type PendingAttackStage struct {
	ID          int                   `json:"id"`
	Stage       string                `json:"stage"`
	QueuedFrame int                   `json:"queuedFrame"`
	DueFrame    int                   `json:"dueFrame"`
	AttackID    *int                  `json:"attackId,omitempty"`
	Origin      info.SourceHostOrigin `json:"origin"`
}

type pendingAttackStage struct {
	row    PendingAttackStage
	attack *info.AttackEvent
}

type Application struct {
	Origin                   info.SourceHostOrigin                     `json:"origin"`
	ID                       int                                       `json:"id"`
	CalculationID            int                                       `json:"calculationId"`
	ApplicationCalculationID *int                                      `json:"applicationCalculationId,omitempty"`
	TargetPhase              *info.SourceHostTargetPhaseMatch          `json:"targetPhase,omitempty"`
	TargetPhaseEffects       *info.SourceHostTargetPhaseEffectsReceipt `json:"targetPhaseEffects,omitempty"`
	AttackID                 int                                       `json:"attackId"`
	DispatchID               int                                       `json:"dispatchId,omitempty"`
	Frame                    int                                       `json:"frame"`
	TargetKey                int                                       `json:"targetKey"`
	RawDamage                float64                                   `json:"rawDamage"`
	AppliedDamage            float64                                   `json:"appliedDamage"`
	HPBefore                 float64                                   `json:"hpBefore"`
	HPAfter                  float64                                   `json:"hpAfter"`
	IsCrit                   bool                                      `json:"isCrit"`
	DamageMode               bool                                      `json:"damageMode"`
}

// PlayerApplication observes the native shield/Drain path. DrainAttempted is
// the amount returned by Drain, which can differ from actual HP lost.
type PlayerApplication struct {
	ID                   int     `json:"id"`
	CalculationID        int     `json:"calculationId"`
	AttackID             int     `json:"attackId"`
	Frame                int     `json:"frame"`
	TargetKey            int     `json:"targetKey"`
	ActiveActorIndex     int     `json:"activeActorIndex"`
	DamagedActorIndex    *int    `json:"damagedActorIndex,omitempty"`
	RawDamage            float64 `json:"rawDamage"`
	DamageAfterShield    float64 `json:"damageAfterShield"`
	ShieldAbsorbed       float64 `json:"shieldAbsorbed"`
	DrainAttempted       float64 `json:"drainAttempted"`
	IsCrit               bool    `json:"isCrit"`
	ShieldCalculationIDs []int   `json:"shieldCalculationIds"`
	DrainCalculationID   *int    `json:"drainCalculationId"`
}

// DrainApplication records every native Drain, including ability self-drains
// that do not pass through the avatar player-hit path.
type DrainApplication struct {
	ID                  int     `json:"id"`
	CalculationID       int     `json:"calculationId"`
	SourceCalculationID *int    `json:"sourceCalculationId"`
	AttackID            int     `json:"attackId"`
	Frame               int     `json:"frame"`
	ActorIndex          int     `json:"actorIndex"`
	ActorKey            string  `json:"actorKey"`
	Ability             string  `json:"ability"`
	Amount              float64 `json:"amount"`
	HPBefore            float64 `json:"hpBefore"`
	MaxHP               float64 `json:"maxHp"`
	ResultRatio         float64 `json:"resultRatio"`
}

type EnergyApplication struct {
	ID                  int     `json:"id"`
	CalculationID       int     `json:"calculationId"`
	Frame               int     `json:"frame"`
	ActorIndex          int     `json:"actorIndex"`
	ActorKey            string  `json:"actorKey"`
	Source              string  `json:"source"`
	Operation           string  `json:"operation"`
	EnergyBefore        float64 `json:"energyBefore"`
	EnergyAfter         float64 `json:"energyAfter"`
	RequestedAmount     float64 `json:"requestedAmount"`
	EnergyMax           float64 `json:"energyMax"`
	AmountCalculationID *int    `json:"amountCalculationId,omitempty"`
}

type HealingApplication struct {
	ID                    int     `json:"id"`
	Frame                 int     `json:"frame"`
	ActorIndex            int     `json:"actorIndex"`
	ActorKey              string  `json:"actorKey"`
	Source                string  `json:"source"`
	CallerIndex           int     `json:"callerIndex"`
	TargetIndex           int     `json:"targetIndex"`
	BaseCalculationID     int     `json:"baseCalculationId"`
	BonusCalculationID    int     `json:"bonusCalculationId"`
	AmountCalculationID   int     `json:"amountCalculationId"`
	ReceiveCalculationID  *int    `json:"receiveCalculationId,omitempty"`
	OverhealCalculationID int     `json:"overhealCalculationId"`
	PreviousHP            float64 `json:"previousHp"`
	PreviousHPDebt        float64 `json:"previousHpDebt"`
	CurrentHP             float64 `json:"currentHp"`
	CurrentHPDebt         float64 `json:"currentHpDebt"`
	FinalAmount           float64 `json:"finalAmount"`
	ReceivedAmount        float64 `json:"receivedAmount"`
	Overheal              float64 `json:"overheal"`
}

type healingContext struct{ amountID, receiveID int }

type playerSteps struct {
	shieldIDs []int
	drainID   *int
}

type Bridge struct {
	Origin            *info.SourceHostOriginTracker
	TaskTracker       *info.SourceHostTaskTracker
	PhaseConfig       *PhaseConfig
	PhaseObservations []PhaseObservation
	PhaseCapture      func(PhaseInput)
	TargetPhases      *TargetPhaseConfig
	Frame             *int
	// StrictActions changes only the local source-host queue policy. Native
	// ReadyCheck and all source formulas still run unchanged.
	StrictActions                bool
	StopAtDuration               bool
	EndReason                    string
	ActionSequence               int
	ActorKeys                    map[int]string
	ResolveJSON                  func(string) string
	Calculations                 []Calculation
	Applications                 []Application
	AttackObservations           []AttackObservation
	AbilityInvocations           []AbilityInvocation
	AbilityProducers             []AbilityProducer
	OwnedGenerators              []OwnedGenerator
	OwnedGeneratorTriggers       []OwnedGeneratorTrigger
	OwnedEntities                []OwnedEntity
	OwnedEntityTriggers          []OwnedEntityTrigger
	OwnedEntityProducers         []OwnedEntityProducer
	HitCallbackBatches           []HitCallbackBatch
	HitCallbacks                 []HitCallback
	EventRegistrations           []EventRegistration
	EventEmissions               []EventEmission
	EventListenerCalls           []EventListenerCall
	ShieldInstances              []ShieldInstance
	ShieldHooks                  []ShieldHook
	ShieldProducers              []ShieldProducer
	activeShieldProducerID       int
	shieldInstanceByObject       map[shield.Shield]int
	pendingShieldBirthSite       string
	pendingShieldEmitSite        string
	activeShieldHookID           int
	shieldAttackReferences       []shieldAttackReference
	EventProducers               []EventProducer
	activeEventEmissionID        int
	activeEventCallID            int
	activeEventProducerID        int
	pendingEventEmitSite         string
	eventAttackReferences        []eventAttackReference
	activeHitCallbackID          int
	activeHitCallbackAttack      *info.AttackEvent
	activeHitCallbackTargetKey   int
	pendingHitEmitSite           string
	hitCallbackAttackReferences  []hitCallbackAttackReference
	activeAbilityInvocationID    int
	activeProducerID             int
	activeOwnedTriggerID         int
	pendingOwnedEmitSite         string
	producerAttackReferences     []producerAttackReference
	ownedTriggerAttackReferences []ownedTriggerAttackReference
	ownedGeneratorByStatus       map[int]int
	activeOwnedEntityID          int
	activeOwnedEntityTriggerID   int
	activeOwnedEntityProducerID  int
	pendingOwnedEntityEmitSite   string
	constructEntityByObject      map[any]int
	pendingConstructObject       any
	pendingConstructSite         string
	pendingConstructActor        int
	pendingConstructEmitterID    int
	ownedEntityByTargetKey       map[int]int
	ownedEntityTerminationReason map[int]string
	ownedEntityAttackReferences  []ownedEntityAttackReference
	AttackDispatchCompletions    []AttackDispatchCompletion
	queuedAttackReferences       []queuedAttackReference
	invocationAttackReferences   []invocationAttackReference
	StatusInstances              []StatusInstance
	PendingAttackStages          []PendingAttackStage
	statusInstanceRows           map[int]int
	pendingAttackTasks           map[int]pendingAttackStage
	pendingAttackSequence        int
	PlayerApplications           []PlayerApplication
	DrainApplications            []DrainApplication
	EnergyApplications           []EnergyApplication
	HealingApplications          []HealingApplication
	healingContexts              []healingContext
	cooldownContexts             []int
	sequence                     int
	attackSequence               int
	dispatchSequence             int
	statusSequence               int
	scalarSequence               int
	CurrentPlayerAttackID        int
	playerSteps                  map[int]*playerSteps
	playerIncomingByAttack       map[int]int
	lastShieldTakenID            int
	activeFormulaSteps           []any
	activeStatReadByStep         map[*info.SourceHostStatStep]*info.SourceHostStatRead
	activeScalarReadByStep       map[*info.SourceHostScalarStep]*info.SourceHostScalarRead
	shieldBonusRead              *info.SourceHostScalarRead
	shieldBonusStack             []*info.SourceHostScalarRead
}

// BeginCooldownContext links native queue arithmetic to the source event that
// selected it. Callers bracket only the original synchronous dispatch.
func (b *Bridge) BeginCooldownContext(id int) {
	b.cooldownContexts = append(b.cooldownContexts, id)
}

func (b *Bridge) EndCooldownContext() {
	if len(b.cooldownContexts) == 0 {
		panic("source-host cooldown context stack is empty")
	}
	b.cooldownContexts = b.cooldownContexts[:len(b.cooldownContexts)-1]
}

func (b *Bridge) cooldownComponents() []int {
	if len(b.cooldownContexts) == 0 {
		return []int{}
	}
	return []int{b.cooldownContexts[len(b.cooldownContexts)-1]}
}

func New(frame *int, resolver func(string) string) *Bridge {
	origin := &info.SourceHostOriginTracker{}
	return &Bridge{Origin: origin, TaskTracker: info.NewSourceHostTaskTracker(frame, origin), Frame: frame, ActorKeys: make(map[int]string), ResolveJSON: resolver,
		Calculations: []Calculation{}, Applications: []Application{}, AttackObservations: []AttackObservation{}, AbilityInvocations: []AbilityInvocation{}, AbilityProducers: []AbilityProducer{}, OwnedGenerators: []OwnedGenerator{}, OwnedGeneratorTriggers: []OwnedGeneratorTrigger{}, OwnedEntities: []OwnedEntity{}, OwnedEntityTriggers: []OwnedEntityTrigger{}, OwnedEntityProducers: []OwnedEntityProducer{}, HitCallbackBatches: []HitCallbackBatch{}, HitCallbacks: []HitCallback{}, EventRegistrations: []EventRegistration{}, EventEmissions: []EventEmission{}, EventListenerCalls: []EventListenerCall{}, EventProducers: []EventProducer{}, ShieldInstances: []ShieldInstance{}, ShieldHooks: []ShieldHook{}, ShieldProducers: []ShieldProducer{}, shieldInstanceByObject: make(map[shield.Shield]int), ownedGeneratorByStatus: make(map[int]int), ownedEntityByTargetKey: make(map[int]int), ownedEntityTerminationReason: make(map[int]string), AttackDispatchCompletions: []AttackDispatchCompletion{}, StatusInstances: []StatusInstance{}, PendingAttackStages: []PendingAttackStage{}, statusInstanceRows: make(map[int]int), pendingAttackTasks: make(map[int]pendingAttackStage), PlayerApplications: []PlayerApplication{}, DrainApplications: []DrainApplication{}, EnergyApplications: []EnergyApplication{}, HealingApplications: []HealingApplication{}, playerSteps: make(map[int]*playerSteps), playerIncomingByAttack: make(map[int]int), activeStatReadByStep: make(map[*info.SourceHostStatStep]*info.SourceHostStatRead), activeScalarReadByStep: make(map[*info.SourceHostScalarStep]*info.SourceHostScalarRead)}
}

func (b *Bridge) NextAttackID() int         { b.attackSequence++; return b.attackSequence }
func (b *Bridge) NextStatusInstanceID() int { b.statusSequence++; return b.statusSequence }

func (b *Bridge) Request(kind string, atk info.AttackInfo) Request {
	return Request{Origin: b.Origin.Snapshot(), Protocol: Protocol, SourceCommit: SourceCommit, Kind: kind, Frame: *b.Frame,
		ActorIndex: atk.ActorIndex, ActorKey: b.ActorKeys[atk.ActorIndex], Ability: atk.Abil,
		AttackTag: int(atk.AttackTag), AttackTagName: AttackTagName(atk.AttackTag), Element: atk.Element.String(),
		SourceFrame: *b.Frame, SnapshotFrame: *b.Frame, RawAttack: atk, TalentTableRead: atk.SourceHostTalentTableRead,
		TalentExpressionRead: atk.SourceHostTalentExpressionRead,
		DamageCategory:       "ordinary", ComponentIDs: []int{}, ComponentApplications: []info.SourceHostComponent{}}
}

func allowsNegativeArtifactScalar(request Request) bool {
	if request.Kind != "artifact-scalar" {
		return false
	}
	switch request.Input["ruleId"] {
	case "deepwood-4pc-res", "viridescent-4pc-res-cryo", "viridescent-4pc-res-electro", "viridescent-4pc-res-hydro", "viridescent-4pc-res-pyro":
		return true
	}
	return false
}

// Resolve records exactly the values sent to TS and uses its response. No native
// numerical fallback is permitted when a resolver is installed.
func (b *Bridge) Resolve(request Request) (float64, int) {
	b.sequence++
	request.ID = b.sequence
	encoded, err := json.Marshal(request)
	if err != nil {
		panic(fmt.Errorf("source-host request: %w", err))
	}
	var response struct {
		Protocol string   `json:"protocol"`
		ID       int      `json:"id"`
		Value    *float64 `json:"value"`
		Error    string   `json:"error"`
	}
	if err := json.Unmarshal([]byte(b.ResolveJSON(string(encoded))), &response); err != nil {
		panic(fmt.Errorf("source-host response: %w", err))
	}
	if response.Error != "" {
		panic("source-host formula rejected: " + response.Error)
	}
	allowNegative := allowsNegativeArtifactScalar(request) || request.Kind == "character-flat" || request.Kind == "character-additive" || request.Kind == "character-modifier" || request.Kind == "character-scalar" || request.Kind == "character-cooldown" || request.Kind == "character-healing" &&
		(request.Input["operation"] == "base" || request.Input["operation"] == "bonus" || request.Input["operation"] == "amount") ||
		request.Kind == "character-energy" && (request.Input["operation"] == "particle-amount" || request.Input["operation"] == "particle-apply")
	if response.Protocol != Protocol || response.ID != request.ID || response.Value == nil || math.IsNaN(*response.Value) || math.IsInf(*response.Value, 0) || (*response.Value < 0 && !allowNegative) {
		panic("source-host resolver returned an invalid authoritative result")
	}
	var frozen Request
	if err := json.Unmarshal(encoded, &frozen); err != nil {
		panic(err)
	}
	b.Calculations = append(b.Calculations, Calculation{Request: frozen, Value: *response.Value})
	if request.AttackID != 0 && (request.Kind == "player-incoming" || request.Kind == "player-manual-incoming") {
		b.playerIncomingByAttack[request.AttackID] = request.ID
	}
	if (request.Kind == "artifact-scalar" || request.Kind == "character-modifier" && request.Input["phase"] != "creation" || request.Kind == "character-scalar" && request.Input["phase"] == "read") && len(b.activeFormulaSteps) > 0 {
		switch step := b.activeFormulaSteps[len(b.activeFormulaSteps)-1].(type) {
		case *info.SourceHostStatStep:
			step.FormulaCalculationIDs = append(step.FormulaCalculationIDs, request.ID)
		case *info.SourceHostScalarStep:
			step.FormulaCalculationIDs = append(step.FormulaCalculationIDs, request.ID)
		}
	}
	if request.AttackID != 0 && (request.Kind == "player-shield" || request.Kind == "player-shield-min" || request.Kind == "player-drain") {
		steps := b.playerSteps[request.AttackID]
		if steps == nil {
			steps = &playerSteps{}
			b.playerSteps[request.AttackID] = steps
		}
		if request.Kind == "player-shield" || request.Kind == "player-shield-min" {
			steps.shieldIDs = append(steps.shieldIDs, request.ID)
		} else {
			id := request.ID
			steps.drainID = &id
		}
	}
	return *response.Value, request.ID
}

// ShieldDamage delegates the pinned Tmpl.OnDamage arithmetic. The handler has
// already read ShieldBonus once and still owns break/removal event order.
func (b *Bridge) ShieldDamage(t *shield.Tmpl, damage float64, incoming attributes.Element, bonus float64) (float64, float64) {
	request := b.Request("player-shield", info.AttackInfo{})
	request.ActorIndex, request.ActorKey = t.ActorIndex, b.ActorKeys[t.ActorIndex]
	request.Ability, request.AttackID, request.TargetKey = t.Name, b.CurrentPlayerAttackID, t.Target
	request.Element, request.DamageCategory = incoming.String(), "player-shield"
	if t.SourceHostBonusID == 0 {
		request.ScalarProvenance = ScalarProvenance(b.shieldBonusRead)
	}
	request.Input = map[string]any{"hpBefore": t.HP, "incomingDamage": damage,
		"shieldElement": t.Ele.String(), "incomingElement": incoming.String(), "bonus": bonus,
		"shieldType": int(t.ShieldType), "output": "hpAfter"}
	if t.SourceHostHPID > 0 {
		id := t.SourceHostHPID
		request.HPBeforeCalculationID = &id
		request.ComponentIDs = append(request.ComponentIDs, id)
	}
	if t.SourceHostBonusID > 0 {
		id := t.SourceHostBonusID
		request.BonusCalculationID = &id
		request.ComponentIDs = append(request.ComponentIDs, id)
	}
	if id := b.playerIncomingByAttack[b.CurrentPlayerAttackID]; id > 0 {
		request.IncomingCalculationID = &id
		request.ComponentIDs = append(request.ComponentIDs, id)
	}
	hpAfter, hpID := b.Resolve(request)
	t.SourceHostHPID = hpID
	request.Input["output"] = "damageAfter"
	request.HPBeforeCalculationID = nil
	request.BonusCalculationID = nil
	request.ComponentIDs = []int{hpID}
	taken, takenID := b.Resolve(request)
	b.lastShieldTakenID = takenID
	return hpAfter, taken
}

// ShieldMinimum supplies the handler's actual running minimum after each
// shield's OnDamage callback and log, preserving the source event order.
func (b *Bridge) ShieldMinimum(current, taken float64) float64 {
	request := b.Request("player-shield-min", info.AttackInfo{})
	request.AttackID, request.DamageCategory = b.CurrentPlayerAttackID, "player-shield-min"
	request.ComponentIDs = []int{b.lastShieldTakenID}
	request.Input = map[string]any{"currentMinimum": current, "damageAfter": taken}
	minimum, _ := b.Resolve(request)
	return minimum
}

// PlayerDrain returns the actual ratio assigned to the source character.
// The caller supplies exactly the reads ModifyHPByAmount would have made.
func (b *Bridge) PlayerDrain(di *info.DrainInfo, hpBefore, maxHP float64) float64 {
	request := b.Request("player-drain", info.AttackInfo{})
	request.ActorIndex, request.ActorKey = di.ActorIndex, b.ActorKeys[di.ActorIndex]
	request.Ability, request.AttackID, request.DamageCategory = di.Abil, b.CurrentPlayerAttackID, "player-drain"
	request.Input = map[string]any{"hpBefore": hpBefore, "maxHp": maxHP, "amount": di.Amount}
	if di.SourceHostAmountID > 0 {
		id := di.SourceHostAmountID
		request.AmountCalculationID = &id
		request.ComponentIDs = []int{id}
	}
	ratio, calculationID := b.Resolve(request)
	b.sequence++
	b.DrainApplications = append(b.DrainApplications, DrainApplication{
		ID: b.sequence, CalculationID: calculationID, SourceCalculationID: request.AmountCalculationID,
		AttackID: request.AttackID, Frame: *b.Frame, ActorIndex: di.ActorIndex,
		ActorKey: request.ActorKey, Ability: di.Abil, Amount: di.Amount,
		HPBefore: hpBefore, MaxHP: maxHP, ResultRatio: ratio,
	})
	return ratio
}

func (b *Bridge) Applied(atk *info.AttackEvent, target info.TargetKey, raw, actual, before, after float64, critical bool, damageMode bool) {
	var applicationCalculationID *int
	if atk.SourceHostApplicationCalculationID > 0 {
		applicationCalculationID = &atk.SourceHostApplicationCalculationID
	}
	b.sequence++
	b.Applications = append(b.Applications, Application{ID: b.sequence, Origin: b.AttackOrigin(atk),
		CalculationID: atk.SourceHostCalculationID, AttackID: atk.SourceHostAttackID, DispatchID: atk.SourceHostDispatchID,
		ApplicationCalculationID: applicationCalculationID, TargetPhase: atk.SourceHostTargetPhase,
		TargetPhaseEffects: atk.SourceHostTargetPhaseEffects,
		Frame:              *b.Frame, TargetKey: int(target), RawDamage: raw, AppliedDamage: actual,
		HPBefore: before, HPAfter: after, IsCrit: critical, DamageMode: damageMode})
}

func (b *Bridge) PlayerApplied(atk *info.AttackEvent, target info.TargetKey, activeActor int, raw, afterShield, drainAttempted float64, critical bool) {
	delete(b.playerIncomingByAttack, atk.SourceHostAttackID)
	b.sequence++
	steps := b.playerSteps[atk.SourceHostAttackID]
	shieldIDs := []int{}
	var drainID *int
	if steps != nil {
		shieldIDs = append(shieldIDs, steps.shieldIDs...)
		drainID = steps.drainID
		delete(b.playerSteps, atk.SourceHostAttackID)
	}
	b.PlayerApplications = append(b.PlayerApplications, PlayerApplication{
		ID: b.sequence, CalculationID: atk.SourceHostCalculationID, AttackID: atk.SourceHostAttackID,
		Frame: *b.Frame, TargetKey: int(target), ActiveActorIndex: activeActor,
		RawDamage: raw, DamageAfterShield: afterShield, ShieldAbsorbed: raw - afterShield,
		DrainAttempted: drainAttempted, IsCrit: critical, ShieldCalculationIDs: shieldIDs, DrainCalculationID: drainID,
	})
}

func SnapshotFields(s info.Snapshot) map[string]any {
	a := s.Stats
	return map[string]any{"charLevel": s.CharLvl,
		"baseAtk": a[attributes.BaseATK], "atkPct": a[attributes.ATKP], "flatAtk": a[attributes.ATK],
		"baseDef": a[attributes.BaseDEF], "defPct": a[attributes.DEFP], "flatDef": a[attributes.DEF],
		"baseHp": a[attributes.BaseHP], "hpPct": a[attributes.HPP], "flatHp": a[attributes.HP],
		"em": a[attributes.EM], "critRate": a[attributes.CR], "critDamage": a[attributes.CD],
		"statProvenance": StatProvenanceFields(s)}
}
