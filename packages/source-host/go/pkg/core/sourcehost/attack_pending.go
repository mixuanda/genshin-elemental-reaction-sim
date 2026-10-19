package sourcehost

import (
	"github.com/genshinsim/gcsim/pkg/core/info"
	"sort"
)

// ScheduleAttackStage tracks only a real core task. This is independent of
// AttackID, which remains assigned by PrepareAttack at its original time.
func (b *Bridge) ScheduleAttackStage(a *info.AttackEvent, stage string, delay int) int {
	b.pendingAttackSequence++
	id := b.pendingAttackSequence
	b.pendingAttackTasks[id] = pendingAttackStage{
		row: PendingAttackStage{ID: id, Stage: stage, QueuedFrame: *b.Frame,
			DueFrame: *b.Frame + delay, Origin: b.AttackOrigin(a)},
		attack: a,
	}
	return id
}

func (b *Bridge) BeginAttackStage(id int) { delete(b.pendingAttackTasks, id) }

// FinalizePendingAttackStages reports tasks still scheduled at the actual end
// of the observation window. A reused AttackEvent can have multiple stages.
func (b *Bridge) FinalizePendingAttackStages() {
	ids := make([]int, 0, len(b.pendingAttackTasks))
	for id := range b.pendingAttackTasks {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	for _, id := range ids {
		stage := b.pendingAttackTasks[id]
		row := stage.row
		if stage.attack.SourceHostAttackID > 0 {
			attackID := stage.attack.SourceHostAttackID
			row.AttackID = &attackID
		}
		b.PendingAttackStages = append(b.PendingAttackStages, row)
	}
}
