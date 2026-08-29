// Package engine is a 1:1 port of the solo prototype's rules engine
// (src/engine/{types,gameData,map,reducer,initialState}.ts) into Go, so it can be
// the server-authoritative engine for multiplayer games. It's a parallel
// implementation, not shared code — Go and TS can't share source directly — so
// this stays a deliberate line-by-line mirror of the TS, including its comments,
// to keep drift between the two visible and easy to catch in review. The TS
// engine is the one that's been checked box-by-box against the rulebook and the
// scanned sheet; changes to game rules should land there first and get ported
// here, not the other way around.
//
// JSON field names match the TS types exactly (they're already camelCase), so a
// GameState marshaled here is byte-compatible with what the TS client already
// knows how to render — the wire protocol for Phase 2's WebSocket sync is just
// this package's JSON, no separate schema.
package engine

type DieColor string

const (
	DieWhite DieColor = "white"
	DieGreen DieColor = "green"
	DieBlack DieColor = "black"
)

type Die struct {
	ID      string   `json:"id"`
	Color   DieColor `json:"color"`
	Value   int      `json:"value"` // 1-6 (or higher — MODIFY_DIE can push it past 6)
	UsedFor *DieUse  `json:"usedFor"`
}

// DieUse mirrors the TS discriminated union
//
//	{ kind: 'construction' } | { kind: 'activate'; building; boostTarget?; scienceTarget? }
//	| { kind: 'trade'; row } | { kind: 'culture'; row; col }
//
// as one flat struct with an omitted-when-irrelevant field per variant — the same
// shape a JS object literal for any one variant serializes to over the wire, just
// without the omitted keys being absent in the Go struct itself (unused fields sit
// at their zero value, which is harmless: code only reads the fields that matter
// for the current Kind).
type DieUse struct {
	Kind          string        `json:"kind"` // construction | activate | trade | culture
	Building      BuildingType  `json:"building,omitempty"`
	BoostTarget   BuildingType  `json:"boostTarget,omitempty"`
	ScienceTarget ScienceTarget `json:"scienceTarget,omitempty"`
	Row           int           `json:"row,omitempty"`
	Col           int           `json:"col,omitempty"`
}

const (
	UseConstruction = "construction"
	UseActivate     = "activate"
	UseTrade        = "trade"
	UseCulture      = "culture"
)

type BuildingType string

const (
	BuildingFarm     BuildingType = "farm"
	BuildingMine     BuildingType = "mine"
	BuildingSchool   BuildingType = "school"
	BuildingGarrison BuildingType = "garrison"
	BuildingColony   BuildingType = "colony"
	BuildingPalace   BuildingType = "palace"
)

type BuildingDef struct {
	ID               BuildingType `json:"id"`
	Name             string       `json:"name"`
	Level            int          `json:"level"` // 1 | 2 | 3
	LineCost         int          `json:"lineCost"`
	MinActivationDie int          `json:"minActivationDie"`
	ScorePerBuilding int          `json:"scorePerBuilding"`
	NeedsStaff       bool         `json:"needsStaff"`
}

// --- Map (rulebook p.4-5: buildings are drawn as squares on a dot-grid) ---

type Terrain string

const (
	TerrainWater     Terrain = "water"
	TerrainPlains    Terrain = "plains"
	TerrainMountains Terrain = "mountains"
)

type MapCoord struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type BarbarianSite struct {
	MapCoord
	Destroyed bool `json:"destroyed"`
}

type BuildingInstance struct {
	Type    BuildingType `json:"type"`
	Staffed bool         `json:"staffed"`
	Cell    MapCoord     `json:"cell"`
}

type Phase string

const (
	PhaseDice        Phase = "dice"
	PhaseDiplomacy   Phase = "diplomacy"
	PhaseDisasters   Phase = "disasters"
	PhaseDevelopment Phase = "development"
	PhaseDeployment  Phase = "deployment"
	PhaseGameOver    Phase = "gameover"
)

// PopulationSlot.State is "empty" | "worker" | BuildingType (when staffing that
// building type) — a free-form string in Go too, matching the TS union.
type PopulationSlot struct {
	State string `json:"state"`
}

const (
	SlotEmpty  = "empty"
	SlotWorker = "worker"
)

// --- Science (rulebook p.7: a shared trunk forking into 3 branches) ---
// Trunk (4 boxes, Irrigation) forks — once complete — into the "Philosophy" branch
// (upper, humanities) and an "Engineering approach" branch (Sailing, then itself
// forks into the "Engineering" branch and the "Walls & Iron" branch: middle/lower,
// natural sciences). Each of the 3 terminal branches ends in its own Mastery box.
type ScienceBranchID string

const (
	BranchPhilosophy          ScienceBranchID = "philosophy"
	BranchEngineeringApproach ScienceBranchID = "engineeringApproach"
	BranchEngineeringBranch   ScienceBranchID = "engineeringBranch"
	BranchWallsIron           ScienceBranchID = "wallsIron"
)

// ScienceTarget is "trunk" or a ScienceBranchID — kept as its own string type
// (rather than reusing ScienceBranchID) to mirror the TS `'trunk' | ScienceBranchId`
// union, and because a bare Go type alias can't add the "trunk" literal option.
type ScienceTarget string

