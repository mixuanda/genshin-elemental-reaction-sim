package character

import (
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/modifier"
	"testing"
)

// Real native stats loop with no SourceHost/logger: recording must not determine
// gameplay, duplicate Amount calls, keep rejected/expired values or alias slices.
func TestSnapshotTrackedStatContributions(t *testing.T) {
	frame := 10
	calls := 0
	values := make([]float64, attributes.EndStatType)
	values[attributes.ATKP] = .35
	tracked := &StatMod{Base: modifier.Base{ModKey: "tracked", ModExpiry: 11}, TrackSnapshot: true, Amount: func() []float64 { calls++; return values }}
	rejected := &StatMod{Base: modifier.Base{ModKey: "rejected", ModExpiry: 11}, TrackSnapshot: true, Amount: func() []float64 { return nil }}
	expired := &StatMod{Base: modifier.Base{ModKey: "expired", ModExpiry: 10}, TrackSnapshot: true, Amount: func() []float64 { t.Fatal("expiry boundary called Amount"); return values }}
	untracked := &StatMod{Base: modifier.Base{ModKey: "untracked", ModExpiry: -1}, Amount: func() []float64 { return values }}
	c := &CharWrapper{f: &frame, mods: []modifier.Mod{tracked, rejected, expired, untracked}}
	stats, _, read, mods := c.SnapshotStats()
	if read != nil || calls != 1 || stats[attributes.ATKP] != .7 || len(mods) != 1 || mods["tracked"][attributes.ATKP] != .35 {
		t.Fatalf("wrong captured loop: calls=%d stats=%v mods=%v", calls, stats, mods)
	}
	values[attributes.ATKP] = .2
	if mods["tracked"][attributes.ATKP] != .35 {
		t.Fatal("snapshot contribution aliases later modifier values")
	}
	plain, _, read := c.StatsWithProvenance()
	if read != nil || calls != 2 || plain[attributes.ATKP] != .4 {
		t.Fatal("plain stat read changed or callback repeated")
	}
	frame = 11
	stats, _, _, mods = c.SnapshotStats()
	if calls != 2 || stats[attributes.ATKP] != .2 || mods != nil {
		t.Fatal("expired tracked contribution retained at exact frame boundary")
	}
}
