package info

// SourceHostTargetPhaseAxes are scenario gates for one declared target.
// They are not inferred from a monster's native mechanics.
type SourceHostTargetPhaseAxes struct {
	Damage     string `json:"damage"`
	Aura       string `json:"aura"`
	HitConfirm string `json:"hitConfirm"`
}

type SourceHostTargetPhase struct {
	ID          string                    `json:"id"`
	Label       string                    `json:"label"`
	TargetIndex int                       `json:"targetIndex"`
	TargetKey   int                       `json:"targetKey,omitempty"`
	StartFrame  int                       `json:"startFrame"`
	EndFrame    int                       `json:"endFrame"`
	Reason      string                    `json:"reason"`
	Effects     SourceHostTargetPhaseAxes `json:"effects"`
}

// SourceHostTargetPhaseMatch freezes the exact row at the target's hit frame.
// Anonymous embedding preserves the row's flat JSON shape.
type SourceHostTargetPhaseMatch struct {
	SourceHostTargetPhase
	Policy string `json:"policy"`
	Frame  int    `json:"frame"`
}

type SourceHostTargetPhaseEffectsReceipt struct {
	HitCallbacksSkipped           int `json:"hitCallbacksSkipped"`
	OnEnemyHitGameplaySkipped     int `json:"onEnemyHitGameplaySkipped"`
	OnEnemyHitObserversEmitted    int `json:"onEnemyHitObserversEmitted"`
	OnEnemyDamageGameplaySkipped  int `json:"onEnemyDamageGameplaySkipped"`
	OnEnemyDamageObserversEmitted int `json:"onEnemyDamageObserversEmitted"`
}
