//go:build js && wasm

package main

import (
	"fmt"

	"github.com/genshinsim/gcsim/pkg/core"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

type initialEnergyOverride struct {
	Mode    string         `json:"mode"`
	ByActor map[string]int `json:"byActor,omitempty"`
}

type startupEnergyActor struct {
	ActorIndex      int     `json:"actorIndex"`
	ActorKey        string  `json:"actorKey"`
	RequestedEnergy *int    `json:"requestedEnergy"`
	Energy          float64 `json:"energy"`
	MaxEnergy       float64 `json:"maxEnergy"`
}

type startupEnergyState struct {
	Mode   string               `json:"mode"`
	Actors []startupEnergyActor `json:"actors"`
}

func applyInitialEnergy(config *info.ActionList, override *initialEnergyOverride) error {
	if override == nil {
		return nil
	}
	team := make(map[string]bool, len(config.Characters))
	for _, profile := range config.Characters {
		key := profile.Base.Key.String()
		if key == "" || team[key] {
			return fmt.Errorf("initialEnergy requires unique canonical team keys; invalid or duplicate key %q", key)
		}
		team[key] = true
	}
	switch override.Mode {
	case "zero", "full":
		if override.ByActor != nil {
			return fmt.Errorf("initialEnergy mode %q must omit byActor", override.Mode)
		}
	case "custom":
		if override.ByActor == nil {
			return fmt.Errorf("initialEnergy custom mode requires byActor for every team actor")
		}
		for key, energy := range override.ByActor {
			if !team[key] {
				return fmt.Errorf("initialEnergy byActor has unknown canonical team key %q", key)
			}
			if energy < 0 {
				return fmt.Errorf("initialEnergy byActor[%q] must be a nonnegative integer", key)
			}
		}
		for key := range team {
			if _, ok := override.ByActor[key]; !ok {
				return fmt.Errorf("initialEnergy byActor is missing team key %q", key)
			}
		}
	default:
		return fmt.Errorf("unsupported initialEnergy mode %q", override.Mode)
	}
	for i := range config.Characters {
		profile := &config.Characters[i]
		if override.Mode == "full" {
			delete(profile.Params, "start_energy")
			continue
		}
		if profile.Params == nil {
			profile.Params = make(map[string]int)
		}
		if override.Mode == "zero" {
			profile.Params["start_energy"] = 0
		} else {
			profile.Params["start_energy"] = override.ByActor[profile.Base.Key.String()]
		}
	}
	return nil
}

// Called after simulation.New has added and initialized the native characters,
// before the first queued action can change their energy.
func captureStartupEnergy(c *core.Core, override *initialEnergyOverride) *startupEnergyState {
	if override == nil {
		return nil
	}
	state := &startupEnergyState{Mode: override.Mode, Actors: make([]startupEnergyActor, 0, len(c.Player.Chars()))}
	for index, char := range c.Player.Chars() {
		actor := startupEnergyActor{ActorIndex: index, ActorKey: char.Base.Key.String(), Energy: char.Energy, MaxEnergy: char.EnergyMax}
		switch override.Mode {
		case "zero":
			requested := 0
			actor.RequestedEnergy = &requested
		case "custom":
			requested := override.ByActor[actor.ActorKey]
			actor.RequestedEnergy = &requested
		}
		state.Actors = append(state.Actors, actor)
	}
	return state
}

func addInitialEnergyResponse(response map[string]any, override *initialEnergyOverride, startup *startupEnergyState) map[string]any {
	if override != nil {
		response["initialEnergy"] = override
		if startup != nil {
			response["startupState"] = startup
		}
	}
	return response
}
