// Copy into a verified a7 source copy's internal/characters/iansan directory.
// This fixture is outside the source-host runtime build input. It executes the
// actual character methods and resource/energy wrappers, not a second C1 model.
package iansan

import (
	"math"
	"testing"

	"github.com/genshinsim/gcsim/pkg/core"
	"github.com/genshinsim/gcsim/pkg/core/action"
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/keys"
	"github.com/genshinsim/gcsim/pkg/core/player/character"
)

func c1ConsumptionFixture(t *testing.T, constellation int, points float64) (*char, *core.Core) {
	t.Helper()
	s, err := core.New(core.Opt{Seed: 20261023})
	if err != nil {
		t.Fatal(err)
	}
	p := info.CharacterProfile{
		Base: info.CharacterBase{Key: keys.Iansan, Element: attributes.Electro, Cons: constellation, Level: 90, MaxLevel: 90},
		Talents: info.TalentProfile{Attack: 1, Skill: 1, Burst: 1},
		Stats: make([]float64, attributes.EndStatType),
	}
	w, err := character.New(p, &s.F, false, s.Log, s.Events, s.Tasks)
	if err != nil {
		t.Fatal(err)
	}
	if err := NewChar(s, w, p); err != nil {
		t.Fatal(err)
	}
	c := w.Character.(*char)
	c.Energy = 0
	c.nightsoulState.EnterBlessing(points)
	return c, s
}

func TestIansanC1ConsumptionTenthScheduledTick(t *testing.T) {
	for _, initial := range []float64{54, 15} {
		t.Run(map[float64]string{54: "skill54", 15: "burst15"}[initial], func(t *testing.T) {
			c, s := c1ConsumptionFixture(t, 1, initial)
			c.enterNightsoul(initial)
			firstCreditFrame := -1
			for frame := 1; frame <= 66; frame++ {
				s.F = frame
				c.CharWrapper.Tick()
				if c.Energy > 0 && firstCreditFrame == -1 {
					firstCreditFrame = frame
				}
				if frame == 54 && c.Energy != 0 {
					t.Fatalf("nine ticks have consumed only 5.4: energy=%v", c.Energy)
				}
			}
			if firstCreditFrame != 60 {
				t.Fatalf("first 15 energy at local frame %d, want 60 (tenth tick), not 66 (eleventh tick)", firstCreditFrame)
			}
			if c.Energy != 15 {
				t.Fatalf("one C1 proc requests fixed 15 energy, got %v", c.Energy)
			}
		})
	}
}

func TestIansanC1ConsumptionScopeAndICD(t *testing.T) {
	t.Run("C0", func(t *testing.T) {
		c, _ := c1ConsumptionFixture(t, 0, 54)
		c.reduceNightsoulPoints(10)
		if c.Energy != 0 || c.c1Points != 0 {
			t.Fatalf("C0 accumulated C1 or gained energy: %v / %v", c.c1Points, c.Energy)
		}
	})
	t.Run("active18sICD", func(t *testing.T) {
		c, _ := c1ConsumptionFixture(t, 1, 54)
		c.AddStatus(c1ICDKey, 18*60, true)
		c.reduceNightsoulPoints(10)
		if c.Energy != 0 || c.c1Points != 0 {
			t.Fatalf("active ICD accumulated C1 or gained energy: %v / %v", c.c1Points, c.Energy)
		}
	})
	for _, amount := range []float64{0, -0.6} {
		t.Run(map[float64]string{0: "zero", -0.6: "negative"}[amount], func(t *testing.T) {
			c, _ := c1ConsumptionFixture(t, 1, 54)
			c.c1Points = 1.125
			c.c1(amount)
			if c.Energy != 0 || c.c1Points != 1.125 {
				t.Fatalf("nonpositive consumption changed state: %v / %v", c.c1Points, c.Energy)
			}
		})
	}
}

func TestIansanC1ConsumptionRequestedVersusActual(t *testing.T) {
	cases := []struct {
		name string
		points, previous, request, wantCounter, wantEnergy float64
	}{
		{"terminalClampIsNotRequested10", 0.4, 5, 10, 5.4, 0},
		{"realShortfall1eMinus10IsNotRounding", 6 - 1e-10, 0, 10, 6 - 1e-10, 0},
		{"arbitraryRestoredFractionIsNotQuantized", 5.123456789, 0.876543211, 6, 0, 15},
		{"fullJumpConsumption6", 54, 0, 6, 0, 15},
		{"fullDashConsumption10", 54, 0, 10, 0, 15},
	}
	for _, row := range cases {
		t.Run(row.name, func(t *testing.T) {
			c, _ := c1ConsumptionFixture(t, 1, row.points)
			c.c1Points = row.previous
			c.reduceNightsoulPoints(row.request)
			if c.Energy != row.wantEnergy || math.Abs(c.c1Points-row.wantCounter) > 1e-13 {
				t.Fatalf("counter/energy=%0.17g/%v, want %0.17g/%v", c.c1Points, c.Energy, row.wantCounter, row.wantEnergy)
			}
			if row.request >= row.points && (c.nightsoulState.Points() != 0 || c.nightsoulState.HasBlessing()) {
				t.Fatalf("terminal consumption must preserve the original exit/clear behavior")
			}
		})
	}
}

func TestIansanC1ConsumptionEnergyCapAndNoER(t *testing.T) {
	for _, before := range []float64{0, 68} {
		c, _ := c1ConsumptionFixture(t, 1, 54)
		c.BaseStats[attributes.ER] = 2
		c.Energy = before
		c.reduceNightsoulPoints(6)
		want := math.Min(before+15, 70)
		if c.Energy != want {
			t.Fatalf("fixed C1 energy at 200%% ER: %v, want %v", c.Energy, want)
		}
	}
}

func TestIansanC1EnergyReadyAndDelayedSpend(t *testing.T) {
	c, s := c1ConsumptionFixture(t, 1, 54)
	if ok, why := c.ActionReady(action.ActionBurst, nil); ok || why != action.InsufficientEnergy {
		t.Fatalf("zero energy must fail readiness: %v/%v", ok, why)
	}
	c.Energy = 70
	if ok, why := c.ActionReady(action.ActionBurst, nil); !ok {
		t.Fatalf("full energy and unused CD must be ready: %v", why)
	}
	c.SetCD(action.ActionBurst, 18*60)
	if ok, why := c.ActionReady(action.ActionBurst, nil); ok || why != action.BurstCD {
		t.Fatalf("full energy does not bypass Q cooldown: %v/%v", ok, why)
	}
	c.ConsumeEnergy(6)
	for frame := 1; frame <= 6; frame++ {
		s.F = frame
		s.Tasks.Run()
		if frame < 6 && c.Energy != 70 {
			t.Fatalf("Q energy was spent before its six-frame delay")
		}
	}
	if c.Energy != 0 {
		t.Fatalf("Q must spend its 70 at frame six, got %v", c.Energy)
	}
}
