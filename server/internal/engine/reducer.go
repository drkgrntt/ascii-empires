package engine

import (
	"fmt"
	"math/rand"
	"sort"
)

// Action mirrors the TS engine's `Action` discriminated union as one flat struct
// (same technique as DieUse — see types.go) — Type selects which of the other
// fields are meaningful; the rest sit at their zero value, unread.
type Action struct {
	Type string `json:"type"`

	// REROLL_DICE
	IDs []string `json:"ids,omitempty"`

	// ASSIGN_DIE / UNASSIGN_DIE / MODIFY_DIE
	ID    string  `json:"id,omitempty"`
	Use   *DieUse `json:"use,omitempty"`
	Delta int     `json:"delta,omitempty"` // 1 | -1

	// RESOLVE_DROUGHT ("workers" | "unhappiness") / USE_GREAT_PERSON ("lines" | "science" | "culture")
	Choice string `json:"choice,omitempty"`

	// COMPLETE_BUILDING / BUILD_FREE_COLONY
	Building BuildingType `json:"building,omitempty"`
	Cell     MapCoord     `json:"cell,omitempty"`

	// USE_GREAT_PERSON
	CultureTarget *CultureTargetRef `json:"cultureTarget,omitempty"`
	ScienceTarget ScienceTarget     `json:"scienceTarget,omitempty"`

	// RESOLVE_REVOLT_SACRIFICE — nullable, so a pointer (nil = "auto"), not an omitted zero value.
	Index *int `json:"index"`
}

type CultureTargetRef struct {
	Row int `json:"row"`
	Col int `json:"col"`
}

const (
	ActionRollDice               = "ROLL_DICE"
	ActionRerollDice             = "REROLL_DICE"
	ActionConfirmDiplomacy       = "CONFIRM_DIPLOMACY"
	ActionAssignDie              = "ASSIGN_DIE"
	ActionUnassignDie            = "UNASSIGN_DIE"
	ActionModifyDie              = "MODIFY_DIE"
	ActionResolveDrought         = "RESOLVE_DROUGHT"
	ActionCompleteBuilding       = "COMPLETE_BUILDING"
	ActionUseGreatPerson         = "USE_GREAT_PERSON"
	ActionTaxation               = "TAXATION"
	ActionConscription           = "CONSCRIPTION"
	ActionBuildFreeColony        = "BUILD_FREE_COLONY"
	ActionEndDevelopment         = "END_DEVELOPMENT"
	ActionDeployBarbarian        = "DEPLOY_BARBARIAN"
	ActionDeployDefendRaid       = "DEPLOY_DEFEND_RAID"
	ActionDeployDefendRevolt     = "DEPLOY_DEFEND_REVOLT"
	ActionResolveRevoltSacrifice = "RESOLVE_REVOLT_SACRIFICE"
	ActionEndRound               = "END_ROUND"
)

func logEntry(s *GameState, text string) {
	s.Log = append(s.Log, &LogEntry{Round: s.Round, Text: text})
}

func rollDie() int {
	return rand.Intn(6) + 1
}

func rollFreshDice(s *GameState) {
	colors := []DieColor{DieWhite, DieWhite, DieWhite, DieGreen, DieBlack}
	dice := make([]*Die, len(colors))
	for i, c := range colors {
		dice[i] = &Die{ID: NextID("die"), Color: c, Value: rollDie(), UsedFor: nil}
	}
	s.Dice = dice
}

func availableDice(s *GameState) []*Die {
	out := []*Die{}
	for _, d := range s.Dice {
		if d.Color == DieGreen && !s.DiceUnlocked.Green {
			continue
		}
		if d.Color == DieBlack && !s.DiceUnlocked.Black {
			continue
		}
		out = append(out, d)
	}
	return out
}

func dieByID(s *GameState, id string) *Die {
	for _, d := range s.Dice {
		if d.ID == id {
			return d
		}
	}
	return nil
}

func isAvailable(s *GameState, id string) bool {
	for _, d := range availableDice(s) {
		if d.ID == id {
			return true
		}
	}
	return false
}

func addHappiness(s *GameState, n int) {
	s.Happiness = minInt(s.Happiness+n, s.HappinessMax)
}

func addUnhappiness(s *GameState, n int) {
	s.Unhappiness = minInt(s.Unhappiness+n, s.UnhappinessMax)
	if s.Unhappiness > s.Happiness {
		s.PendingRevolt = true
	}
}

func addGold(s *GameState, n int) {
	s.Gold = minInt(s.Gold+n, s.GoldTrackMax)
	if s.Gold >= s.GoldTrackMax {
		s.Masteries.Add("gold")
	}
}

func spendGold(s *GameState, n int) bool {
	if s.Gold < n {
		return false
	}
	s.Gold -= n
	return true
}

func addWorker(s *GameState) {
	for _, p := range s.Population {
		if p.State == SlotEmpty {
			p.State = SlotWorker
			break
		}
	}
	checkPopulationGroups(s)
}

