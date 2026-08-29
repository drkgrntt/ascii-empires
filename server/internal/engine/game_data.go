package engine

import (
	"fmt"
	"strings"
)

// --- Buildings (Table, rulebook p.6) ---------------------------------

var BuildingDefs = map[BuildingType]BuildingDef{
	BuildingFarm: {
		ID: BuildingFarm, Name: "Farm", Level: 1, LineCost: 8,
		MinActivationDie: 2, ScorePerBuilding: 2, NeedsStaff: true,
	},
	BuildingMine: {
		ID: BuildingMine, Name: "Mine", Level: 1, LineCost: 8,
		MinActivationDie: 5, ScorePerBuilding: 2, NeedsStaff: true,
	},
	BuildingSchool: {
		ID: BuildingSchool, Name: "School", Level: 2, LineCost: 12,
		MinActivationDie: 4, ScorePerBuilding: 4, NeedsStaff: true,
	},
	BuildingGarrison: {
		ID: BuildingGarrison, Name: "Garrison", Level: 2, LineCost: 12,
		MinActivationDie: 3, ScorePerBuilding: 4, NeedsStaff: true,
	},
	BuildingColony: {
		// solo mode: earned free once all Barbarian camps are destroyed
		ID: BuildingColony, Name: "Colony", Level: 3, LineCost: 0,
		MinActivationDie: 6, ScorePerBuilding: 7, NeedsStaff: true,
	},
	BuildingPalace: {
		// never activated
		ID: BuildingPalace, Name: "Palace", Level: 3, LineCost: 24,
		MinActivationDie: 0, ScorePerBuilding: 36, NeedsStaff: false,
	},
}

var BuildingOrder = []BuildingType{BuildingFarm, BuildingMine, BuildingSchool, BuildingGarrison, BuildingColony, BuildingPalace}

// --- Population ---------------------------------------------------------
// Group sizes measured off the sheet's Population track (7 groups, not a uniform
// "every 4"): row 1 is three groups of 6, row 2 is a 5 and three 4s. Each completed
// group produces one Great Person. Sum = 35 total slots (3 preprinted Workers).
var PopulationGroups = []int{6, 6, 6, 5, 4, 4, 4}

func PopulationSlots() int {
	total := 0
	for _, n := range PopulationGroups {
		total += n
	}
	return total
}

// --- Gold / Military track lengths ----------------------------------------
const GoldTrackMax = 49  // 7x7 grid on the sheet, "!" mastery box bottom-right
const MilitaryBoxes = 14 // 7 cohorts of 2 boxes = 7 Armies max

// --- Science (rulebook p.7, sheet SCIENCE section) -------------------------
// Measured directly off the sheet: a shared 4-box trunk (Irrigation at its last
// box), forking into the "Philosophy" branch (16 boxes, all humanities) and a
// 10-box "approach" branch (Gold bonuses, Sailing) which itself forks again — once
// complete — into a 7-box "Engineering" branch and an 11-box "Walls & Iron" branch.
// Each of the 3 terminal branches ends in its own Mastery ("!") box, so up to 3
// separate Science Masteries are achievable (not just 1, as a single linear track
// would allow). Every box and milestone below — including the Gold-bonus spacing —
// is read exactly off the sheet: cell-content darkness sampled per box (bright text
// on the "Engineering" branch's grey background needed the opposite check), and
// every milestone position cross-checked against its "/" or "\" pointer's pixel
// position against the measured cell grid.
const ScienceTrunkLength = 4

var ScienceTrunkMilestones = []ScienceMilestone{
	{Index: 4, Label: "Irrigation — protects from Drought", Kind: MilestoneIrrigation},
}

type ScienceBranchDef struct {
	ID         ScienceBranchID
	Label      string
	Length     int
	Requires   ScienceTarget // must be fully marked before this branch unlocks
	Milestones []ScienceMilestone
}

