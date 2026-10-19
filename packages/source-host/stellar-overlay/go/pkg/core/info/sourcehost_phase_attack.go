package info

import "fmt"

// SourceHostPhaseAttackInfo keeps every native combat field and copies its slice.
// SourceHost fields record prior reads; they do not determine native damage.
func SourceHostPhaseAttackInfo(a AttackInfo) AttackInfo {
	a.AdditionalTags = append(a.AdditionalTags[:0:0], a.AdditionalTags...)
	a.SourceHostComponents = nil
	a.SourceHostMultiplierID = 0
	a.SourceHostTalentTableRead = nil
	a.SourceHostTalentExpressionRead = nil
	return a
}

// Snapshot age is gameplay state: Amos and Slingshot read the native frame.
// Logs and source-host provenance describe prior reads, not future combat.
func SourceHostPhaseSnapshot(s Snapshot, frame int) map[string]any {
	return map[string]any{"stats": s.Stats, "characterLevel": s.CharLvl, "sourceAgeFrames": frame - s.SourceFrame}
}

func (a *AttackEvent) SourceHostPhaseState(frame int) (map[string]any, []string) {
	var shape any
	gaps := []string{}
	switch value := a.Pattern.Shape.(type) {
	case *Circle:
		shape, _ = value.SourceHostPhaseState()
	case *Rectangle:
		shape = map[string]any{"kind": "rectangle", "center": value.center, "spawn": value.spawn,
			"width": value.w, "height": value.h, "direction": value.dir,
			"corners": append([]Point{}, value.corners...), "aabb": append([]Point{}, value.aabb...)}
	case *SingleTarget:
		shape = map[string]any{"kind": "single-target", "targetKey": value.Target}
	default:
		shape = map[string]any{"implementation": fmt.Sprintf("%T", a.Pattern.Shape)}
		gaps = append(gaps, "attack collision shape lacks a reviewed phase exporter")
	}
	callbacks := make([]bool, len(a.Callbacks))
	for index, callback := range a.Callbacks {
		callbacks[index] = callback != nil
		if callback != nil {
			gaps = append(gaps, fmt.Sprintf("attack callback[%d] has undescribed captured state", index))
		}
	}
	return map[string]any{
		"info": SourceHostPhaseAttackInfo(a.Info), "snapshot": SourceHostPhaseSnapshot(a.Snapshot, frame),
		"sourceAgeFrames": frame - a.SourceFrame, "reacted": a.Reacted,
		"pattern": map[string]any{"shape": shape, "skipTargets": a.Pattern.SkipTargets,
			"ignoredKeys": append([]TargetKey{}, a.Pattern.IgnoredKeys...)}, "callbacks": callbacks,
	}, gaps
}
