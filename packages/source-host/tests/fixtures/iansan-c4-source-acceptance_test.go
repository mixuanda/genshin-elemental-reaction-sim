// Supply this new test file through Go's -overlay into a pinned a7 Iansan
// package. It exercises the actual native event subscriber, C4 producers and
// scheduled restoration callback; no shared source file is changed.
package iansan

import (
	"math"
	"testing"

	"github.com/genshinsim/gcsim/internal/characters/kaeya"
	"github.com/genshinsim/gcsim/pkg/avatar"
	"github.com/genshinsim/gcsim/pkg/core"
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/event"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/keys"
	"github.com/genshinsim/gcsim/pkg/core/player/character"
)

func c4SourceFixture(t *testing.T, constellation int, points float64) (*char, *character.CharWrapper, *core.Core) {
	t.Helper()
	s, err := core.New(core.Opt{Seed: 20261023})
	if err != nil {
		t.Fatal(err)
	}
	var owner *char
	var teammate *character.CharWrapper
	for _, key := range []keys.Char{keys.Iansan, keys.Kaeya} {
		p := info.CharacterProfile{
			Base:    info.CharacterBase{Key: key, Element: attributes.Cryo, Level: 20, MaxLevel: 20},
			Talents: info.TalentProfile{Attack: 1, Skill: 1, Burst: 1},
			Stats:   make([]float64, attributes.EndStatType),
		}
		if key == keys.Iansan {
			p.Base.Element = attributes.Electro
			p.Base.Cons = constellation
		}
		w, err := character.New(p, &s.F, false, s.Log, s.Events, s.Tasks)
		if err != nil {
			t.Fatal(err)
		}
		s.Player.AddChar(w)
		if key == keys.Iansan {
			if err := NewChar(s, w, p); err != nil {
				t.Fatal(err)
			}
			owner = w.Character.(*char)
		} else {
			if err := kaeya.NewChar(s, w, p); err != nil {
				t.Fatal(err)
			}
			teammate = w
		}
	}
	// Ascension0 prevents A1 restoration from contaminating this C4-only
	// arithmetic. No C1/weapon/artifact, movement producer or NS drain is run.
	owner.c4Init()
	owner.nightsoulState.EnterBlessing(points)
	return owner, teammate, s
}

func c4SourceMarker(c *char, s *core.Core, frame, duration int) {
	s.F = frame
	s.Player.SetActive(c.Index())
	// These are the actual C4 reset, marker and callback producer used by Q;
	// this isolated fixture does not claim to execute/validate Q energy or CD.
	c.c4OnBurst()
	c.AddStatus(burstStatus, duration, true)
	c.burstSrc = frame
	c.burstRestoreNS = 0
	c.restorePointsTask(frame)
}

func c4SourceOtherBurst(c *char, other *character.CharWrapper, s *core.Core) {
	s.Player.SetActive(other.Index())
	// The real player.useAbility emits OnBurst with no actor arguments; the
	// event's casting actor is the current active player character.
	s.Events.Emit(event.OnBurst)
}

func c4SourceTick(s *core.Core, frame int) {
	s.F = frame
	s.Tasks.Run()
}

func c4SourceRequire(t *testing.T, c *char, wantPoints, wantOverflow float64, wantStacks int) {
	t.Helper()
	if math.Abs(c.nightsoulState.Points()-wantPoints) > 1e-12 || math.Abs(c.pointsOverflow-wantOverflow) > 1e-12 || c.c4Stacks != wantStacks {
		t.Fatalf("native points/overflow/stacks=%.17g/%.17g/%d, want%.17g/%.17g/%d",
			c.nightsoulState.Points(), c.pointsOverflow, c.c4Stacks, wantPoints, wantOverflow, wantStacks)
	}
}