var ScienceBranches = map[ScienceBranchID]ScienceBranchDef{
	BranchPhilosophy: {
		ID: BranchPhilosophy, Label: "Philosophy (upper branch)", Length: 16, Requires: TargetTrunk,
		Milestones: []ScienceMilestone{
			{Index: 1, Label: "Philosophy — unlocks the Green die", Kind: MilestonePhilosophy},
			{Index: 2, Label: "Culture bonus", Kind: MilestoneCultureBonus},
			{Index: 5, Label: "Culture bonus", Kind: MilestoneCultureBonus},
			{Index: 8, Label: "Culture bonus", Kind: MilestoneCultureBonus},
			{Index: 11, Label: "Culture bonus", Kind: MilestoneCultureBonus},
			{Index: 13, Label: "Culture bonus", Kind: MilestoneCultureBonus},
			{Index: 15, Label: "Culture bonus", Kind: MilestoneCultureBonus},
			{Index: 16, Label: "Mastery", Kind: MilestoneMastery},
		},
	},
	BranchEngineeringApproach: {
		ID: BranchEngineeringApproach, Label: "Engineering approach (middle/lower branch)", Length: 10, Requires: TargetTrunk,
		Milestones: []ScienceMilestone{
			{Index: 2, Label: "Sailing — Reach to all players", Kind: MilestoneSailing},
			{Index: 4, Label: "Gold bonus", Kind: MilestoneGoldBonus},
			{Index: 7, Label: "Gold bonus", Kind: MilestoneGoldBonus},
			{Index: 10, Label: "Gold bonus", Kind: MilestoneGoldBonus},
		},
	},
	BranchEngineeringBranch: {
		ID: BranchEngineeringBranch, Label: "Engineering (middle branch)", Length: 7, Requires: ScienceTarget(BranchEngineeringApproach),
		Milestones: []ScienceMilestone{
			{Index: 1, Label: "Engineering — unlocks the Black die", Kind: MilestoneEngineering},
			{Index: 3, Label: "Gold bonus", Kind: MilestoneGoldBonus},
			{Index: 6, Label: "Gold bonus", Kind: MilestoneGoldBonus},
			{Index: 7, Label: "Mastery", Kind: MilestoneMastery},
		},
	},
	BranchWallsIron: {
		ID: BranchWallsIron, Label: "Walls & Iron (lower branch)", Length: 11, Requires: ScienceTarget(BranchEngineeringApproach),
		Milestones: []ScienceMilestone{
			{Index: 1, Label: "Gold bonus", Kind: MilestoneGoldBonus},
			{Index: 2, Label: "Walls — +1 Power defending, immune to Raid", Kind: MilestoneWalls},
			{Index: 7, Label: "Iron — +1 Power attacking", Kind: MilestoneIron},
			{Index: 11, Label: "Mastery", Kind: MilestoneMastery},
		},
	},
}

var ScienceBranchOrder = []ScienceBranchID{BranchPhilosophy, BranchEngineeringApproach, BranchEngineeringBranch, BranchWallsIron}

// --- Happiness / Unhappiness track (values shown at each marked box) --
var HappinessTrack = []int{0, 4, 8, 12, 16, 20, 24, 30, 42, 60, 80}
var UnhappinessTrack = []int{0, 2, 4, 8, 12, 16, 20, 24, 30, 40, 50}

// --- Trade caravans (rulebook p.9, sheet TRADE section) ---------------
// Each caravan's reward to its owner, read directly off the sheet: 1 Happiness + 3
// Gold always, plus Science (rows 1-2) or Culture (rows 3-5) marks. The sheet also
// lists a smaller reward for other players "with Reach" — moot in solo play, since
// there are no other players to have Reach to you. In multiplayer that "opponents
// with Reach" column is real (Phase 3).
type TradeReward struct {
	Happiness int
	Gold      int
	Science   int
	Culture   int
}

var TradeRewards = []TradeReward{
	{Happiness: 1, Gold: 3, Science: 1, Culture: 0}, // 5+ 6+           :) OOO S
	{Happiness: 1, Gold: 3, Science: 2, Culture: 0}, // 4+ 5+ 6+        :) OOO SS
	{Happiness: 1, Gold: 3, Science: 0, Culture: 1}, // 3+ 4+ 5+ 6+     :) OOO C
	{Happiness: 1, Gold: 3, Science: 0, Culture: 2}, // 2+ 3+ 4+ 5+ 6+  :) OOO CC
	{Happiness: 1, Gold: 3, Science: 0, Culture: 2}, // 2+ 3+ 4+ 5+ 6+  :) OOO CC
}

func TradeRewardText(r TradeReward) string {
	text := fmt.Sprintf("+%d Happiness, +%d Gold", r.Happiness, r.Gold)
	if r.Science != 0 {
		text += fmt.Sprintf(", +%d Science", r.Science)
	}
	if r.Culture != 0 {
		text += fmt.Sprintf(", +%d Culture", r.Culture)
	}
	return text
}