func checkPopulationGroups(s *GameState) {
	offset := 0
	earned := 0
	for _, size := range PopulationGroups {
		end := offset + size
		if end > len(s.Population) {
			end = len(s.Population)
		}
		full := true
		for _, p := range s.Population[offset:end] {
			if p.State == SlotEmpty {
				full = false
				break
			}
		}
		if full {
			earned++
		}
		offset += size
	}
	alreadyGranted := s.greatPersonGranted
	if earned > alreadyGranted {
		diff := earned - alreadyGranted
		s.GreatPersonTokens += diff
		s.greatPersonGranted = earned
		logEntry(s, fmt.Sprintf("A Great Person emerges! (+%d)", diff))
	}
	allFilled := true
	for _, p := range s.Population {
		if p.State == SlotEmpty {
			allFilled = false
			break
		}
	}
	if allFilled {
		s.Masteries.Add("population")
	}
}

// A branch unlocks once whatever it Requires (the trunk, or another branch) is
// fully marked — see ScienceBranches / the trunk-then-fork tree in game_data.go.
func isScienceTargetComplete(s *GameState, target ScienceTarget) bool {
	if target == TargetTrunk {
		return s.ScienceTrunkMarked >= ScienceTrunkLength
	}
	branch := target.AsBranch()
	return s.ScienceBranchMarked[branch] >= ScienceBranches[branch].Length
}

func isBranchUnlocked(s *GameState, id ScienceBranchID) bool {
	return isScienceTargetComplete(s, ScienceBranches[id].Requires)
}

// The trunk first, then whichever unlocked branch isn't finished yet — used as the
// science target for grants with no natural "pick a branch" moment (Trade/Culture
// rewards). School activation and the Great Person's Science choice let the player
// pick explicitly instead (see the API layer / client).
func firstAvailableScienceTarget(s *GameState) ScienceTarget {
	if !isScienceTargetComplete(s, TargetTrunk) {
		return TargetTrunk
	}
	for _, id := range ScienceBranchOrder {
		if isBranchUnlocked(s, id) && s.ScienceBranchMarked[id] < ScienceBranches[id].Length {
			return ScienceTarget(id)
		}
	}
	return TargetTrunk
}

func markScience(s *GameState, n int, target ScienceTarget) {
	for i := 0; i < n; i++ {
		t := target
		if t == "" {
			t = firstAvailableScienceTarget(s)
		}
		if t != TargetTrunk && !isBranchUnlocked(s, t.AsBranch()) {
			t = firstAvailableScienceTarget(s)
		}
		if isScienceTargetComplete(s, t) {
			// Requested target is full (or everything is) — fall back rather than lose the mark.
			t = firstAvailableScienceTarget(s)
			if isScienceTargetComplete(s, t) {
				break // every unlocked track is full
			}
		}

		var milestones []ScienceMilestone
		var marked int
		if t == TargetTrunk {
			s.ScienceTrunkMarked++
			marked = s.ScienceTrunkMarked
			milestones = ScienceTrunkMilestones
		} else {
			branch := t.AsBranch()
			s.ScienceBranchMarked[branch]++
			marked = s.ScienceBranchMarked[branch]
			milestones = ScienceBranches[branch].Milestones
		}

		for _, m := range milestones {
			if m.Index != marked {
				continue
			}
			logEntry(s, "Science: "+m.Label)
			switch m.Kind {
			case MilestonePhilosophy:
				s.DiceUnlocked.Green = true
			case MilestoneEngineering:
				s.DiceUnlocked.Black = true
			case MilestoneGoldBonus:
				addGold(s, 1)
			case MilestoneMastery:
				s.Masteries.Add(fmt.Sprintf("science-%s", t))
			case MilestoneCultureBonus:
				// Granted as a banked token the player can spend on any Culture cell
				// (converted to a Great Person token at END_ROUND, see below).
				s.pendingCultureBonus++
			}
			break
		}
	}
}

func hasMilestone(s *GameState, kind string) bool {
	for _, m := range ScienceTrunkMilestones {
		if m.Kind == kind && s.ScienceTrunkMarked >= m.Index {
			return true
		}
	}
	for _, id := range ScienceBranchOrder {
		for _, m := range ScienceBranches[id].Milestones {
			if m.Kind == kind && s.ScienceBranchMarked[id] >= m.Index {
				return true
			}
		}
	}
	return false
}

func staffedCountByType(s *GameState, t BuildingType) int {
	count := 0
	for _, b := range s.Buildings {
		if b.Type == t && b.Staffed {
			count++
		}
	}
	return count
}

func canBuild(s *GameState, t BuildingType) bool {
	def := BuildingDefs[t]
	if def.Level == 2 {
		return staffedCountByType(s, BuildingFarm) > 0 && staffedCountByType(s, BuildingMine) > 0
	}
	if def.Level == 3 {
		return staffedCountByType(s, BuildingSchool) > 0 && staffedCountByType(s, BuildingGarrison) > 0
	}
	return true
}

