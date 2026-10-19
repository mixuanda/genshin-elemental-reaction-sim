package action

import (
	"testing"

	"github.com/genshinsim/gcsim/pkg/core/phase"
)

func TestSourceHostQueuedActionPhaseLifecycle(t *testing.T) {
	var opaqueRuns, describedRuns, observations int
	liveValue := "before"
	savedValue := liveValue

	var a Info
	a.AnimationLength = 100
	a.QueueAction(func() { opaqueRuns++ }, 3)
	a.QueueActionWithPhase(func() { describedRuns++ }, 2, phase.Descriptor{
		Source: "test/queued-action",
		Observe: func() (map[string]any, []string) {
			observations++
			return map[string]any{"saved": savedValue, "live": liveValue}, nil
		},
	})

	readState := func() (map[string]any, []string) {
		t.Helper()
		state, gaps := a.SourceHostPhaseState()
		return state, gaps
	}
	rows := func(state map[string]any) []map[string]any {
		t.Helper()
		got, ok := state["queuedActions"].([]map[string]any)
		if !ok {
			t.Fatalf("queuedActions has type %T, want []map[string]any", state["queuedActions"])
		}
		return got
	}
	remaining := func(row map[string]any) float64 {
		t.Helper()
		got, ok := row["remainingTime"].(float64)
		if !ok {
			t.Fatalf("remainingTime has type %T, want float64", row["remainingTime"])
		}
		return got
	}

	state, gaps := readState()
	initial := rows(state)
	if len(initial) != 2 || remaining(initial[0]) != 3 || remaining(initial[1]) != 2 {
		t.Fatalf("initial queue order/remain: %#v", initial)
	}
	if _, ok := initial[0]["source"]; ok {
		t.Fatalf("legacy QueueAction unexpectedly acquired a descriptor: %#v", initial[0])
	}
	if _, ok := initial[0]["captured"]; ok {
		t.Fatalf("legacy QueueAction unexpectedly acquired captured values: %#v", initial[0])
	}
	if got := initial[1]["source"]; got != "test/queued-action" {
		t.Fatalf("descriptor source = %v", got)
	}
	captured, ok := initial[1]["captured"].(map[string]any)
	if !ok || captured["saved"] != "before" || captured["live"] != "before" {
		t.Fatalf("initial captured values = %#v", initial[1]["captured"])
	}
	if len(gaps) != 1 || gaps[0] != "animation queued action callbacks" {
		t.Fatalf("opaque callback gap = %v", gaps)
	}
	if opaqueRuns != 0 || describedRuns != 0 || a.TimePassed != 0 || a.NormalizedTimePassed != 0 {
		t.Fatalf("observation advanced execution: callbacks=(%d,%d), time=(%v,%v)", opaqueRuns, describedRuns, a.TimePassed, a.NormalizedTimePassed)
	}

	liveValue = "after"
	state, gaps = readState()
	updated := rows(state)
	updatedCapture := updated[1]["captured"].(map[string]any)
	if captured["live"] != "before" || updatedCapture["saved"] != "before" || updatedCapture["live"] != "after" {
		t.Fatalf("saved/live capture after source change = %#v", updatedCapture)
	}
	if observations != 2 || opaqueRuns != 0 || describedRuns != 0 {
		t.Fatalf("observing descriptor ran queued callback: observations=%d callbacks=(%d,%d)", observations, opaqueRuns, describedRuns)
	}

	if done := a.Tick(); done {
		t.Fatal("animation ended before its configured length")
	}
	state, _ = readState()
	afterOneTick := rows(state)
	if len(afterOneTick) != 2 || remaining(afterOneTick[0]) != 2 || remaining(afterOneTick[1]) != 1 {
		t.Fatalf("queue after first tick: %#v", afterOneTick)
	}
	if opaqueRuns != 0 || describedRuns != 0 {
		t.Fatalf("callbacks ran before their delay: (%d,%d)", opaqueRuns, describedRuns)
	}

	if done := a.Tick(); done {
		t.Fatal("animation ended before its configured length")
	}
	if opaqueRuns != 0 || describedRuns != 1 {
		t.Fatalf("callbacks after described entry completed: opaque=%d described=%d", opaqueRuns, describedRuns)
	}
	state, gaps = readState()
	afterDescribed := rows(state)
	if len(afterDescribed) != 1 || remaining(afterDescribed[0]) != 1 || afterDescribed[0]["source"] != nil {
		t.Fatalf("described entry was not removed with its callback: %#v", afterDescribed)
	}
	if len(gaps) != 1 || gaps[0] != "animation queued action callbacks" {
		t.Fatalf("opaque callback gap should remain until its callback runs: %v", gaps)
	}

	if done := a.Tick(); done {
		t.Fatal("animation ended before its configured length")
	}
	if opaqueRuns != 1 || describedRuns != 1 {
		t.Fatalf("callbacks after opaque entry completed: opaque=%d described=%d", opaqueRuns, describedRuns)
	}
	state, gaps = readState()
	if got := len(rows(state)); got != 0 {
		t.Fatalf("queue not empty after both callbacks completed: %d rows", got)
	}
	for _, gap := range gaps {
		if gap == "animation queued action callbacks" {
			t.Fatalf("opaque callback gap remained after queue emptied: %v", gaps)
		}
	}
}
