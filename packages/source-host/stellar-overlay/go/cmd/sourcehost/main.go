//go:build js && wasm

// This executable uses gcsim only as a mechanics host. Every supported outgoing
// damage calculation obtains its authoritative result from synchronous JS.
package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"syscall/js"

	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/event"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/phase"
	"github.com/genshinsim/gcsim/pkg/core/player/shield"
	"github.com/genshinsim/gcsim/pkg/core/sourcehost"
	"github.com/genshinsim/gcsim/pkg/gcs/ast"
	"github.com/genshinsim/gcsim/pkg/gcs/eval"
	"github.com/genshinsim/gcsim/pkg/simulation"
	"github.com/genshinsim/gcsim/pkg/simulator"
)

func encode(value any) string {
	data, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return string(data)
}

func run(_ js.Value, args []js.Value) (out any) {
	executionMode := "auto-wait"
	var initialEnergy *initialEnergyOverride
	var startupState *startupEnergyState
	var phaseConfig *sourcehost.PhaseConfig
	var phaseBridge *sourcehost.Bridge
	var randomness *sourceHostRandomnessReceipt
	respond := func(response map[string]any) string {
		if randomness != nil {
			response["randomness"] = randomness
		}
		if phaseConfig != nil && phaseBridge != nil {
			response["phaseObservation"] = phaseConfig
			response["phaseObservations"] = phaseBridge.PhaseObservations
		}
		return encode(addInitialEnergyResponse(response, initialEnergy, startupState))
	}
	defer func() {
		if err := recover(); err != nil {
			out = respond(map[string]any{"protocol": sourcehost.Protocol, "executionMode": executionMode, "error": fmt.Sprint(err)})
		}
	}()
	if len(args) != 2 || args[1].Type() != js.TypeFunction {
		panic("source-host requires request JSON and a synchronous resolver")
	}
	var request struct {
		PhaseObservation   *sourcehost.PhaseConfig       `json:"phaseObservation"`
		Protocol           string                        `json:"protocol"`
		Config             string                        `json:"config"`
		Seed               string                        `json:"seed"`
		ExecutionMode      string                        `json:"executionMode"`
		StopAtDuration     bool                          `json:"stopAtDuration"`
		PrimaryTargetIndex *int                          `json:"primaryTargetIndex"`
		TargetPhases       *sourcehost.TargetPhaseConfig `json:"targetPhases"`
		InitialEnergy      *initialEnergyOverride        `json:"initialEnergy"`
	}
	if err := json.Unmarshal([]byte(args[0].String()), &request); err != nil {
		panic(err)
	}
	initialEnergy = request.InitialEnergy
	phaseConfig = request.PhaseObservation
	if err := validatePhaseConfig(phaseConfig); err != nil {
		panic(err)
	}
	if request.Protocol != sourcehost.Protocol {
		panic("unsupported source-host protocol")
	}
	if request.ExecutionMode != "" {
		executionMode = request.ExecutionMode
	}
	if executionMode != "auto-wait" && executionMode != "strict" {
		panic("unsupported source-host executionMode: " + executionMode)
	}
	seed, err := strconv.ParseUint(request.Seed, 10, 64)
	if err != nil {
		panic("source-host seed must be a uint64 decimal string")
	}
	randomness = makeSourceHostRandomnessReceipt(request.Seed, seed)
	file := ast.NewFile()
	config, program, err := simulator.Parse(file, request.Config)
	if err != nil {
		panic(err)
	}
	if len(config.Errors) > 0 {
		panic(fmt.Sprint(config.Errors))
	}
	primaryTargetIndex := 0
	if request.PrimaryTargetIndex != nil {
		primaryTargetIndex = *request.PrimaryTargetIndex
	}
	if primaryTargetIndex < 0 || primaryTargetIndex >= len(config.Targets) {
		panic("primaryTargetIndex must identify a declared target")
	}
	if err := validateTargetPhases(request.TargetPhases, len(config.Targets)); err != nil {
		panic(err)
	}
	if request.StopAtDuration {
		durationFrames := config.Settings.Duration * 60
		if math.IsNaN(durationFrames) || math.IsInf(durationFrames, 0) || durationFrames < 1 || int(durationFrames) < 1 {
			panic("stopAtDuration requires a positive duration of at least one frame")
		}
	}
	if err := applyInitialEnergy(config, initialEnergy); err != nil {
		panic(err)
	}
	c, err := simulation.NewCore(int64(seed), true, config)
	if err != nil {
		panic(err)
	}
	bridge := sourcehost.New(&c.F, func(input string) string { return args[1].Invoke(input).String() })
	// Local execution policy only: formulas and the native readiness check remain authoritative.
	bridge.StrictActions = executionMode == "strict"
	bridge.StopAtDuration = request.StopAtDuration
	bridge.PhaseConfig = phaseConfig
	phaseBridge = bridge
	c.SourceHost = bridge
	c.Events.Origin = bridge.Origin
	c.Events.SourceHostObserver = bridge
	c.Tasks.Origin = bridge.Origin
	c.Tasks.SourceHostTrackTasks(bridge.TaskTracker, "core")
	c.Player.AnimationHandler.SourceHostOrigin = bridge.Origin
	c.Combat.SourceHost = bridge
	c.Constructs.SourceHostObserver = bridge
	c.Player.Shields.SourceHostDamage = func(t *shield.Tmpl, damage float64, incoming attributes.Element, bonus float64) (float64, float64) {
		return bridge.ShieldDamage(t, damage, incoming, bonus)
	}
	c.Player.Shields.SourceHostDamagePhase = phase.Descriptor{
		Source: "cmd/sourcehost/main.go:shared-player-shield-resolver",
		Observe: func() (map[string]any, []string) {
			// The resolver consumes the live shield quantities and call arguments.
			// Calculation IDs link checked prior values; they do not alter arithmetic.
			return map[string]any{"formula": "player-shield", "liveState": "player.shields"}, nil
		},
	}
	c.Player.Shields.SourceHostLifecycle = bridge
	c.Player.Shields.SourceHostMinimum = bridge.ShieldMinimum
	c.Player.Shields.SourceHostBonus = bridge.ShieldBonusCallbacks()
	// Lunar-Bloom activation is a resource/core event, never a damage instance.
	// Observe the real source event without an additional attribute/modifier read.
	c.Events.SubscribeWithPhase(event.OnLunarBloom, func(args ...any) {
		bridge.LunarBloomEvent(args[1].(*info.AttackEvent), args[0].(info.Target).Key())
	}, "gidps-source-host-lunar-bloom-event", phase.Descriptor{Source: "cmd/sourcehost/main.go:OnLunarBloom-receipt", Observational: true})
	c.Events.SubscribeWithPhase(event.OnStellarConduct, func(args ...any) {
		bridge.StellarConductEvent(args[1].(*info.AttackEvent), args[0].(info.Target).Key())
	}, "gidps-source-host-stellar-conduct-event", phase.Descriptor{Source: "cmd/sourcehost/main.go:OnStellarConduct-receipt", Observational: true})
	evaluator, err := eval.NewEvaluator(file, program, c)
	if err != nil {
		panic(err)
	}
	sim, err := simulation.New(config, evaluator, c)
	if err != nil {
		panic(err)
	}
	bindTargetPhases(request.TargetPhases, c)
	bridge.TargetPhases = request.TargetPhases
	targetScene := captureTargetScene(config, c, primaryTargetIndex)
	startupState = captureStartupEnergy(c, initialEnergy)
	configurePhaseObservation(sim, bridge)
	result, err := sim.Run()
	if err != nil {
		logs, logErr := c.Log.Dump()
		if logErr != nil {
			panic(logErr)
		}
		return respond(map[string]any{"protocol": sourcehost.Protocol, "sourceCommit": sourcehost.SourceCommit,
			"config": request.Config, "seed": request.Seed, "executionMode": executionMode,
			"error": err.Error(), "logs": json.RawMessage(logs)})
	}
	policy := "native"
	if request.StopAtDuration {
		policy = "duration-or-native"
	}
	observationWindow := map[string]any{
		"policy": policy, "configuredEndFrame": int(config.Settings.Duration * 60),
		"actualEndFrame": result.Duration, "endReason": bridge.EndReason,
	}
	for _, char := range c.Player.Chars() {
		char.SourceHostObserveStatusesAtEnd()
	}
	bridge.FinalizeStatusInstances()
	bridge.FinalizePendingAttackStages()
	bridge.FinalizeAbilityInvocations()
	bridge.FinalizeOwnedGeneratorTriggers()
	bridge.FinalizeOwnedEntityAttacks()
	bridge.FinalizeHitCallbackAttacks()
	bridge.FinalizeEventAttacks()
	bridge.FinalizeShields()
	logs, err := c.Log.Dump()
	if err != nil {
		panic(err)
	}
	response := map[string]any{"protocol": sourcehost.Protocol, "sourceCommit": sourcehost.SourceCommit,
		"config": request.Config, "seed": request.Seed, "executionMode": executionMode, "calculations": bridge.Calculations, "applications": bridge.Applications, "attackObservations": bridge.AttackObservations, "abilityInvocations": bridge.AbilityInvocations, "abilityProducers": bridge.AbilityProducers, "ownedGenerators": bridge.OwnedGenerators, "ownedGeneratorTriggers": bridge.OwnedGeneratorTriggers, "ownedEntities": bridge.OwnedEntities, "ownedEntityTriggers": bridge.OwnedEntityTriggers, "ownedEntityProducers": bridge.OwnedEntityProducers, "hitCallbackBatches": bridge.HitCallbackBatches, "hitCallbacks": bridge.HitCallbacks, "eventRegistrations": bridge.EventRegistrations, "eventEmissions": bridge.EventEmissions, "eventListenerCalls": bridge.EventListenerCalls, "eventProducers": bridge.EventProducers, "shieldInstances": bridge.ShieldInstances, "shieldHooks": bridge.ShieldHooks, "shieldProducers": bridge.ShieldProducers, "attackDispatchCompletions": bridge.AttackDispatchCompletions, "statusInstances": bridge.StatusInstances, "pendingAttackStages": bridge.PendingAttackStages, "lifecycleObservationFrame": c.F, "taskLifecycle": bridge.TaskTracker.Snapshot(),
		"playerApplications": bridge.PlayerApplications, "drainApplications": bridge.DrainApplications, "energyApplications": bridge.EnergyApplications, "healingApplications": bridge.HealingApplications,
		"result": result, "targetScene": targetScene, "observationWindow": observationWindow, "logs": json.RawMessage(logs), "capabilities": map[string]any{
			"checkpoint": false, "phaseObservation": "post-tick-pre-input-v1", "executionModes": []string{"auto-wait", "strict"},
			"executionProfileActionDelays":      map[string]any{"policy": "source-host-local", "stage": "after-ready-check-before-exec", "actions": []string{"attack", "charge", "skill", "burst", "jump", "dash", "aim"}},
			"supportedFormulaFamilies":          []string{"ordinary", "amplifying", "additive", "transformative", "lunar-charged-direct", "lunar-bloom-direct", "lunar-crystallize-direct", "lunar-charged-reaction", "lunar-crystallize-reaction", "lunar-bloom-event", "stellar-conduct-event", "stellar-conduct-direct", "stellar-swirl-direct", "stellar-swirl-reaction", "player-incoming", "player-shield", "player-drain", "player-shield-min", "artifact-scalar", "weapon-additive", "artifact-additive", "character-energy", "character-cooldown", "character-healing", "character-modifier", "character-scalar", "character-additive", "character-flat", "character-multiplier"},
			"unsupportedSpecialFormulaFamilies": []string{}, "lunarNonIgnoredDefense": false, "sourceLunarMechanicsVerified": false, "sourceStellarMechanicsVerified": false, "fullModifierDerivation": false, "playerIncomingDamageSharedFormula": true, "playerShieldAndDrainSharedFormula": true, "sharedEnergyFormula": true, "sharedHealingFormula": true,
		}}
	if request.TargetPhases != nil {
		response["targetPhases"] = request.TargetPhases
	}
	return respond(response)
}

func main() { js.Global().Set("gidpsSourceHostRun", js.FuncOf(run)); select {} }
