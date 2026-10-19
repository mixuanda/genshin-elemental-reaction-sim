package info

// SourceHostTaskQueue identifies one native task.Handler and its local clock.
type SourceHostTaskQueue struct {
	ID         int    `json:"id"`
	Kind       string `json:"kind"`
	ActorIndex *int   `json:"actorIndex,omitempty"`
	TargetKey  *int   `json:"targetKey,omitempty"`
	Clock      int    `json:"clock"`
}

// SourceHostTask records one actual heap entry, not an inferred skill outcome.
type SourceHostTask struct {
	ID             int              `json:"id"`
	ParentTaskID   int              `json:"parentTaskId,omitempty"`
	QueueID        int              `json:"queueId"`
	QueuedFrame    int              `json:"queuedFrame"`
	QueuedClock    int              `json:"queuedClock"`
	DueClock       int              `json:"dueClock"`
	RunFrame       *int             `json:"runFrame,omitempty"`
	CompletedFrame *int             `json:"completedFrame,omitempty"`
	State          string           `json:"state"`
	Origin         SourceHostOrigin `json:"origin"`
	Key            string           `json:"key,omitempty"`
}

type SourceHostTaskLifecycle struct {
	SchemaVersion    int                   `json:"schemaVersion"`
	ObservationFrame int                   `json:"observationFrame"`
	Queues           []SourceHostTaskQueue `json:"queues"`
	Tasks            []SourceHostTask      `json:"tasks"`
}

// SourceHostTaskTracker is observational. Handler heap order and task IDs stay native.
type SourceHostTaskTracker struct {
	Frame        *int
	Origin       *SourceHostOriginTracker
	queues       []SourceHostTaskQueue
	queueClocks  []*int
	tasks        []SourceHostTask
	activeTaskID int
}

func NewSourceHostTaskTracker(frame *int, origin *SourceHostOriginTracker) *SourceHostTaskTracker {
	return &SourceHostTaskTracker{Frame: frame, Origin: origin, queues: []SourceHostTaskQueue{}, tasks: []SourceHostTask{}}
}

func (t *SourceHostTaskTracker) RegisterQueue(kind string, clock *int) int {
	id := len(t.queues) + 1
	t.queues = append(t.queues, SourceHostTaskQueue{ID: id, Kind: kind})
	t.queueClocks = append(t.queueClocks, clock)
	return id
}

func (t *SourceHostTaskTracker) SetActor(queueID, actorIndex int) {
	t.queues[queueID-1].ActorIndex = &actorIndex
}

func (t *SourceHostTaskTracker) SetTarget(queueID, targetKey int) {
	t.queues[queueID-1].TargetKey = &targetKey
}

func (t *SourceHostTaskTracker) Schedule(queueID, queuedClock, dueClock int, key string) int {
	id := len(t.tasks) + 1
	origin := SourceHostOrigin{Via: "unassigned"}
	if t.Origin != nil {
		origin = t.Origin.CaptureForChild()
	}
	t.tasks = append(t.tasks, SourceHostTask{
		ID: id, ParentTaskID: t.activeTaskID, QueueID: queueID,
		QueuedFrame: *t.Frame, QueuedClock: queuedClock, DueClock: dueClock,
		State: "pending", Origin: origin, Key: key,
	})
	return id
}

func (t *SourceHostTaskTracker) Begin(id int) func() {
	previous := t.activeTaskID
	t.activeTaskID = id
	frame := *t.Frame
	t.tasks[id-1].RunFrame = &frame
	return func() {
		frame := *t.Frame
		row := &t.tasks[id-1]
		row.CompletedFrame = &frame
		row.State = "completed"
		t.activeTaskID = previous
	}
}

func (t *SourceHostTaskTracker) Snapshot() SourceHostTaskLifecycle {
	queues := append([]SourceHostTaskQueue{}, t.queues...)
	for i, clock := range t.queueClocks {
		queues[i].Clock = *clock
	}
	return SourceHostTaskLifecycle{
		SchemaVersion: 1, ObservationFrame: *t.Frame,
		Queues: queues, Tasks: append([]SourceHostTask{}, t.tasks...),
	}
}

// LastScheduledID reports the task ID just assigned by the native Add call.
func (t *SourceHostTaskTracker) LastScheduledID() int { return len(t.tasks) }
