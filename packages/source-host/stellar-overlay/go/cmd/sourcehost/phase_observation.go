//go:build js && wasm

package main

import (
	"fmt"
	"github.com/genshinsim/gcsim/pkg/core/sourcehost"
	"github.com/genshinsim/gcsim/pkg/simulation"
	"sort"
)

func configurePhaseObservation(sim *simulation.Simulation, b *sourcehost.Bridge) {
	if b.PhaseConfig == nil {
		return
	}
	b.PhaseObservations = []sourcehost.PhaseObservation{}
	previousApplicationIndex := 0
	b.PhaseCapture = func(input sourcehost.PhaseInput) {
		if len(b.PhaseObservations) >= b.PhaseConfig.MaxObservations {
			return
		}
		state := map[string]any{}
		gaps := []string{}
		add := func(name string, value map[string]any, missing []string) {
			state[name] = value
			for _, gap := range missing {
				gaps = append(gaps, name+": "+gap)
			}
		}
		add("input", input.InputState, input.InputGaps)
		simulationState, missing := sim.SourceHostPhaseState()
		flags := sim.C.Flags
		flags.Custom = make(map[string]float64, len(sim.C.Flags.Custom))
		for key, value := range sim.C.Flags.Custom {
			flags.Custom[key] = value
		}
		simulationState["flags"] = flags
		add("simulation", simulationState, missing)
		player, missing := sim.C.Player.SourceHostPhaseState()
		// Nested actor and effect providers remain complete maps, split only for the
		// wire's named coverage dimensions. The native snapshot supplies all values.
		state["characters"] = map[string]any{"actors": player["characters"]}
		effects := map[string]any{}
		for _, key := range []string{"shields", "infusions"} {
			effects[key] = player[key]
			delete(player, key)
		}
		delete(player, "characters")
		add("player", player, missing)
		status, statusGaps := sim.C.Status.SourceHostPhaseState()
		effects["globalStatus"] = status
		add("effects", effects, statusGaps)
		combat, combatGaps := sim.C.Combat.SourceHostPhaseState()
		constructs, constructGaps := sim.C.Constructs.SourceHostPhaseState()
		add("targets", map[string]any{"combat": combat, "constructs": constructs}, append(combatGaps, constructGaps...))
		tasks, taskGaps := sim.C.Tasks.SourceHostPhaseState()
		add("tasks", tasks, taskGaps)
		events, eventGaps := sim.C.Events.SourceHostPhaseState()
		add("events", events, eventGaps)
		rng, rngGaps := sim.C.SourceHostRNGPhaseState()
		add("rng", rng, rngGaps)
		external, externalGaps := sim.SourceHostExternalPhaseState()
		add("external", external, externalGaps)
		sort.Strings(gaps)
		determinism := "deterministic"
		if len(rngGaps) > 0 {
			determinism = "stochastic"
		}
		var intervalDamage *float64
		if len(b.PhaseObservations) > 0 {
			amount := 0.0
			for _, application := range b.Applications[previousApplicationIndex:] {
				amount += application.AppliedDamage
			}
			intervalDamage = &amount
		}
		previousApplicationIndex = len(b.Applications)
		b.PhaseObservations = append(b.PhaseObservations, sourcehost.PhaseObservation{
			Boundary: "post-tick-pre-input-v1", Frame: sim.C.F, InputPhase: input, Determinism: determinism,
			NormalizedState: state, Coverage: sourcehost.PhaseCoverage{Complete: len(gaps) == 0,
				Providers: []string{"input", "simulation", "player", "characters", "effects", "targets", "tasks", "events", "rng", "external"}, Gaps: gaps},
			CumulativeDamage: sim.C.Combat.TotalDamage, DamageSincePreviousBoundary: intervalDamage,
		})
	}
}

func validatePhaseConfig(config *sourcehost.PhaseConfig) error {
	if config == nil {
		return nil
	}
	if config.WarmupFrames < 0 || config.MaxPeriod < 1 || config.MaxPeriod > 8 || config.RequiredConsecutivePeriods < 2 || config.RequiredConsecutivePeriods > 8 || config.MaxObservations < 2 || config.MaxObservations > 256 {
		return fmt.Errorf("invalid phaseObservation policy")
	}
	return nil
}
