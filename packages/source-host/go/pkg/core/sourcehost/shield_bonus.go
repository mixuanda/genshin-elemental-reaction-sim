package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/info"
	"github.com/genshinsim/gcsim/pkg/core/player/shield"
)

// ShieldBonusCallbacks gives the shield package access to receipts without a
// shield -> sourcehost import cycle. All closures run synchronously in Go.
func (b *Bridge) ShieldBonusCallbacks() shield.SourceHostBonusCallbacks {
	return shield.SourceHostBonusCallbacks{
		BeginDamage: b.beginShieldBonusDamage,
		EndDamage:   b.endShieldBonusDamage,
		NewRead: func() *info.SourceHostScalarRead {
			return b.NewScalarRead("shield-bonus", 0, nil, nil, "")
		},
		CompleteRead: b.completeShieldBonusRead,
		BeginStep:    func(step *info.SourceHostScalarStep) { b.BeginScalarFormulaStep(step) },
		EndStep:      b.EndScalarFormulaStep,
	}
}

// A player hit can synchronously trigger another hit. Each shield handler call
// owns its read until its last shield request finishes, then restores its
// caller's read instead of leaving a global last-read value behind.
func (b *Bridge) beginShieldBonusDamage() {
	b.shieldBonusStack = append(b.shieldBonusStack, b.shieldBonusRead)
	b.shieldBonusRead = nil
}

func (b *Bridge) endShieldBonusDamage() {
	n := len(b.shieldBonusStack)
	if n == 0 {
		panic("source-host shield bonus scope ended without a matching begin")
	}
	b.shieldBonusRead = b.shieldBonusStack[n-1]
	b.shieldBonusStack = b.shieldBonusStack[:n-1]
}

func (b *Bridge) completeShieldBonusRead(read *info.SourceHostScalarRead) {
	b.shieldBonusRead = read
}
