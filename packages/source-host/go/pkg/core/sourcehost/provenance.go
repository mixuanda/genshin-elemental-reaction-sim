package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/attributes"
	"github.com/genshinsim/gcsim/pkg/core/info"
)

// CopyStats copies values only. It never calls a character getter or modifier.
func CopyStats(values []float64) []float64 {
	if values == nil { return nil }
	return append([]float64{}, values...)
}

// AppendAttackStatRead isolates target-specific receipts after Combat copies an
// AttackEvent by value. The original snapshot and completed reads stay immutable.
func AppendAttackStatRead(snapshot *info.Snapshot, read *info.SourceHostStatRead) {
	if read == nil { return }
	next := info.SourceHostStatProvenance{Version: "stat-provenance-v1"}
	if previous := snapshot.SourceHostStatProvenance; previous != nil {
		next.SnapshotRead = previous.SnapshotRead
		next.AttackReads = append([]*info.SourceHostStatRead{}, previous.AttackReads...)
	}
	next.AttackReads = append(next.AttackReads, read)
	snapshot.SourceHostStatProvenance = &next
}

// StatProvenanceFields freezes the actual snapshot endpoint. Differences from
// the last recorded read are observed opaque mutations, never invented buffs.
func StatProvenanceFields(snapshot info.Snapshot) *info.SourceHostStatProvenance {
	previous := snapshot.SourceHostStatProvenance
	if previous == nil { return nil }
	next := *previous
	next.AttackReads = append([]*info.SourceHostStatRead{}, previous.AttackReads...)
	next.FinalStats = snapshot.Stats
	return &next
}

// AttackNumericChanges observes direct mutations made by the one original
// Amount invocation. These differences do not describe the closure's formula.
func AttackNumericChanges(before, after info.AttackInfo) []info.SourceHostNumericChange {
	changes := []info.SourceHostNumericChange{}
	add := func(field string, a, b float64) {
		if a != b { changes = append(changes, info.SourceHostNumericChange{Field: field, Before: a, After: b}) }
	}
	add("Mult", before.Mult, after.Mult)
	add("FlatDmg", before.FlatDmg, after.FlatDmg)
	add("BaseDmgBonus", before.BaseDmgBonus, after.BaseDmgBonus)
	add("Elevation", before.Elevation, after.Elevation)
	add("IgnoreDefPercent", before.IgnoreDefPercent, after.IgnoreDefPercent)
	add("Element", float64(before.Element), float64(after.Element))
	add("AttackTag", float64(before.AttackTag), float64(after.AttackTag))
	return changes
}

func NewStatProvenance(snapshotRead *info.SourceHostStatRead) *info.SourceHostStatProvenance {
	if snapshotRead == nil { return nil }
	return &info.SourceHostStatProvenance{
		Version: "stat-provenance-v1", SnapshotRead: snapshotRead,
		AttackReads: []*info.SourceHostStatRead{}, FinalStats: attributes.Stats(snapshotRead.Result),
	}
}
