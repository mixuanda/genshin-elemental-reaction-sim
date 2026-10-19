package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// TalentIndex preserves the original nested slice-index evaluation order. It
// records the already evaluated index and performs exactly one original read.
func TalentIndex[T any](read *info.SourceHostTalentTableRead, values []T, index int) T {
	value := values[index]
	read.Indices = append(read.Indices, index)
	return value
}

// TalentRangeRows marks when the original range expression finished evaluating.
// The returned slice is the original range operand, without another table read.
func TalentRangeRows[T any](read *info.SourceHostTalentTableRead, rows []T, frame *int) []T {
	read.Frame = *frame
	return rows
}

// TalentRangeReceipt copies an immutable range prefix for one iteration's
// coefficient read; the implicit range key is an actual generated-table index.
func TalentRangeReceipt(prefix *info.SourceHostTalentTableRead, rowIndex int) info.SourceHostTalentTableRead {
	indices := append([]int{}, prefix.Indices...)
	indices = append(indices, rowIndex)
	indexSources := append([]info.SourceHostTalentIndexSource{}, prefix.IndexSources...)
	frame := prefix.Frame
	return info.SourceHostTalentTableRead{Indices: indices, IndexSources: indexSources, RangeFrame: &frame}
}

// TalentCoefficient records the final scalar at the actual lookup point. It
// allocates no formula or attack ID and does not read any character stat.
func TalentCoefficient(read *info.SourceHostTalentTableRead, values []float64, index, frame int, tableID, siteID string) float64 {
	value := values[index]
	read.Indices = append(read.Indices, index)
	read.SchemaVersion = 1
	read.TableID = tableID
	read.Value = value
	read.Frame = frame
	read.SiteID = siteID
	return value
}

// TalentExpression observes the fully evaluated original operation tree.
// Dereferencing frame in the function body places the stamp after every
// operand evaluation, including stateful index getter calls.
func TalentExpression(read *info.SourceHostTalentExpressionRead, value float64, frame *int, siteID string) float64 {
	read.SchemaVersion = 1
	read.SiteID = siteID
	read.Value = value
	read.Frame = *frame
	return value
}