const TargetTrunk ScienceTarget = "trunk"

func (t ScienceTarget) AsBranch() ScienceBranchID { return ScienceBranchID(t) }

type ScienceMilestone struct {
	Index int    `json:"index"` // 1-indexed position within its branch (or the trunk)
	Label string `json:"label"`
	Kind  string `json:"kind"`
}

const (
	MilestoneIrrigation   = "irrigation"
	MilestonePhilosophy   = "philosophy"
	MilestoneSailing      = "sailing"
	MilestoneEngineering  = "engineering"
	MilestoneWalls        = "walls"
	MilestoneIron         = "iron"
	MilestoneCultureBonus = "culture-bonus"
	MilestoneGoldBonus    = "gold-bonus"
	MilestoneMastery      = "mastery"
)

type CultureCell struct {
	Threshold int  `json:"threshold"`
	Filled    bool `json:"filled"`
}

type CultureRow struct {
	Cells     []*CultureCell `json:"cells"`
	Score     int            `json:"score"`
	Completed bool           `json:"completed"`
}

type TradeRow struct {
	Cells     []*CultureCell `json:"cells"`
	Completed bool           `json:"completed"`
}

type DisasterRow struct {
	DieValue        int    `json:"dieValue"` // 2-6 correspond to matched die faces; 1 is the special "any die showing 1" row
	Name            string `json:"name"`     // "" means null (no named disaster on this row)
	HasCultureBonus bool   `json:"hasCultureBonus"`
	Boxes           []bool `json:"boxes"` // length 3; 3rd box filling triggers the disaster
	Triggered       bool   `json:"triggered"`
}

type LogEntry struct {
	Round int    `json:"round"`
	Text  string `json:"text"`
}

type DiceUnlocked struct {
	White bool `json:"white"`
	Green bool `json:"green"`
	Black bool `json:"black"`
}

type GameState struct {
	Round            int          `json:"round"`
	MaxRounds        int          `json:"maxRounds"`
	Phase            Phase        `json:"phase"`
	Dice             []*Die       `json:"dice"`
	DiceUnlocked     DiceUnlocked `json:"diceUnlocked"`
	RerollsThisRound int          `json:"rerollsThisRound"`

	Population        []*PopulationSlot `json:"population"`
	GreatPersonTokens int               `json:"greatPersonTokens"`

	Gold         int `json:"gold"`
	GoldTrackMax int `json:"goldTrackMax"`

	MilitaryBoxes      []bool `json:"militaryBoxes"` // filled boxes; every 2 = one army
	DeployedThisRound  int    `json:"deployedThisRound"`
	BankedAttackPower  int    `json:"bankedAttackPower"`
	BankedDefensePower int    `json:"bankedDefensePower"`

	ScienceTrunkMarked  int                     `json:"scienceTrunkMarked"`
	ScienceBranchMarked map[ScienceBranchID]int `json:"scienceBranchMarked"`

	Buildings              []*BuildingInstance `json:"buildings"`
	DestroyedBuildingCells []*MapCoord         `json:"destroyedBuildingCells"`
	ConstructionPoints     int                 `json:"constructionPoints"`

	TradeRows      []*TradeRow   `json:"tradeRows"`
	CultureRows    []*CultureRow `json:"cultureRows"`
	CultureColumns []bool        `json:"cultureColumns"`

	BarbarianCamps      int              `json:"barbarianCamps"`
	BarbarianCampsTotal int              `json:"barbarianCampsTotal"`
	BarbarianCells      []*BarbarianSite `json:"barbarianCells"`
	ColonyAvailable     bool             `json:"colonyAvailable"`

	Happiness      int `json:"happiness"`
	HappinessMax   int `json:"happinessMax"`
	Unhappiness    int `json:"unhappiness"`
	UnhappinessMax int `json:"unhappinessMax"`

	DisasterRows           []*DisasterRow `json:"disasterRows"`
	PendingDrought         bool           `json:"pendingDrought"`
	PendingRaidDefense     bool           `json:"pendingRaidDefense"`
	PendingRevolt          bool           `json:"pendingRevolt"`
	PendingRevoltSacrifice bool           `json:"pendingRevoltSacrifice"` // round's over, Revolt went unanswered — waiting on which building to sacrifice

	Masteries StringSet `json:"masteries"`

	Log           []*LogEntry     `json:"log"`
	GameOverScore *ScoreBreakdown `json:"gameOverScore"`

	// pendingCultureBonus / greatPersonGranted are internal bookkeeping the TS
	// version stashes on `s as any` — Go gets real (unexported, un-JSON'd) fields
	// instead of the cast-to-any workaround.
	pendingCultureBonus int
	greatPersonGranted  int
}

type ScoreBreakdown struct {
	Farms        int `json:"farms"`
	Mines        int `json:"mines"`
	Schools      int `json:"schools"`
	Garrisons    int `json:"garrisons"`
	Colonies     int `json:"colonies"`
	Palace       int `json:"palace"`
	Gold         int `json:"gold"`
	Armies       int `json:"armies"`
	Mastery      int `json:"mastery"`
	Culture      int `json:"culture"`
	HappinessNet int `json:"happinessNet"`
	Total        int `json:"total"`
}