func MakeTradeRows() []*TradeRow {
	thresholds := [][]int{
		{5, 6},
		{4, 5, 6},
		{3, 4, 5, 6},
		{2, 3, 4, 5, 6},
		{2, 3, 4, 5, 6},
	}
	rows := make([]*TradeRow, len(thresholds))
	for i, row := range thresholds {
		cells := make([]*CultureCell, len(row))
		for j, t := range row {
			cells[j] = &CultureCell{Threshold: t}
		}
		rows[i] = &TradeRow{Cells: cells}
	}
	return rows
}

// --- Culture grid (sheet CULTURE section, rows read left to right) ----
func MakeCultureRows() []*CultureRow {
	type rowDef struct {
		thresholds []int
		score      int
	}
	defs := []rowDef{
		{[]int{5, 5, 4, 6}, 15},
		{[]int{2, 3, 4, 5, 5, 6}, 20},
		{[]int{3, 3, 5, 2, 4, 6, 5}, 30},
		{[]int{4, 5, 4, 5, 6, 5, 6}, 35},
	}
	rows := make([]*CultureRow, len(defs))
	for i, d := range defs {
		cells := make([]*CultureCell, len(d.thresholds))
		for j, t := range d.thresholds {
			cells[j] = &CultureCell{Threshold: t}
		}
		rows[i] = &CultureRow{Cells: cells, Score: d.score}
	}
	return rows
}

// One-time bonus for filling every cell in a given column across all rows that
// have a cell at that index (rows are 4/6/7/7 cells long and right-aligned, so
// the rightmost columns span all four rows and the leftmost only the two longest
// ones). Read directly off the sheet's two symbol rows under the grid (/ Worker,
// O Gold, S Science, :) Happiness), one grant per row, per column — not a flat
// point bonus.
const CultureColumnCount = 7

type CultureColumnReward struct {
	Worker    int
	Gold      int
	Science   int
	Happiness int
}

var CultureColumnRewards = []CultureColumnReward{
	{Worker: 1, Gold: 1, Science: 0, Happiness: 0}, // column 1: / O
	{Worker: 0, Gold: 2, Science: 0, Happiness: 0}, // column 2: O O
	{Worker: 1, Gold: 0, Science: 1, Happiness: 0}, // column 3: / S
	{Worker: 0, Gold: 1, Science: 1, Happiness: 0}, // column 4: O S
	{Worker: 0, Gold: 0, Science: 1, Happiness: 1}, // column 5: S :)
	{Worker: 0, Gold: 0, Science: 0, Happiness: 2}, // column 6: :) :)
	{Worker: 0, Gold: 0, Science: 0, Happiness: 2}, // column 7: :) :)
}

func CultureRewardText(r CultureColumnReward) string {
	parts := []string{}
	if r.Worker != 0 {
		plural := ""
		if r.Worker > 1 {
			plural = "s"
		}
		parts = append(parts, fmt.Sprintf("+%d Worker%s", r.Worker, plural))
	}
	if r.Gold != 0 {
		parts = append(parts, fmt.Sprintf("+%d Gold", r.Gold))
	}
	if r.Science != 0 {
		parts = append(parts, fmt.Sprintf("+%d Science", r.Science))
	}
	if r.Happiness != 0 {
		parts = append(parts, fmt.Sprintf("+%d Happiness", r.Happiness))
	}
	return strings.Join(parts, ", ")
}

// --- Disaster grid (sheet, rows 1-6) -----------------------------------
// Row "1" is marked whenever a die shows 1, before it gets rerolled.
// Rows 2-6 are marked once per final die value after the reroll-1s loop.
func MakeDisasterRows() []*DisasterRow {
	type rowDef struct {
		dieValue        int
		name            string
		hasCultureBonus bool
	}
	defs := []rowDef{
		{1, "Drought", false},
		{2, "", false},
		{3, "Barbarian Raid", true},
		{4, "", true},
		{5, "Revolt", true},
		{6, "", true},
	}
	rows := make([]*DisasterRow, len(defs))
	for i, d := range defs {
		rows[i] = &DisasterRow{
			DieValue:        d.dieValue,
			Name:            d.name,
			HasCultureBonus: d.hasCultureBonus,
			Boxes:           make([]bool, 3),
		}
	}
	return rows
}

const RerollCostSolo = 1 // "collectively spend Gold equal to no. of players" — 1 in solo
