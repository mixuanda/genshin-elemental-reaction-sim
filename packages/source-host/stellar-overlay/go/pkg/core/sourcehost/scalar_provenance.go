package sourcehost

import (
	"fmt"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

func (b *Bridge) NewScalarRead(kind string, base float64, actor, target *int, element string) *info.SourceHostScalarRead {
	b.scalarSequence++
	return &info.SourceHostScalarRead{
		ID: fmt.Sprintf("scalar-read-%d", b.scalarSequence), Kind: kind, Frame: *b.Frame,
		ActorIndex: actor, TargetKey: target, Element: element, Base: base, Sum: base, Output: base,
		Steps: []*info.SourceHostScalarStep{}, Transforms: []info.SourceHostScalarTransform{},
	}
}

func NewScalarStep(read *info.SourceHostScalarRead, key string, expiry int, hitlag bool, before float64, element string, opaque bool) *info.SourceHostScalarStep {
	if read == nil { return nil }
	step := &info.SourceHostScalarStep{
		Index: len(read.Steps), Key: key, ExpiryBefore: expiry, ExpiryAfter: expiry,
		AffectedByHitlag: hitlag, Element: element, ClosureOpaque: opaque,
		Before: before, After: before, Dependencies: []*info.SourceHostStatRead{},
	}
	read.Steps = append(read.Steps, step)
	return step
}

func FinishScalarStep(step *info.SourceHostScalarStep, outcome string, delta *float64, after float64, expiry int) {
	if step == nil { return }
	step.Outcome, step.After, step.ExpiryAfter = outcome, after, expiry
	if delta != nil {
		// ResistMod.Value can later change. Store the observed value, not its address.
		value := *delta
		step.Delta = &value
	}
}

// RecordScalarMin only records the min already evaluated at the source call
// site; it never applies another clamp to combat state.
func RecordScalarMin(read *info.SourceHostScalarRead, before, limit, after float64) {
	if read == nil { return }
	read.Transforms = append(read.Transforms, info.SourceHostScalarTransform{Kind: "min", Before: before, Limit: limit, After: after})
	read.Output = after
}

func ScalarProvenance(reads ...*info.SourceHostScalarRead) *info.SourceHostScalarProvenance {
	values := []*info.SourceHostScalarRead{}
	for _, read := range reads {
		if read != nil { values = append(values, read) }
	}
	if len(values) == 0 { return nil }
	return &info.SourceHostScalarProvenance{Version: "scalar-provenance-v1", Reads: values}
}

// The optional interface returns the record produced by this exact call. The
// fallback preserves non-host implementations and still invokes ReactBonus once.
func ReadReactionBonus(source interface { ReactBonus(info.AttackInfo) float64 }, attack info.AttackInfo) (float64, *info.SourceHostScalarRead) {
	if provider, ok := source.(interface { ReactBonusWithProvenance(info.AttackInfo) (float64, *info.SourceHostScalarRead) }); ok {
		return provider.ReactBonusWithProvenance(attack)
	}
	return source.ReactBonus(attack), nil
}
