package character

import "github.com/genshinsim/gcsim/pkg/core/info"

// SourceHostAddOwnedGeneratorStatus delegates to the native status operation,
// then binds the exact status object created at this audited activation site.
func (c *CharWrapper) SourceHostAddOwnedGeneratorStatus(siteID, key string, dur int, hitlag bool) {
	c.AddStatus(key, dur, hitlag)
	if c.SourceHost != nil {
		c.SourceHost.RegisterOwnedGenerator(siteID, c.SourceHostStatusOwner(key))
	}
}

// SourceHostTriggerOwnedGenerator preserves the callback's existing origin.
// Effect ownership is a separate exact status-instance binding.
func (c *CharWrapper) SourceHostTriggerOwnedGenerator(siteID, statusKey, kind string, f func()) {
	if c.SourceHost == nil {
		f()
		return
	}
	owner := c.SourceHostStatusOwner(statusKey)
	endOwner := c.SourceHost.Origin.BeginStatusOwner(owner)
	endTrigger := c.SourceHost.BeginOwnedGeneratorTrigger(siteID, kind, owner)
	f()
	endTrigger()
	endOwner()
}

// SourceHostAddOwnedGeneratorAttackMod observes the actual native AttackMod
// installed on this beneficiary. Its emitter is the explicitly supplied caster,
// bound to the running activation producer rather than inferred from the holder.
func (c *CharWrapper) SourceHostAddOwnedGeneratorAttackMod(siteID string, actorIndex int, mod AttackMod) {
	if c.SourceHost != nil {
		origin := c.SourceHost.Origin.Snapshot()
		mod.SourceHostStatusOwner = &info.SourceHostStatusOwner{
			ActorIndex: c.Index(), StatusKey: mod.Key(),
			InstanceID: c.SourceHost.NextStatusInstanceID(), CreatedFrame: *c.f,
			CreationActionSequence: origin.CreationActionSequence,
		}
	}
	c.AddAttackMod(mod)
	if c.SourceHost != nil {
		c.SourceHost.RegisterOwnedGeneratorFromProducer(siteID, actorIndex, c.SourceHostStatusOwner(mod.Key()))
	}
}
