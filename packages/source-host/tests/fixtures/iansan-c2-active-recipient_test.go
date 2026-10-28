// Copy into an independently copied, pinned a7 Stellar source tree under
// internal/characters/iansan. This invokes the real core, native character
// constructors, StatMod Amount callbacks and snapshot implementation.
package iansan

import (
	"math"
	"testing"

	"github.com/genshinsim/gcsim/internal/characters/kaeya"
	"github.com/genshinsim/gcsim/pkg/core"
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/keys"
	"github.com/genshinsim/gcsim/pkg/core/player/character"
)

func c2ActiveRecipientFixture(t *testing.T, cons, ascension int) (*char, *character.CharWrapper, *core.Core) {
	t.Helper()
	s, err := core.New(core.Opt{Seed: 20261023})
	if err != nil {
		t.Fatal(err)
	}
	var owner *char
	var teammate *character.CharWrapper
	for _, key := range []keys.Char{keys.Iansan, keys.Kaeya} {
		p := info.CharacterProfile{
			Base:    info.CharacterBase{Key: key, Element: attributes.Cryo, Level: 90, MaxLevel: 90},
			Talents: info.TalentProfile{Attack: 1, Skill: 1, Burst: 1},
			Stats:   make([]float64, attributes.EndStatType),
		}
		p.Stats[attributes.BaseATK] = 400
		p.Stats[attributes.ATKP] = 0.25
		p.Stats[attributes.ATK] = 100
		if key == keys.Iansan {
			p.Base.Element = attributes.Electro
			p.Base.Cons = cons
			p.Base.Ascension = ascension
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
	// Isolate the actual A1/C2 producers. No Q movement, energy, weapon,
	// artifact, enemy, resource timeline or other team buff is synthesized.
	owner.a1Init()
	owner.c2Init()
	return owner, teammate, s
}

func c2RequireATK(t *testing.T, recipient *character.CharWrapper, percent, total float64) {
	t.Helper()
	if got := recipient.Stat(attributes.ATKP); math.Abs(got-percent) > 1e-12 {
		t.Errorf("native ATKP=%v, want %v", got, percent)
	}
	if got := recipient.TotalAtk(); math.Abs(got-total) > 1e-10 {
		t.Errorf("native TotalAtk=%v, want %v", got, total)
	}
}

// This exact test compiles and fails numerically before patch140. The original
// gate incorrectly returns +0.30 ATKP / +120 ATK to the off-field teammate.
func TestIansanC2RejectsOffFieldRecipient(t *testing.T) {
	c, teammate, s := c2ActiveRecipientFixture(t, 2, 1)
	c.c2OnBurst()
	s.Player.SetActive(c.Index())
	c2RequireATK(t, teammate, 0.25, 600)
	ai := info.AttackInfo{ActorIndex: teammate.Index(), Abil: "C2 off-field snapshot", IgnoreInfusion: true}
	if snap := teammate.Snapshot(&ai); math.Abs(snap.Stats.TotalATK()-600) > 1e-10 {
		t.Errorf("off-field snapshot ATK=%v, want600", snap.Stats.TotalATK())
	}
}

func TestIansanC2ActiveRecipientAndOwner(t *testing.T) {
	for _, cons := range []int{2, 6} {
		t.Run(map[int]string{2: "C2", 6: "C6"}[cons], func(t *testing.T) {
			c, teammate, s := c2ActiveRecipientFixture(t, cons, 1)
			s.Player.SetActive(teammate.Index())
			c2RequireATK(t, teammate, 0.25, 600) // no active Precise Movement
			c.c2OnBurst()                        // the actual C2 Q-start producer grants native A1
			c2RequireATK(t, teammate, 0.55, 720)
			c2RequireATK(t, c.CharWrapper, 0.45, 680) // own A1 only, never C2
			s.Player.SetActive(c.Index())
			c2RequireATK(t, c.CharWrapper, 0.45, 680)
			c2RequireATK(t, teammate, 0.25, 600)
			s.Player.SetActive(teammate.Index())
			c2RequireATK(t, teammate, 0.55, 720) // live recipient changes, no regrant
		})
	}
}

func TestIansanC2RecipientUnlocks(t *testing.T) {
	for _, row := range []struct{ cons, ascension int }{{0, 1}, {1, 1}, {2, 0}} {
		c, teammate, s := c2ActiveRecipientFixture(t, row.cons, row.ascension)
		s.Player.SetActive(teammate.Index())
		c.a1AddBuff()
		c2RequireATK(t, teammate, 0.25, 600)
	}
}

func TestIansanC2RecipientA1ExpiryAndExit(t *testing.T) {
	t.Run("existingA1ExpiryGate", func(t *testing.T) {
		c, teammate, s := c2ActiveRecipientFixture(t, 2, 1)
		c.c2OnBurst()
		s.Player.SetActive(teammate.Index())
		s.F = 899
		c2RequireATK(t, teammate, 0.55, 720)
		// Retain native StatModIsActive semantics; patch140 does not redefine
		// the existing modifier manager's equality-at-expiry convention.
		s.F = 901
		c2RequireATK(t, teammate, 0.25, 600)
	})
	t.Run("actualNightsoulExitRemovesA1", func(t *testing.T) {
		c, teammate, s := c2ActiveRecipientFixture(t, 2, 1)
		c.c2OnBurst()
		s.Player.SetActive(teammate.Index())
		c2RequireATK(t, teammate, 0.55, 720)
		c.exitNightsoul()
		c2RequireATK(t, teammate, 0.25, 600)
	})
}

func TestIansanC2RecipientPreservesAlreadyMadeSnapshot(t *testing.T) {
	c, teammate, s := c2ActiveRecipientFixture(t, 2, 1)
	c.c2OnBurst()
	s.Player.SetActive(teammate.Index())
	ai := info.AttackInfo{ActorIndex: teammate.Index(), Abil: "C2 active snapshot", IgnoreInfusion: true}
	snap := teammate.Snapshot(&ai)
	if math.Abs(snap.Stats.TotalATK()-720) > 1e-10 {
		t.Fatalf("active native snapshot ATK=%v, want720", snap.Stats.TotalATK())
	}
	s.Player.SetActive(c.Index())
	c2RequireATK(t, teammate, 0.25, 600)
	s.F = 901
	if math.Abs(snap.Stats.TotalATK()-720) > 1e-10 || snap.SourceFrame != 0 {
		t.Fatalf("swap/expiry rewrote the already made snapshot: ATK=%v frame=%d", snap.Stats.TotalATK(), snap.SourceFrame)
	}
	newSnap := teammate.Snapshot(&ai)
	if math.Abs(newSnap.Stats.TotalATK()-600) > 1e-10 || newSnap.SourceFrame != 901 {
		t.Fatalf("new off-field snapshot ATK=%v frame=%d, want600/901", newSnap.Stats.TotalATK(), newSnap.SourceFrame)
	}
}
