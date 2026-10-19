package simulation

import "github.com/genshinsim/gcsim/pkg/core/action"

// SourceHostPhaseState reads the scheduler side of the actual queuePhase before
// the next action. It neither advances a frame nor touches native task queues.
func (s *Simulation) SourceHostPhaseState() (map[string]any, []string) {
	if s == nil {
		return nil, []string{"native simulation is unavailable at the phase marker"}
	}
	queue := make([]map[string]any, 0, len(s.queue))
	for _, item := range s.queue {
		if item == nil {
			return nil, []string{"native action queue contains a nil entry"}
		}
		queue = append(queue, sourceHostQueuedAction(item))
	}
	return map[string]any{
		"queue":               queue,
		"preActionDelay":      s.preActionDelay,
		"noMoreActions":       s.noMoreActions,
		"phaseBoundaryMarked": s.phaseBoundaryMarked,
	}, nil
}

func sourceHostQueuedAction(item *action.Eval) map[string]any {
	params := make(map[string]int, len(item.Param))
	for key, value := range item.Param {
		params[key] = value
	}
	return map[string]any{"character": item.Char.String(), "action": item.Action.String(), "params": params}
}

// SourceHostExternalPhaseState captures settings whose mutable counters or
// queued external events can change future damage/energy independently of a
// rotation label. An inactive one-shot source has no live elapsed counter.
func (s *Simulation) SourceHostExternalPhaseState() (map[string]any, []string) {
	if s == nil || s.cfg == nil || s.C == nil {
		return nil, []string{"native external settings are unavailable at the phase marker"}
	}
	energy := s.cfg.EnergySettings
	energyState := map[string]any{
		"active": energy.Active, "once": energy.Once,
		"start": energy.Start, "end": energy.End, "amount": energy.Amount,
	}
	if energy.Active {
		energyState["elapsedSinceLastDrop"] = s.C.F - energy.LastEnergyDrop
	}
	hurt := s.cfg.HurtSettings
	hurtState := map[string]any{
		"active": hurt.Active, "once": hurt.Once,
		"start": hurt.Start, "end": hurt.End, "min": hurt.Min,
		"max": hurt.Max, "element": hurt.Element,
	}
	if hurt.Active {
		hurtState["elapsedSinceLastHurt"] = s.C.F - hurt.LastHurt
	}
	settings := s.cfg.Settings
	return map[string]any{
		"energy": energyState, "hurt": hurtState,
		"configuredDurationSeconds": settings.Duration,
		"configuredDurationFrames":  int(settings.Duration * 60),
		"damageMode":                settings.DamageMode,
		"enableHitlag":              settings.EnableHitlag,
		"defHalt":                   settings.DefHalt,
		"ignoreBurstEnergy":         settings.IgnoreBurstEnergy,
		"delays":                    settings.Delays,
	}, nil
}
