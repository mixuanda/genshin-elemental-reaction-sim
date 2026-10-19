package sourcehost

import "github.com/genshinsim/gcsim/pkg/core/info"

// RecordStatusAdded is called after modifier.Add, so NativeOverwrite is the
// source modifier library's actual result, including its equal-frame rule.
func (b *Bridge) RecordStatusAdded(owner *info.SourceHostStatusOwner, expiry int, overwrote bool, previous *info.SourceHostStatusOwner, previousExpiry int) {
	if previous != nil {
		b.recordStatusEnd(previous, "replaced", previousExpiry, owner.InstanceID)
	}
	b.StatusInstances = append(b.StatusInstances, StatusInstance{
		ActorIndex: owner.ActorIndex, StatusKey: owner.StatusKey,
		InstanceID: owner.InstanceID, CreatedFrame: owner.CreatedFrame,
		CreationActionSequence: owner.CreationActionSequence,
		InitialExpiryFrame:     expiry, FinalExpiryFrame: expiry,
		EndState: "unknown-at-end", EndFrame: *b.Frame,
		NativeOverwrite: overwrote,
	})
	b.statusInstanceRows[owner.InstanceID] = len(b.StatusInstances) - 1
}

func (b *Bridge) recordStatusEnd(owner *info.SourceHostStatusOwner, state string, expiry, successor int) {
	if owner == nil {
		return
	}
	index, ok := b.statusInstanceRows[owner.InstanceID]
	if !ok {
		return
	}
	row := &b.StatusInstances[index]
	row.EndState, row.EndFrame, row.FinalExpiryFrame = state, *b.Frame, expiry
	if successor > 0 {
		id := successor
		row.ReplacedByInstanceID = &id
	}
}

func (b *Bridge) RecordStatusReplaced(owner *info.SourceHostStatusOwner, expiry int) {
	b.recordStatusEnd(owner, "replaced", expiry, 0)
}

func (b *Bridge) RecordStatusRemoved(owner *info.SourceHostStatusOwner, expiry int) {
	b.recordStatusEnd(owner, "removed", expiry, 0)
}

// ObserveLiveStatus reads the retained Status object's actual expiry after all
// native hitlag/ExtendStatus changes. FindCheckExpiry uses expiry < frame.
func (b *Bridge) ObserveLiveStatus(owner *info.SourceHostStatusOwner, expiry int) {
	if owner == nil {
		return
	}
	index, ok := b.statusInstanceRows[owner.InstanceID]
	if !ok {
		return
	}
	row := &b.StatusInstances[index]
	row.FinalExpiryFrame, row.EndFrame = expiry, *b.Frame
	if expiry == -1 || expiry >= *b.Frame {
		row.EndState = "active-at-end"
	} else {
		row.EndState = "expired-at-end"
	}
}

// FinalizeStatusInstances leaves any unobserved object explicitly unknown.
func (b *Bridge) FinalizeStatusInstances() {
	for i := range b.StatusInstances {
		if b.StatusInstances[i].EndState == "unknown-at-end" {
			b.StatusInstances[i].EndFrame = *b.Frame
		}
	}
}
