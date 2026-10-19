package info

// SourceHostTalentTableRead is a historical observation of one generated
// coefficient lookup. The table itself is supplied by the pinned source
// registry, never by a runtime request.
type SourceHostTalentTableRead struct {
	SchemaVersion int                           `json:"schemaVersion"`
	TableID       string                        `json:"tableId"`
	Indices       []int                         `json:"indices"`
	IndexSources  []SourceHostTalentIndexSource `json:"indexSources,omitempty"`
	Value         float64                       `json:"value"`
	ActorIndex    int                           `json:"actorIndex"`
	Frame         int                           `json:"frame"`
	RangeFrame    *int                          `json:"rangeFrame,omitempty"`
	SiteID        string                        `json:"siteId"`
}

// SourceHostTalentIndexSource records the real inputs to one native talent
// level getter used as a generated-table index. Position is zero based.
type SourceHostTalentIndexSource struct {
	Position            int    `json:"position"`
	Kind                string `json:"kind"`
	BaseTalent          int    `json:"baseTalent"`
	Constellation       int    `json:"constellation"`
	ConstellationUnlock int    `json:"constellationUnlock"`
	PassiveTagValue     *int   `json:"passiveTagValue,omitempty"`
	Value               int    `json:"value"`
}

// SourceHostTalentExpressionRead holds the actual scalar result and the
// independent generated-table leaves consumed by one native Go expression.
type SourceHostTalentExpressionRead struct {
	SchemaVersion int                         `json:"schemaVersion"`
	SiteID        string                      `json:"siteId"`
	Reads         []SourceHostTalentTableRead `json:"reads"`
	Value         float64                     `json:"value"`
	ActorIndex    int                         `json:"actorIndex"`
	Frame         int                         `json:"frame"`
}