func TestIansanC4SourceOtherActiveBurstAndMarkerGate(t *testing.T) {
	c, teammate, s := c4SourceFixture(t, 4, 10)
	c4SourceOtherBurst(c, teammate, s)
	if c.c4Generated || c.c4Stacks != 0 {
		t.Fatal("other active Q without a marker must not grant C4")
	}
	c4SourceMarker(c, s, 0, 600)
	s.Events.Emit(event.OnBurst) // owner is active: her own Q never grants it
	if c.c4Generated || c.c4Stacks != 0 {
		t.Fatal("Iansan's own active Q must not grant the two C4 stacks")
	}
	c4SourceOtherBurst(c, teammate, s)
	if !c.c4Generated || c.c4Stacks != 2 {
		t.Fatal("other active Q with owner off field and marker present must grant exactly two stacks")
	}
	// A second Q cannot top up even after one layer is spent.
	c4SourceTick(s, 60)
	c4SourceRequire(t, c, 14, 0, 1)
	c4SourceOtherBurst(c, teammate, s)
	c4SourceRequire(t, c, 14, 0, 1)
}

func TestIansanC4SourceTwoFourPointRestorationsOncePerMarker(t *testing.T) {
	c, teammate, s := c4SourceFixture(t, 4, 10)
	c4SourceMarker(c, s, 0, 600)
	c4SourceOtherBurst(c, teammate, s)
	c4SourceTick(s, 59)
	c4SourceRequire(t, c, 10, 0, 2)
	c4SourceTick(s, 60)
	c4SourceRequire(t, c, 14, 0, 1)
	s.Player.SetActive(c.Index()) // already-granted layers are not recipient-gated
	c4SourceTick(s, 120)
	c4SourceRequire(t, c, 18, 0, 0)
	c4SourceOtherBurst(c, teammate, s)
	c4SourceTick(s, 180)
	c4SourceRequire(t, c, 18, 0, 0)
	if !c.c4Generated {
		t.Fatal("spending both layers must not re-arm the once-per-marker gate")
	}
}

func TestIansanC4SourcePreviousOverflowHalfAndNoDoubleCredit(t *testing.T) {
	c, teammate, s := c4SourceFixture(t, 4, 53)
	c4SourceMarker(c, s, 0, 600)
	c4SourceOtherBurst(c, teammate, s)
	// The movement accumulator is an explicit fixture input, not a simulated
	// route: 10*0.67+4=10.7; 53+10.7-54=9.7 actual overflow.
	c.burstRestoreNS = 10
	c4SourceTick(s, 60)
	c4SourceRequire(t, c, 54, 9.7, 1)
	if c.burstRestoreNS != 0 {
		t.Fatal("the movement accumulator must be consumed by this restoration")
	}
	c.nightsoulState.ConsumePoints(14) // real points wrapper:54->40
	c4SourceTick(s, 120)
	c4SourceRequire(t, c, 48.85, 0, 0) // 40+4+9.7*0.5
	c4SourceTick(s, 180)
	c4SourceRequire(t, c, 48.85, 0, 0) // the old9.7 is not credited again
}

func TestIansanC4SourceNewOverflowMayChainFromTheRefund(t *testing.T) {
	c, teammate, s := c4SourceFixture(t, 4, 54)
	c4SourceMarker(c, s, 0, 600)
	c4SourceOtherBurst(c, teammate, s)
	for _, row := range []struct {
		frame, stacks int
		overflow      float64
	}{{60, 1, 4}, {120, 0, 6}, {180, 0, 3}, {240, 0, 1.5}} {
		c4SourceTick(s, row.frame)
		c4SourceRequire(t, c, 54, row.overflow, row.stacks)
	}
}

func TestIansanC4SourceBelowC4HasNeitherLayersNorOverflowRefund(t *testing.T) {
	for _, constellation := range []int{0, 3} {
		c, teammate, s := c4SourceFixture(t, constellation, 53)
		c4SourceMarker(c, s, 0, 600)
		c4SourceOtherBurst(c, teammate, s)
		if c.c4Generated || c.c4Stacks != 0 {
			t.Fatalf("C%d must not grant C4 layers", constellation)
		}
		c.burstRestoreNS = 10
		c4SourceTick(s, 60)
		c4SourceRequire(t, c, 54, 5.7, 0)
		c.nightsoulState.ConsumePoints(14)
		c4SourceTick(s, 120)
		c4SourceRequire(t, c, 40, 0, 0)
	}
}

