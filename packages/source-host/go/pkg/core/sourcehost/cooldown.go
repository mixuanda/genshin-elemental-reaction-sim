package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/action"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// CooldownDuration receives the factor after CDReduction's original modifier
// loop, so native Amount calls, expiry checks, logging and compaction stay put.
func (b *Bridge) CooldownDuration(actor int, a action.Action, duration int, factor float64, reads ...*info.SourceHostScalarRead) int {
	request := b.cooldownRequest(actor, a, "duration")
	request.Input["originalDuration"] = duration
	request.Input["cooldownFactor"] = factor
	request.ScalarProvenance = ScalarProvenance(reads...)
	value, _ := b.Resolve(request)
	return int(value)
}

// CooldownRemaining evaluates only the branch that already reads the queue
// head. Native early exits and queue-worker state remain in Character.
func (b *Bridge) CooldownRemaining(actor int, a action.Action, workerStartedAt, headDuration, currentFrame int) int {
	request := b.cooldownRequest(actor, a, "remaining")
	request.Input["workerStartedAt"] = workerStartedAt
	request.Input["headDuration"] = headDuration
	request.Input["currentFrame"] = currentFrame
	value, _ := b.Resolve(request)
	return int(value)
}

// CooldownReduce returns the new queue-head duration after the native
// reset-versus-reduce comparison has selected the write branch.
func (b *Bridge) CooldownReduce(actor int, a action.Action, remaining, reduction int) int {
	request := b.cooldownRequest(actor, a, "reduce")
	request.Input["remaining"] = remaining
	request.Input["reduction"] = reduction
	value, _ := b.Resolve(request)
	return int(value)
}

func (b *Bridge) cooldownRequest(actor int, a action.Action, operation string) Request {
	request := b.Request("character-cooldown", info.AttackInfo{ActorIndex: actor, Abil: a.String()})
	request.DamageCategory = "character-cooldown"
	request.Input = map[string]any{"operation": operation, "action": a.String(), "actionType": int(a)}
	switch operation {
	case "source", "route", "remaining", "reduce", "special-reduce":
		request.ComponentIDs = b.cooldownComponents()
	}
	return request
}

// CooldownRoute records the source character's routing decision without
// deciding whether the native target queue exists or can be reduced.
func (b *Bridge) CooldownRoute(actor int, a action.Action, reduction int, rule string, specialActive bool) (int, int) {
	request := b.cooldownRequest(actor, a, "route")
	request.Input["rule"] = rule
	request.Input["reduction"] = reduction
	request.Input["specialActive"] = specialActive
	value, id := b.Resolve(request)
	return int(value), id
}

// CooldownSource captures a native fixed reduction such as Thundering Fury.
func (b *Bridge) CooldownSource(actor int, a action.Action, rule string, reduction int) (int, int) {
	request := b.cooldownRequest(actor, a, "source")
	request.Input["rule"] = rule
	request.Input["reduction"] = reduction
	value, id := b.Resolve(request)
	return int(value), id
}

// CooldownSpecialReduce captures a character-owned cooldown formula after its
// original branch has already selected this operation.
func (b *Bridge) CooldownSpecialReduce(actor int, a action.Action, expiry, reduction, currentFrame int) int {
	request := b.cooldownRequest(actor, a, "special-reduce")
	request.Input["rule"] = "varka-classic"
	request.Input["expiry"] = expiry
	request.Input["reduction"] = reduction
	request.Input["currentFrame"] = currentFrame
	value, _ := b.Resolve(request)
	return int(value)
}