func completeBuilding(s *GameState, t BuildingType, cell MapCoord) {
	def := BuildingDefs[t]
	// "Ø to build" on Mountains (Symbols table, p.11): 1 Gold if any part of the
	// building touches Mountainous terrain. CanPlaceBuilding already confirmed it's
	// affordable — spendGold here just books the cost.
	if TerrainAt(cell.X, cell.Y) == TerrainMountains {
		spendGold(s, 1)
		logEntry(s, "Spent 1 Gold to build on Mountainous terrain.")
	}
	instance := &BuildingInstance{Type: t, Staffed: false, Cell: cell}
	if def.NeedsStaff {
		for _, p := range s.Population {
			if p.State == SlotWorker {
				p.State = string(t)
				instance.Staffed = true
				break
			}
		}
	} else {
		instance.Staffed = true // Palace needs no staff
	}
	s.Buildings = append(s.Buildings, instance)

	staffedNote := " (unstaffed — no Worker available)"
	if instance.Staffed {
		staffedNote = " and staffed"
	}
	logEntry(s, fmt.Sprintf("%s constructed%s.", def.Name, staffedNote))

	hasStaffedColony := false
	hasPalace := false
	for _, b := range s.Buildings {
		if b.Type == BuildingColony && b.Staffed {
			hasStaffedColony = true
		}
		if b.Type == BuildingPalace {
			hasPalace = true
		}
	}
	if hasStaffedColony && hasPalace {
		s.Masteries.Add("buildings")
	}
}

// Rows are right-aligned to the CultureColumnCount-wide grid (sheet layout), so a
// row of length L only reaches grid columns [CultureColumnCount - L,
// CultureColumnCount - 1]. `col` here is that grid column (0-indexed from the
// left), not a row-local cell index.
func rowGridOffset(cellCount int) int {
	return CultureColumnCount - cellCount
}

func checkCultureColumn(s *GameState, col int) {
	if col < 0 || col >= len(s.CultureColumns) || s.CultureColumns[col] {
		return // already claimed (or out of range)
	}
	rowsWithCol := []*CultureRow{}
	for _, r := range s.CultureRows {
		if rowGridOffset(len(r.Cells)) <= col {
			rowsWithCol = append(rowsWithCol, r)
		}
	}
	if len(rowsWithCol) == 0 {
		return
	}
	for _, r := range rowsWithCol {
		if !r.Cells[col-rowGridOffset(len(r.Cells))].Filled {
			return
		}
	}
	s.CultureColumns[col] = true
	if col < 0 || col >= len(CultureColumnRewards) {
		return
	}
	reward := CultureColumnRewards[col]
	for i := 0; i < reward.Worker; i++ {
		addWorker(s)
	}
	if reward.Gold != 0 {
		addGold(s, reward.Gold)
	}
	if reward.Science != 0 {
		markScience(s, reward.Science, "")
	}
	if reward.Happiness != 0 {
		addHappiness(s, reward.Happiness)
	}
	logEntry(s, fmt.Sprintf("Culture column %d completed! %s.", col+1, CultureRewardText(reward)))
}

func checkMasteryTracks(s *GameState) {
	allMilitary := true
	for _, b := range s.MilitaryBoxes {
		if !b {
			allMilitary = false
			break
		}
	}
	if allMilitary {
		s.Masteries.Add("military")
	}
	allTrade := true
	for _, r := range s.TradeRows {
		if !r.Completed {
			allTrade = false
			break
		}
	}
	if allTrade {
		s.Masteries.Add("trade")
	}
	allCulture := true
	for _, r := range s.CultureRows {
		if !r.Completed {
			allCulture = false
			break
		}
	}
	if allCulture {
		s.Masteries.Add("culture")
	}
}

func markDisasterRow(s *GameState, dieValue int) {
	var row *DisasterRow
	for _, r := range s.DisasterRows {
		if r.DieValue == dieValue {
			row = r
			break
		}
	}
	if row == nil || row.Triggered {
		return
	}
	idx := -1
	for i, b := range row.Boxes {
		if !b {
			idx = i
			break
		}
	}
	if idx == -1 {
		return
	}
	row.Boxes[idx] = true
	if idx == 2 {
		row.Triggered = true
		triggerDisaster(s, row.DieValue)
	}
}