func TestIansanC4SourceExpiredAndExitedMarkersDoNotRestore(t *testing.T) {
	t.Run("statusExpiredBeforeCallback", func(t *testing.T) {
		c, teammate, s := c4SourceFixture(t, 4, 10)
		c4SourceMarker(c, s, 0, 59)
		c4SourceOtherBurst(c, teammate, s)
		c4SourceTick(s, 60)
		c4SourceRequire(t, c, 10, 0, 0)
		c4SourceTick(s, 120)
		c4SourceRequire(t, c, 10, 0, 0)
	})
	t.Run("nativeNightsoulExitInvalidatesSource", func(t *testing.T) {
		c, teammate, s := c4SourceFixture(t, 4, 10)
		c4SourceMarker(c, s, 0, 600)
		c4SourceOtherBurst(c, teammate, s)
		c.exitNightsoul()
		c4SourceTick(s, 60)
		if c.nightsoulState.Points() != 0 || c.StatusIsActive(burstStatus) {
			t.Fatal("an invalidated old marker must not restore after real NS exit")
		}
		// Internal old stack storage may remain until reset, but is unreachable
		// after burstSrc invalidation; do not mistake it for an active effect.
	})
}

func TestIansanC4SourceRenewalResetsGrantAndIgnoresOldCallback(t *testing.T) {
	c, teammate, s := c4SourceFixture(t, 4, 10)
	c4SourceMarker(c, s, 0, 600)
	c4SourceOtherBurst(c, teammate, s)
	c4SourceMarker(c, s, 30, 600)
	if c.c4Generated || c.c4Stacks != 0 {
		t.Fatal("actual c4OnBurst must reset both the grant gate and old layers")
	}
	c4SourceOtherBurst(c, teammate, s)
	c4SourceTick(s, 60) // callback from src0 must not mutate the renewed src30
	c4SourceRequire(t, c, 10, 0, 2)
	c4SourceTick(s, 90)
	c4SourceRequire(t, c, 14, 0, 1)
}

// C6's fixed description covers any NS restoration overflow. Q's native +15
// callback is not a Scale restoration and must not create C4 refund credit.
// This controlled existing-NS state exercises the real Burst producer; it does
// not claim a complete E/Q rotation, energy-readiness or movement simulation.
func TestIansanC6SourceBurstRestorationOverflow(t *testing.T) {
	for _, row := range []struct {
		name          string
		constellation int
		points        float64
		wantC6        bool
	}{
		{"exactCapDoesNotOverflow", 6, 39, false},
		{"existingNightsoulOverflows", 6, 47.4, true},
		{"belowC6DoesNotGrant", 5, 47.4, false},
	} {
		t.Run(row.name, func(t *testing.T) {
			c, _, s := c4SourceFixture(t, row.constellation, row.points)
			s.Combat.SetPlayer(avatar.New(s, info.Point{}, 1))
			s.Player.SetActive(c.Index())
			c.burstInit()
			c.c6Init()
			if _, err := c.Burst(nil); err != nil {
				t.Fatal(err)
			}
			c4SourceTick(s, 39)
			if c.StatusIsActive(c6Key) || c.nightsoulState.Points() != row.points {
				t.Fatal("Q restoration/C6 must not occur before its real +40f callback")
			}
			c4SourceTick(s, 40)
			// No Scale tick is scheduled until60f. Q restoration must not become
			// the last Scale overflow, even when it should grant C6.
			c4SourceRequire(t, c, 54, 0, 0)
			if got := c.StatusIsActive(c6Key); got != row.wantC6 {
				t.Fatalf("native Q +15 at40f: initial NS=%.17g, overflow=%.17g, C%d C6 active=%v, want%v",
					row.points, math.Max(row.points+15-54, 0), row.constellation, got, row.wantC6)
			}
			if row.wantC6 && c.StatusDuration(c6Key) != 180 {
				t.Fatalf("actual C6 recipient duration=%d, want180f", c.StatusDuration(c6Key))
			}
		})
	}
}
