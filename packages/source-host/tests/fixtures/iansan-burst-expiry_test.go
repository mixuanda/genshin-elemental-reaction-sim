// Overlay beside iansan-c2-active-recipient_test.go in a copied pinned source
// tree. Exercise the real Burst producer, global/character task clocks, status
// expiry, NS wrapper and A1/C2 getters. Movement is a declared controlled input,
// not a claim about a measured game trajectory or a sustainable player build.
package iansan

import (
	"testing"

	"github.com/genshinsim/gcsim/pkg/avatar"
	"github.com/genshinsim/gcsim/pkg/core"
	"github.com/genshinsim/gcsim/pkg/core/action"
	"github.com/genshinsim/gcsim/pkg/core/event"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

func burstExpiryFixture(t *testing.T, cons int) (*char, *core.Core) {
	t.Helper()
	c, teammate, s := c2ActiveRecipientFixture(t, cons, 6)
	s.Combat.SetPlayer(avatar.New(s, info.Point{}, 1))
	c.burstInit()
	c.c4Init()
	c.c6Init()
	c.enterNightsoul(54)
	c.Energy = 70
	if _, err := c.Burst(nil); err != nil {
		t.Fatal(err)
	}
	s.Player.SetActive(teammate.Index())
	return c, s
}

func burstExpiryAdvance(t *testing.T, c *char, s *core.Core, end int) {
	t.Helper()
	for s.F < end {
		s.F++
		if s.F%60 == 59 {
			// Explicit input to the existing movement callback keeps NS positive;
			// this fixture isolates expiry, not movement/energy feasibility.
			s.Events.Emit(event.OnMovement, float64(12))
		}
		if err := s.Tick(); err != nil {
			t.Fatal(err)
		}
	}
}

func TestIansanBurstExpiryEndsPositiveNightsoul(t *testing.T) {
	for _, row := range []struct{ cons, expiry int }{{4, 720}, {6, 900}} {
		t.Run(map[int]string{4: "C4_12seconds", 6: "C6_15seconds"}[row.cons], func(t *testing.T) {
			c, s := burstExpiryFixture(t, row.cons)
			burstExpiryAdvance(t, c, s, row.expiry-1)
			// A late real teammate OnBurst grant leaves a C4 stack at expiry.
			s.Events.Emit(event.OnBurst)
			burstExpiryAdvance(t, c, s, row.expiry)
			if !c.StatusIsActive(burstStatus) || !c.nightsoulState.HasBlessing() || c.nightsoulState.Points() <= 0 {
				t.Fatal("fixture lost the original inclusive marker boundary or positive NS before expiry")
			}
			if c.c4Stacks != 1 {
				t.Fatalf("last restoration must consume exactly one late C4 stack, got %d", c.c4Stacks)
			}
			burstExpiryAdvance(t, c, s, row.expiry+1)
			if c.StatusIsActive(burstStatus) || c.nightsoulState.HasBlessing() || c.nightsoulState.Points() != 0 || c.StatModIsActive(a1Key) || c.c4Stacks != 0 {
				t.Fatalf("marker ended but retained NS/A1/C4: marker=%v NS=%v points=%v A1=%v stacks=%d", c.StatusIsActive(burstStatus), c.nightsoulState.HasBlessing(), c.nightsoulState.Points(), c.StatModIsActive(a1Key), c.c4Stacks)
			}
			c2RequireATK(t, s.Player.ActiveChar(), .25, 600)
		})
	}
}

func TestIansanBurstExpiryFollowsActualHitlagExtension(t *testing.T) {
	c, s := burstExpiryFixture(t, 4)
	burstExpiryAdvance(t, c, s, 300)
	c.ApplyHitlag(0, 7)
	if c.StatusExpiry(burstStatus) != 727 {
		t.Fatalf("fixture expected native seven-frame extension, got %d", c.StatusExpiry(burstStatus))
	}
	burstExpiryAdvance(t, c, s, 721)
	if !c.StatusIsActive(burstStatus) || !c.nightsoulState.HasBlessing() {
		t.Fatal("nominal deadline ended the actual hitlag-extended marker")
	}
	burstExpiryAdvance(t, c, s, 727)
	if !c.StatusIsActive(burstStatus) || !c.nightsoulState.HasBlessing() {
		t.Fatal("inclusive extended boundary changed")
	}
	burstExpiryAdvance(t, c, s, 728)
	if c.nightsoulState.HasBlessing() || c.nightsoulState.Points() != 0 || c.StatModIsActive(a1Key) {
		t.Fatal("actual extended marker expired without clearing NS/A1")
	}
}

func TestIansanBurstExpiryDoesNotKillLaterSkillEntry(t *testing.T) {
	for _, entryFrame := range []int{720, 721, 722} {
		t.Run(map[int]string{720: "beforeEnd", 721: "sameFrameAsEnd", 722: "afterEnd"}[entryFrame], func(t *testing.T) {
			c, s := burstExpiryFixture(t, 4)
			burstExpiryAdvance(t, c, s, 700)
			// Same +3f E producer used by Skill, queued after the old Q producer.
			s.Tasks.Add(func() { c.enterNightsoul(54) }, entryFrame-s.F)
			burstExpiryAdvance(t, c, s, 723)
			wantActive := entryFrame >= 721
			if c.nightsoulState.HasBlessing() != wantActive {
				t.Fatalf("E entry F%d: NS=%v, want %v", entryFrame, c.nightsoulState.HasBlessing(), wantActive)
			}
			if wantActive && c.nightsoulState.Points() != 54 {
				t.Fatalf("old Q task changed later E points: %v", c.nightsoulState.Points())
			}
		})
	}
}

func TestIansanBurstExpiryStaleInstanceIsInert(t *testing.T) {
	for _, replaceQ := range []bool{false, true} {
		t.Run(map[bool]string{false: "exitThenSkill", true: "laterQInstance"}[replaceQ], func(t *testing.T) {
			c, s := burstExpiryFixture(t, 4)
			burstExpiryAdvance(t, c, s, 300)
			c.exitNightsoul()
			c.enterNightsoul(54)
			if replaceQ {
				// Direct producer invocation isolates stale identity handling. This
				// is not an action-readiness or legal short-CD rotation fixture.
				c.ResetActionCooldown(action.ActionBurst)
				c.Energy = 70
				if _, err := c.Burst(nil); err != nil {
					t.Fatal(err)
				}
			}
			burstExpiryAdvance(t, c, s, 723)
			if !c.nightsoulState.HasBlessing() || c.nightsoulState.Points() <= 0 {
				t.Fatal("old Q expiry destroyed a later NS instance")
			}
		})
	}
}