func triggerDisaster(s *GameState, dieValue int) {
	var row *DisasterRow
	for _, r := range s.DisasterRows {
		if r.DieValue == dieValue {
			row = r
			break
		}
	}
	if row.HasCultureBonus {
		s.pendingCultureBonus++
	}
	switch dieValue {
	case 1:
		logEntry(s, "Disaster: Drought strikes!")
		if !hasMilestone(s, MilestoneIrrigation) {
			// "Cross off two Workers OR gain one Unhappiness" — the player's choice, not
			// forced by whether they happen to have 2 Workers (rulebook p.10). Deferred
			// like Raid/Revolt; RESOLVE_DROUGHT settles it, with a fallback at END_ROUND.
			s.PendingDrought = true
			logEntry(s, "Choose: cross off 2 Workers, or gain 1 Unhappiness.")
		} else {
			logEntry(s, "Irrigation protects you from the Drought.")
		}
	case 3:
		logEntry(s, "Disaster: Barbarians raid!")
		if hasMilestone(s, MilestoneWalls) {
			logEntry(s, "Your Walls repel the Raid.")
		} else {
			s.PendingRaidDefense = true
			logEntry(s, "Deploy an Army in the Deployment phase to repel it, or suffer losses.")
		}
	case 5:
		logEntry(s, "Disaster: unrest boils toward Revolt!")
		if s.Unhappiness > s.Happiness {
			s.PendingRevolt = true
			logEntry(s, "Deploy an Army in Deployment to prevent a building from being destroyed.")
		} else {
			logEntry(s, "Your people remain content — no Revolt.")
		}
	}
}

func resolveDisastersPhase(s *GameState) {
	// Rulebook p.10 / Diplomacy's own hint ("those with a value of 1... about to trigger
	// Disasters in the following phase") — it's specifically 1s that interact with the
	// Disaster grid. A die that never shows 1 sits this phase out entirely. Each occurrence
	// of a 1 marks row 1 (Drought's row — the only way it's ever reachable, since a die can
	// never end this process still showing 1) and is rerolled to get a usable value for
	// Development; if THAT die started as a 1, its final rerolled value also marks its own
	// row. Dice that were never 1 don't mark anything, this round.
	guard := 0
	hasOne := func() bool {
		for _, d := range s.Dice {
			if d.Value == 1 {
				return true
			}
		}
		return false
	}
	rerolled := map[string]bool{}
	for hasOne() && guard < 20 {
		guard++
		for _, d := range s.Dice {
			if d.Value == 1 {
				rerolled[d.ID] = true
				markDisasterRow(s, 1)
				d.Value = rollDie()
			}
		}
	}
	for _, d := range s.Dice {
		if !rerolled[d.ID] {
			continue
		}
		markDisasterRow(s, d.Value)
	}
}

func unusedLines(s *GameState) int {
	return s.ConstructionPoints
}

// Deploying an Army grants 1 point of Power, or 2 if you've researched the
// matching upgrade (Iron for attacking, Walls for defending) — rulebook p.8. Power
// from an army is banked and can cover multiple 1pt actions of that kind in the
// same Deployment phase (it just doesn't carry over to the next round).
func armiesAvailable(s *GameState) int {
	filled := 0
	for _, b := range s.MilitaryBoxes {
		if b {
			filled++
		}
	}
	return filled/2 - s.DeployedThisRound
}

func ensureAttackPower(s *GameState) bool {
	if s.BankedAttackPower > 0 {
		return true
	}
	if armiesAvailable(s) <= 0 {
		return false
	}
	s.DeployedThisRound++
	if hasMilestone(s, MilestoneIron) {
		s.BankedAttackPower += 2
	} else {
		s.BankedAttackPower += 1
	}
	return true
}

