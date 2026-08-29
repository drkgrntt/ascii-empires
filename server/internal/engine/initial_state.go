package engine

import (
	"fmt"
	"sync/atomic"
)

// nextID: TS's engine/initialState.ts keeps a module-level counter since a single
// browser tab only ever runs one reducer at a time. A Go server can process
// multiple games' actions from different goroutines concurrently, so this needs
// to be genuinely atomic rather than a plain package-level `int++`.
var idCounter int64

func NextID(prefix string) string {
	n := atomic.AddInt64(&idCounter, 1)
	return fmt.Sprintf("%s-%d", prefix, n)
}

func CreateInitialState() *GameState {
	population := make([]*PopulationSlot, PopulationSlots())
	for i := range population {
		state := SlotEmpty
		if i < 3 { // start with 3 Workers, per rulebook
			state = SlotWorker
		}
		population[i] = &PopulationSlot{State: state}
	}

	scienceBranchMarked := make(map[ScienceBranchID]int, len(ScienceBranchOrder))
	for _, id := range ScienceBranchOrder {
		scienceBranchMarked[id] = 0
	}

	barbarianCells := make([]*BarbarianSite, len(BarbarianSites))
	for i, c := range BarbarianSites {
		barbarianCells[i] = &BarbarianSite{MapCoord: c, Destroyed: false}
	}

	barbarianCampsTotal := len(BarbarianSites) // one per map site, see map.go

	return &GameState{
		Round:            1,
		MaxRounds:        20,
		Phase:            PhaseDice,
		Dice:             []*Die{},
		DiceUnlocked:     DiceUnlocked{White: true, Green: false, Black: false},
		RerollsThisRound: 0,

		Population:        population,
		GreatPersonTokens: 0,

		Gold:         0,
		GoldTrackMax: GoldTrackMax,

		MilitaryBoxes:      make([]bool, MilitaryBoxes),
		DeployedThisRound:  0,
		BankedAttackPower:  0,
		BankedDefensePower: 0,

		ScienceTrunkMarked:  0,
		ScienceBranchMarked: scienceBranchMarked,

		Buildings:              []*BuildingInstance{},
		DestroyedBuildingCells: []*MapCoord{},
		ConstructionPoints:     0,

		TradeRows:      MakeTradeRows(),
		CultureRows:    MakeCultureRows(),
		CultureColumns: make([]bool, CultureColumnCount),

		BarbarianCamps:      barbarianCampsTotal,
		BarbarianCampsTotal: barbarianCampsTotal,
		BarbarianCells:      barbarianCells,
		ColonyAvailable:     false,

		Happiness:      0,
		HappinessMax:   len(HappinessTrack) - 1,
		Unhappiness:    0,
		UnhappinessMax: len(UnhappinessTrack) - 1,

		DisasterRows:           MakeDisasterRows(),
		PendingDrought:         false,
		PendingRaidDefense:     false,
		PendingRevolt:          false,
		PendingRevoltSacrifice: false,

		Masteries: NewStringSet(),

		Log:           []*LogEntry{{Round: 1, Text: "Your Empire begins. Three Workers stand ready."}},
		GameOverScore: nil,
	}
}

// CloneState is a deep-enough copy for the reducer's copy-then-mutate pattern:
// every slice/map that a case might mutate gets its own backing storage, mirroring
// the TS engine's cloneState (which exists for the same reason — plain object
// spread there is shallow, same as a plain struct copy here).
func CloneState(s *GameState) *GameState {
	clone := *s

	clone.Dice = make([]*Die, len(s.Dice))
	for i, d := range s.Dice {
		dCopy := *d
		if d.UsedFor != nil {
			useCopy := *d.UsedFor
			dCopy.UsedFor = &useCopy
		}
		clone.Dice[i] = &dCopy
	}

	clone.Population = make([]*PopulationSlot, len(s.Population))
	for i, p := range s.Population {
		pCopy := *p
		clone.Population[i] = &pCopy
	}

	clone.MilitaryBoxes = append([]bool{}, s.MilitaryBoxes...)

	clone.ScienceBranchMarked = make(map[ScienceBranchID]int, len(s.ScienceBranchMarked))
	for k, v := range s.ScienceBranchMarked {
		clone.ScienceBranchMarked[k] = v
	}

	clone.Buildings = make([]*BuildingInstance, len(s.Buildings))
	for i, b := range s.Buildings {
		bCopy := *b
		clone.Buildings[i] = &bCopy
	}

	clone.DestroyedBuildingCells = make([]*MapCoord, len(s.DestroyedBuildingCells))
	for i, c := range s.DestroyedBuildingCells {
		cCopy := *c
		clone.DestroyedBuildingCells[i] = &cCopy
	}

	clone.TradeRows = make([]*TradeRow, len(s.TradeRows))
	for i, r := range s.TradeRows {
		rCopy := *r
		rCopy.Cells = make([]*CultureCell, len(r.Cells))
		for j, c := range r.Cells {
			cCopy := *c
			rCopy.Cells[j] = &cCopy
		}
		clone.TradeRows[i] = &rCopy
	}

	clone.CultureRows = make([]*CultureRow, len(s.CultureRows))
	for i, r := range s.CultureRows {
		rCopy := *r
		rCopy.Cells = make([]*CultureCell, len(r.Cells))
		for j, c := range r.Cells {
			cCopy := *c
			rCopy.Cells[j] = &cCopy
		}
		clone.CultureRows[i] = &rCopy
	}

	clone.CultureColumns = append([]bool{}, s.CultureColumns...)

	clone.DisasterRows = make([]*DisasterRow, len(s.DisasterRows))
	for i, r := range s.DisasterRows {
		rCopy := *r
		rCopy.Boxes = append([]bool{}, r.Boxes...)
		clone.DisasterRows[i] = &rCopy
	}

	clone.BarbarianCells = make([]*BarbarianSite, len(s.BarbarianCells))
	for i, c := range s.BarbarianCells {
		cCopy := *c
		clone.BarbarianCells[i] = &cCopy
	}

	clone.Masteries = s.Masteries.Clone()

	clone.Log = append([]*LogEntry{}, s.Log...)

	if s.GameOverScore != nil {
		scoreCopy := *s.GameOverScore
		clone.GameOverScore = &scoreCopy
	}

	return &clone
}