func ensureDefensePower(s *GameState) bool {
	if s.BankedDefensePower > 0 {
		return true
	}
	if armiesAvailable(s) <= 0 {
		return false
	}
	s.DeployedThisRound++
	if hasMilestone(s, MilestoneWalls) {
		s.BankedDefensePower += 2
	} else {
		s.BankedDefensePower += 1
	}
	return true
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GameReducer applies a single Action to state and returns a new state — the same
// copy-then-mutate contract as the TS engine's gameReducer.
func GameReducer(state *GameState, action Action) *GameState {
	s := CloneState(state)

	switch action.Type {
	case ActionRollDice:
		if s.Phase != PhaseDice {
			return s
		}
		rollFreshDice(s)
		s.RerollsThisRound = 0
		s.Phase = PhaseDiplomacy
		values := make([]string, len(s.Dice))
		for i, d := range s.Dice {
			values[i] = fmt.Sprintf("%d", d.Value)
		}
		logEntry(s, fmt.Sprintf("Round %d: rolled %s.", s.Round, joinInts(values)))
		return s

	case ActionRerollDice:
		if s.Phase != PhaseDiplomacy {
			return s
		}
		if len(action.IDs) == 0 {
			return s
		}
		if !spendGold(s, RerollCostSolo) {
			logEntry(s, "Not enough Gold to reroll.")
			return s
		}
		idSet := map[string]bool{}
		for _, id := range action.IDs {
			idSet[id] = true
		}
		for _, d := range s.Dice {
			if idSet[d.ID] {
				d.Value = rollDie()
			}
		}
		s.RerollsThisRound++
		logEntry(s, fmt.Sprintf("Rerolled %d die/dice for %d Gold.", len(action.IDs), RerollCostSolo))
		return s

	case ActionConfirmDiplomacy:
		if s.Phase != PhaseDiplomacy {
			return s
		}
		s.Phase = PhaseDisasters
		resolveDisastersPhase(s)
		s.Phase = PhaseDevelopment
		return s

	case ActionAssignDie:
		if s.Phase != PhaseDevelopment {
			return s
		}
		die := dieByID(s, action.ID)
		if die == nil || die.UsedFor != nil {
			return s
		}
		if !isAvailable(s, die.ID) {
			return s
		}
		if action.Use == nil {
			return s
		}
		use := *action.Use
		switch use.Kind {
		case UseConstruction:
			die.UsedFor = &use
			s.ConstructionPoints += die.Value

		case UseActivate:
			def := BuildingDefs[use.Building]
			if def.MinActivationDie == 0 || die.Value < def.MinActivationDie {
				return s
			}
			count := staffedCountByType(s, use.Building)
			if count == 0 {
				return s
			}
			if use.Building == BuildingColony {
				if use.BoostTarget == "" {
					return s
				}
				die.UsedFor = &use
				activateColonyBoost(s, use.BoostTarget, use.ScienceTarget)
			} else {
				die.UsedFor = &use
				activateBuilding(s, use.Building, count, use.ScienceTarget)
			}

		case UseTrade:
			if use.Row < 0 || use.Row >= len(s.TradeRows) {
				return s
			}
			row := s.TradeRows[use.Row]
			if row.Completed {
				return s
			}
			var cell *CultureCell
			for _, c := range row.Cells {
				if !c.Filled {
					cell = c
					break
				}
			}
			if cell == nil || die.Value < cell.Threshold {
				return s
			}
			cell.Filled = true
			die.UsedFor = &use
			if allFilled(row.Cells) {
				row.Completed = true
				reward := TradeRewards[use.Row]
				addHappiness(s, reward.Happiness)
				addGold(s, reward.Gold)
				if reward.Science != 0 {
					markScience(s, reward.Science, "")
				}
				if reward.Culture != 0 {
					// Banked like a disaster/science culture bonus: the player picks which
					// Culture cell(s) to mark via a Great Person-style token (see END_ROUND).
					s.pendingCultureBonus += reward.Culture
				}
				logEntry(s, fmt.Sprintf("Caravan %d reaches its destination! %s.", use.Row+1, TradeRewardText(reward)))
				checkMasteryTracks(s)
			}

		case UseCulture:
			if use.Row < 0 || use.Row >= len(s.CultureRows) {
				return s
			}
			row := s.CultureRows[use.Row]
			if use.Col < 0 || use.Col >= len(row.Cells) {
				return s
			}
			cell := row.Cells[use.Col]
			if cell.Filled || die.Value < cell.Threshold {
				return s
			}
			cell.Filled = true
			die.UsedFor = &use
			if allFilled(row.Cells) {
				row.Completed = true
				logEntry(s, fmt.Sprintf("Culture row %d completed (+%d pts at game end).", use.Row+1, row.Score))
				checkMasteryTracks(s)
			}
			checkCultureColumn(s, use.Col+rowGridOffset(len(row.Cells)))
		}
		return s

	case ActionModifyDie:
		// 1 Gold shifts a die's value by 1 (either direction, spendable repeatedly);
		// it can climb past 6 but never drops below 2. Rulebook p.7.
		if s.Phase != PhaseDevelopment {
			return s
		}
		die := dieByID(s, action.ID)
		if die == nil || die.UsedFor != nil {
			return s
		}
		if !isAvailable(s, die.ID) {
			return s
		}
		next := die.Value + action.Delta
		if next < 2 {
			return s
		}
		if !spendGold(s, 1) {
			logEntry(s, "Not enough Gold to modify die.")
			return s
		}
		die.Value = next
		logEntry(s, fmt.Sprintf("Spent 1 Gold: %s die now shows %d.", die.Color, next))
		return s

	case ActionUnassignDie:
		if s.Phase != PhaseDevelopment {
			return s
		}
		die := dieByID(s, action.ID)
		if die == nil || die.UsedFor == nil {
			return s
		}
		switch die.UsedFor.Kind {
		case UseConstruction:
			s.ConstructionPoints -= die.Value
			if s.ConstructionPoints < 0 {
				s.ConstructionPoints = 0
			}
		case UseTrade:
			row := s.TradeRows[die.UsedFor.Row]
			for i := len(row.Cells) - 1; i >= 0; i-- {
				if row.Cells[i].Filled {
					row.Cells[i].Filled = false
					break
				}
			}
			row.Completed = false
		case UseCulture:
			row := s.CultureRows[die.UsedFor.Row]
			if die.UsedFor.Col >= 0 && die.UsedFor.Col < len(row.Cells) {
				row.Cells[die.UsedFor.Col].Filled = false
			}
			row.Completed = false
		}
		// Activation effects are not reversible (resources already granted); undo is
		// intentionally limited to construction/trade/culture assignments.
		die.UsedFor = nil
		return s

	case ActionCompleteBuilding:
		if s.Phase != PhaseDevelopment {
			return s
		}
		def := BuildingDefs[action.Building]
		if def.LineCost == 0 {
			return s // Colony is granted via BUILD_FREE_COLONY
		}
		if !canBuild(s, action.Building) {
			logEntry(s, fmt.Sprintf("Prerequisites not met for %s.", def.Name))
			return s
		}
		if unusedLines(s) < def.LineCost {
			logEntry(s, fmt.Sprintf("Not enough construction lines for %s.", def.Name))
			return s
		}
		placement := CanPlaceBuilding(s, action.Building, action.Cell.X, action.Cell.Y)
		if !placement.OK {
			reason := placement.Reason
			if reason == "" {
				reason = fmt.Sprintf("Cannot build %s there.", def.Name)
			}
			logEntry(s, reason)
			return s
		}
		s.ConstructionPoints -= def.LineCost
		completeBuilding(s, action.Building, action.Cell)
		return s

	case ActionUseGreatPerson:
		if s.GreatPersonTokens <= 0 {
			return s
		}
		s.GreatPersonTokens--
		switch action.Choice {
		case "lines":
			s.ConstructionPoints += 4
			logEntry(s, "Great Person: +4 construction lines.")
		case "science":
			markScience(s, 2, action.ScienceTarget)
			logEntry(s, "Great Person: +2 Science.")
		case "culture":
			if action.CultureTarget != nil {
				ct := *action.CultureTarget
				if ct.Row >= 0 && ct.Row < len(s.CultureRows) {
					row := s.CultureRows[ct.Row]
					if ct.Col >= 0 && ct.Col < len(row.Cells) {
						cell := row.Cells[ct.Col]
						if !cell.Filled {
							cell.Filled = true
							if allFilled(row.Cells) {
								row.Completed = true
								logEntry(s, fmt.Sprintf("Culture row %d completed via Great Person.", ct.Row+1))
								checkMasteryTracks(s)
							}
							checkCultureColumn(s, ct.Col+rowGridOffset(len(row.Cells)))
						}
					}
				}
			}
		}
		return s

	case ActionResolveDrought:
		if !s.PendingDrought {
			return s
		}
		if action.Choice == "workers" {
			workers := workerSlots(s)
			if len(workers) < 2 {
				return s // can't take this option — not enough Workers
			}
			workers[0].State = SlotEmpty
			workers[1].State = SlotEmpty
			logEntry(s, "Drought: crossed off 2 Workers.")
		} else {
			addUnhappiness(s, 1)
			logEntry(s, "Drought: +1 Unhappiness.")
		}
		s.PendingDrought = false
		return s

	case ActionTaxation:
		addUnhappiness(s, 1)
		addGold(s, 2)
		logEntry(s, "Taxation: +2 Gold, +1 Unhappiness.")
		return s

	case ActionConscription:
		workers := workerSlots(s)
		n := len(workers)
		if n > 2 {
			n = 2
		}
		if n == 0 {
			logEntry(s, "No Workers available to conscript.")
			return s
		}
		addUnhappiness(s, 1)
		for i := 0; i < n; i++ {
			workers[i].State = SlotEmpty
			for _, b := range indices(s.MilitaryBoxes) {
				if !s.MilitaryBoxes[b] {
					s.MilitaryBoxes[b] = true
					break
				}
			}
		}
		logEntry(s, fmt.Sprintf("Conscription: %d Worker(s) → Soldiers, +1 Unhappiness.", n))
		checkMasteryTracks(s)
		return s

	case ActionBuildFreeColony:
		if !s.ColonyAvailable {
			return s
		}
		if !canBuild(s, BuildingColony) {
			logEntry(s, "Colony requires a staffed School and Garrison first.")
			return s
		}
		for _, b := range s.Buildings {
			if b.Type == BuildingColony {
				return s
			}
		}
		placement := CanPlaceBuilding(s, BuildingColony, action.Cell.X, action.Cell.Y)
		if !placement.OK {
			reason := placement.Reason
			if reason == "" {
				reason = "Cannot found the Colony there."
			}
			logEntry(s, reason)
			return s
		}
		s.ColonyAvailable = false
		completeBuilding(s, BuildingColony, action.Cell)
		logEntry(s, "The reclaimed Barbarian land becomes your Colony!")
		return s

	case ActionEndDevelopment:
		if s.Phase != PhaseDevelopment {
			return s
		}
		s.ConstructionPoints = 0 // unused lines are lost, per rules
		s.Phase = PhaseDeployment
		s.DeployedThisRound = 0
		s.BankedAttackPower = 0
		s.BankedDefensePower = 0
		return s

	case ActionDeployBarbarian:
		if s.Phase != PhaseDeployment {
			return s
		}
		var site *BarbarianSite
		for _, c := range s.BarbarianCells {
			if !c.Destroyed {
				site = c
				break
			}
		}
		if site == nil || !ensureAttackPower(s) {
			return s
		}
		s.BankedAttackPower--
		site.Destroyed = true
		s.BarbarianCamps--
		addGold(s, 3)
		logEntry(s, "Army destroys a Barbarian camp! +3 Gold.")
		if s.BarbarianCamps == 0 {
			addHappiness(s, 2)
			s.ColonyAvailable = true
			logEntry(s, "All Barbarian camps destroyed! +2 Happiness. A free Colony site is available.")
		}
		return s

	case ActionDeployDefendRaid:
		if s.Phase != PhaseDeployment || !s.PendingRaidDefense {
			return s
		}
		if !ensureDefensePower(s) {
			return s
		}
		s.BankedDefensePower--
		s.PendingRaidDefense = false
		logEntry(s, "Army repels the Barbarian Raid.")
		return s

	case ActionDeployDefendRevolt:
		if s.Phase != PhaseDeployment || !s.PendingRevolt {
			return s
		}
		if !ensureDefensePower(s) {
			return s
		}
		s.BankedDefensePower--
		s.PendingRevolt = false
		addUnhappiness(s, 1)
		logEntry(s, "Army prevents Revolt from destroying a building (+1 Unhappiness).")
		return s

	case ActionEndRound:
		if s.Phase != PhaseDeployment {
			return s
		}
		if s.PendingRevoltSacrifice {
			return s // must resolve the sacrifice prompt first
		}

		// Unresolved Drought choice: default to losing Workers when possible (matches
		// the old forced behavior), else Unhappiness — same fallback spirit as the
		// Revolt sacrifice's auto-target default.
		if s.PendingDrought {
			workers := workerSlots(s)
			if len(workers) >= 2 {
				workers[0].State = SlotEmpty
				workers[1].State = SlotEmpty
				logEntry(s, "Drought (unresolved): crossed off 2 Workers.")
			} else {
				addUnhappiness(s, 1)
				logEntry(s, "Drought (unresolved): +1 Unhappiness.")
			}
			s.PendingDrought = false
		}

		// Unresolved Raid: lose 3 Gold (if able) + 1 Unhappiness.
		if s.PendingRaidDefense {
			lost := minInt(3, s.Gold)
			s.Gold -= lost
			addUnhappiness(s, 1)
			logEntry(s, fmt.Sprintf("Unrepelled Raid: -%d Gold, +1 Unhappiness.", lost))
			s.PendingRaidDefense = false
		}
		// Unresolved Revolt: "a building of your choice is destroyed" (rulebook p.10) —
		// that choice happens now, at the actual moment of resolution, not pre-picked
		// earlier in Deployment. Pause the round here; RESOLVE_REVOLT_SACRIFICE finishes it.
		if s.PendingRevolt {
			s.PendingRevolt = false
			s.PendingRevoltSacrifice = true
			logEntry(s, "The Revolt goes unanswered — choose which building to sacrifice.")
			return s
		}

		finishRound(s)
		return s

	case ActionResolveRevoltSacrifice:
		if !s.PendingRevoltSacrifice {
			return s
		}
		type staffedEntry struct {
			b *BuildingInstance
			i int
		}
		staffed := []staffedEntry{}
		for i, b := range s.Buildings {
			if b.Staffed && b.Type != BuildingPalace {
				staffed = append(staffed, staffedEntry{b, i})
			}
		}
		var target *staffedEntry
		if action.Index != nil {
			for i := range staffed {
				if staffed[i].i == *action.Index {
					target = &staffed[i]
					break
				}
			}
		}
		if target == nil && len(staffed) > 0 {
			sort.Slice(staffed, func(a, b int) bool {
				return BuildingDefs[staffed[a].b.Type].ScorePerBuilding < BuildingDefs[staffed[b].b.Type].ScorePerBuilding
			})
			target = &staffed[0]
		}
		if target != nil {
			logEntry(s, fmt.Sprintf("Revolt destroys your %s.", BuildingDefs[target.b.Type].Name))
			// The ruin blocks that plot (and touching it) for the rest of the game —
			// "No new buildings may be built in the same space" (rulebook p.10).
			cellCopy := target.b.Cell
			s.DestroyedBuildingCells = append(s.DestroyedBuildingCells, &cellCopy)
			s.Buildings = append(s.Buildings[:target.i], s.Buildings[target.i+1:]...)
		}
		s.PendingRevoltSacrifice = false
		finishRound(s)
		return s

	default:
		return s
	}
}

// finishRound is the END_ROUND tail: banks any pending Culture bonus, checks
// mastery tracks, and either ends the game or advances to the next round. Shared
// by ActionEndRound directly (no Revolt to resolve) and ActionResolveRevoltSacrifice
// (once the sacrifice is chosen) so a pending Revolt genuinely pauses the round
// instead of resolving inline.
func finishRound(s *GameState) {
	// Spend any pending culture-bonus tokens automatically isn't possible without a
	// target, so they stay banked as Great Person-style tokens for the player to use.
	if s.pendingCultureBonus > 0 {
		s.GreatPersonTokens += s.pendingCultureBonus
		s.pendingCultureBonus = 0
	}

	checkMasteryTracks(s)

	if s.Round >= s.MaxRounds {
		s.Phase = PhaseGameOver
		score := ComputeScore(s)
		s.GameOverScore = &score
		logEntry(s, fmt.Sprintf("Round %d complete. The Empire's history is written.", s.MaxRounds))
		return
	}

	s.Round++
	s.Phase = PhaseDice
}

func activateBuilding(s *GameState, t BuildingType, count int, scienceTarget ScienceTarget) {
	switch t {
	case BuildingFarm:
		for i := 0; i < count; i++ {
			addWorker(s)
		}
	case BuildingMine:
		addGold(s, count)
	case BuildingSchool:
		markScience(s, count, scienceTarget)
	case BuildingGarrison:
		for i := 0; i < count; i++ {
			worker := findWorker(s)
			if worker == nil {
				break
			}
			worker.State = SlotEmpty
			placed := false
			for idx := range s.MilitaryBoxes {
				if !s.MilitaryBoxes[idx] {
					s.MilitaryBoxes[idx] = true
					placed = true
					break
				}
			}
			_ = placed
		}
	}
}

func activateColonyBoost(s *GameState, target BuildingType, scienceTarget ScienceTarget) {
	// Solo bonus: activating the Colony activates one other building type as if
	// you had 2 more of it staffed. Player picks which type; see README.
	count := staffedCountByType(s, target) + 2
	activateBuilding(s, target, count, scienceTarget)
	logEntry(s, fmt.Sprintf("Colony activated: treated as 2 extra %ss this round.", BuildingDefs[target].Name))
}

func ComputeScore(s *GameState) ScoreBreakdown {
	count := func(t BuildingType) int { return staffedCountByType(s, t) }
	farms := count(BuildingFarm) * BuildingDefs[BuildingFarm].ScorePerBuilding
	mines := count(BuildingMine) * BuildingDefs[BuildingMine].ScorePerBuilding
	schools := count(BuildingSchool) * BuildingDefs[BuildingSchool].ScorePerBuilding
	garrisons := count(BuildingGarrison) * BuildingDefs[BuildingGarrison].ScorePerBuilding
	colonies := count(BuildingColony) * BuildingDefs[BuildingColony].ScorePerBuilding
	palace := 0
	for _, b := range s.Buildings {
		if b.Type == BuildingPalace {
			palace = BuildingDefs[BuildingPalace].ScorePerBuilding
			break
		}
	}
	gold := s.Gold
	filledMilitary := 0
	for _, b := range s.MilitaryBoxes {
		if b {
			filledMilitary++
		}
	}
	armies := (filledMilitary / 2) * 3
	mastery := s.Masteries.Len() * 21
	// Column bonuses are immediate Worker/Gold/Science/Happiness grants (see
	// checkCultureColumn), not deferred points — they're already reflected above via
	// gold, and via happinessVal/mastery below, so they aren't added again here.
	culture := 0
	for _, r := range s.CultureRows {
		if r.Completed {
			culture += r.Score
		}
	}
	happinessVal := trackValue(HappinessTrack, s.Happiness)
	unhappinessVal := trackValue(UnhappinessTrack, s.Unhappiness)
	happinessNet := happinessVal - unhappinessVal
	total := farms + mines + schools + garrisons + colonies + palace + gold + armies + mastery + culture + happinessNet
	return ScoreBreakdown{
		Farms: farms, Mines: mines, Schools: schools, Garrisons: garrisons,
		Colonies: colonies, Palace: palace, Gold: gold, Armies: armies,
		Mastery: mastery, Culture: culture, HappinessNet: happinessNet, Total: total,
	}
}

// --- small local helpers (no TS equivalent needed — Go just doesn't have
// Array.prototype.every/find/filter, so these keep the reducer above readable) ---

func allFilled(cells []*CultureCell) bool {
	for _, c := range cells {
		if !c.Filled {
			return false
		}
	}
	return true
}

func workerSlots(s *GameState) []*PopulationSlot {
	out := []*PopulationSlot{}
	for _, p := range s.Population {
		if p.State == SlotWorker {
			out = append(out, p)
		}
	}
	return out
}

func findWorker(s *GameState) *PopulationSlot {
	for _, p := range s.Population {
		if p.State == SlotWorker {
			return p
		}
	}
	return nil
}

func indices(bs []bool) []int {
	out := make([]int, len(bs))
	for i := range bs {
		out[i] = i
	}
	return out
}

func trackValue(track []int, idx int) int {
	if idx < 0 || idx >= len(track) {
		return 0
	}
	return track[idx]
}

func joinInts(vals []string) string {
	out := ""
	for i, v := range vals {
		if i > 0 {
			out += ", "
		}
		out += v
	}
	return out
}
