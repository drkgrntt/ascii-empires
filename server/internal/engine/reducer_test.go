package engine

import "testing"

// These mirror the ad-hoc smoke tests run against the TS engine while building
// each fix in src/engine/ — same scenarios, same expected outcomes, now as real
// Go tests so this port has its own regression coverage instead of trusting the
// translation by eye.

func TestCreateInitialStateTrackLengths(t *testing.T) {
	s := CreateInitialState()
	if got := len(s.Population); got != 35 {
		t.Errorf("population slots = %d, want 35", got)
	}
	if s.GoldTrackMax != 49 {
		t.Errorf("gold track max = %d, want 49", s.GoldTrackMax)
	}
	if got := len(s.MilitaryBoxes); got != 14 {
		t.Errorf("military boxes = %d, want 14", got)
	}
	workers := 0
	for _, p := range s.Population {
		if p.State == SlotWorker {
			workers++
		}
	}
	if workers != 3 {
		t.Errorf("starting workers = %d, want 3", workers)
	}
}

func devPhase(s *GameState) *GameState {
	s = GameReducer(s, Action{Type: ActionRollDice})
	s = GameReducer(s, Action{Type: ActionConfirmDiplomacy})
	// Neutralize random disaster fallout so tests stay deterministic — a stray
	// Revolt/Raid could otherwise eat the building/army the test relies on.
	s.PendingRaidDefense = false
	s.PendingRevolt = false
	s.PendingDrought = false
	s.Unhappiness = 0
	return s
}

func firstUnusedDie(s *GameState) *Die {
	for _, d := range s.Dice {
		if d.UsedFor == nil {
			return d
		}
	}
	return nil
}

func TestModifyDieSpendsGoldAndOnlyInDevelopment(t *testing.T) {
	s := CreateInitialState()
	s.Gold = 10
	s = GameReducer(s, Action{Type: ActionRollDice})
	die := firstUnusedDie(s)
	// Pin the roll away from 1 — CONFIRM_DIPLOMACY's Disasters phase rerolls any die
	// still showing 1, which would invalidate the "before" value captured next.
	die.Value = 4
	before := die.Value

	// Wrong phase (diplomacy): should no-op.
	s = GameReducer(s, Action{Type: ActionModifyDie, ID: die.ID, Delta: 1})
	if s.Gold != 10 {
		t.Fatalf("MODIFY_DIE applied outside development phase (gold=%d)", s.Gold)
	}

	s = GameReducer(s, Action{Type: ActionConfirmDiplomacy})
	die = dieByID(s, die.ID)
	s = GameReducer(s, Action{Type: ActionModifyDie, ID: die.ID, Delta: 1})
	die = dieByID(s, die.ID)
	if die.Value != before+1 {
		t.Errorf("die value = %d, want %d", die.Value, before+1)
	}
	if s.Gold != 9 {
		t.Errorf("gold after modify = %d, want 9", s.Gold)
	}
}

func disasterRow(s *GameState, dieValue int) *DisasterRow {
	for _, r := range s.DisasterRows {
		if r.DieValue == dieValue {
			return r
		}
	}
	return nil
}

func countMarks(row *DisasterRow) int {
	n := 0
	for _, b := range row.Boxes {
		if b {
			n++
		}
	}
	return n
}

// Rulebook p.10 / Diplomacy's own hint ("those with a value of 1... about to
// trigger Disasters in the following phase"): only dice that show 1 interact
// with the Disaster grid at all. A round with zero 1s should leave the grid
// untouched, even though every die's face value nominally matches a row.
func TestDisastersUntouchedWhenNoOnesRolled(t *testing.T) {
	s := CreateInitialState()
	s = GameReducer(s, Action{Type: ActionRollDice})
	vals := []int{4, 5, 3, 5, 6}
	for i, d := range s.Dice {
		d.Value = vals[i]
	}
	s = GameReducer(s, Action{Type: ActionConfirmDiplomacy})
	for _, r := range s.DisasterRows {
		if got := countMarks(r); got != 0 {
			t.Errorf("row %d has %d marks, want 0 (no die ever showed 1)", r.DieValue, got)
		}
	}
}

// A die that shows 1 marks row 1 (Drought's row — the only way it's ever
// reachable, since the reroll loop guarantees no die ends the phase still
// showing 1), then its post-reroll value marks that row too. Dice that were
// never 1 mark nothing, even though they sit right next to the ones that do.
func TestDisastersMarkRowOneAndRerolledDiesRowOnly(t *testing.T) {
	s := CreateInitialState()
	s = GameReducer(s, Action{Type: ActionRollDice})
	s.Dice[0].Value = 1
	others := []int{4, 3, 5, 6}
	for i := 1; i < len(s.Dice); i++ {
		s.Dice[i].Value = others[i-1]
	}
	rerolledID := s.Dice[0].ID
	s = GameReducer(s, Action{Type: ActionConfirmDiplomacy})

	rerolledDie := dieByID(s, rerolledID)
	if rerolledDie.Value == 1 {
		t.Fatalf("die that started as 1 still shows 1 after the Disasters phase")
	}
	for _, r := range s.DisasterRows {
		got := countMarks(r)
		switch r.DieValue {
		case 1:
			// The die may have chain-rerolled through 1 more than once (each
			// occurrence marks row 1 again), so only a lower bound is exact.
			if got < 1 {
				t.Errorf("row 1 marks = %d, want >= 1", got)
			}
		case rerolledDie.Value:
			if got != 1 {
				t.Errorf("row %d (rerolled die's final value) marks = %d, want 1", r.DieValue, got)
			}
		default:
			if got != 0 {
				t.Errorf("row %d marks = %d, want 0 (never-1 die)", r.DieValue, got)
			}
		}
	}
}

func TestMountainCostsGoldNotBlocked(t *testing.T) {
	s := CreateInitialState()
	// Find a mountain cell.
	var mx, my int
	found := false
	for y := 0; y < MapHeight && !found; y++ {
		for x := 0; x < MapWidth; x++ {
			if TerrainAt(x, y) == TerrainMountains {
				mx, my = x, y
				found = true
				break
			}
		}
	}
	if !found {
		t.Fatal("no mountain cell found on map")
	}

	s.Gold = 0
	blocked := CanPlaceBuilding(s, BuildingFarm, mx, my)
	if blocked.OK {
		t.Error("expected mountain build blocked with 0 gold")
	}

	s.Gold = 5
	allowed := CanPlaceBuilding(s, BuildingFarm, mx, my)
	if !allowed.OK {
		t.Errorf("expected mountain build allowed with gold, got reason: %s", allowed.Reason)
	}
}

func TestTradeRow0ExactReward(t *testing.T) {
	s := CreateInitialState()
	s = devPhase(s)

	// Row 0 needs [5,6]. Fill first cell manually (matches the TS smoke test's
	// approach of forcing a completable state rather than waiting on real rolls).
	s.TradeRows[0].Cells[0].Filled = true
	die := firstUnusedDie(s)
	die.Value = 6

	goldBefore, happyBefore, sciBefore := s.Gold, s.Happiness, s.ScienceTrunkMarked
	s = GameReducer(s, Action{Type: ActionAssignDie, ID: die.ID, Use: &DieUse{Kind: UseTrade, Row: 0}})

	if !s.TradeRows[0].Completed {
		t.Fatal("trade row 0 not completed")
	}
	if got := s.Happiness - happyBefore; got != 1 {
		t.Errorf("happiness delta = %d, want 1", got)
	}
	if got := s.Gold - goldBefore; got != 3 {
		t.Errorf("gold delta = %d, want 3", got)
	}
	if got := s.ScienceTrunkMarked - sciBefore; got != 1 {
		t.Errorf("science delta = %d, want 1 (trunk marked)", got)
	}
}

func TestPopulationGreatPersonGroupSizes(t *testing.T) {
	s := CreateInitialState()
	for i := 0; i < 6; i++ {
		s.Population[i].State = SlotWorker
	}
	if s.GreatPersonTokens != 0 {
		t.Fatalf("unexpected tokens before any group-check trigger: %d", s.GreatPersonTokens)
	}

	s.Buildings = append(s.Buildings, &BuildingInstance{Type: BuildingFarm, Staffed: true, Cell: MapCoord{X: 1, Y: 11}})
	s = devPhase(s)
	die := firstUnusedDie(s)
	die.Value = 2
	s = GameReducer(s, Action{Type: ActionAssignDie, ID: die.ID, Use: &DieUse{Kind: UseActivate, Building: BuildingFarm}})

	workers := 0
	for _, p := range s.Population {
		if p.State == SlotWorker {
			workers++
		}
	}
	if workers != 7 {
		t.Errorf("workers after farm activation = %d, want 7", workers)
	}
	if s.GreatPersonTokens != 1 {
		t.Errorf("great person tokens = %d, want 1 (group of 6 completed)", s.GreatPersonTokens)
	}
}

func TestIronDoublesAttackPower(t *testing.T) {
	s := CreateInitialState()
	s.ScienceBranchMarked[BranchEngineeringApproach] = ScienceBranches[BranchEngineeringApproach].Length
	s.ScienceTrunkMarked = ScienceTrunkLength
	s.ScienceBranchMarked[BranchWallsIron] = 7 // Iron milestone is at index 7
	s.MilitaryBoxes[0] = true
	s.MilitaryBoxes[1] = true // 1 Army
	s.BarbarianCells = []*BarbarianSite{
		{MapCoord: MapCoord{X: 0, Y: 0}, Destroyed: false},
		{MapCoord: MapCoord{X: 1, Y: 0}, Destroyed: false},
	}
	s.BarbarianCamps = 2
	s.Phase = PhaseDeployment

	s = GameReducer(s, Action{Type: ActionDeployBarbarian})
	if s.DeployedThisRound != 1 || s.BankedAttackPower != 1 || s.BarbarianCamps != 1 {
		t.Fatalf("after 1st destroy: deployed=%d banked=%d camps=%d (want 1,1,1)", s.DeployedThisRound, s.BankedAttackPower, s.BarbarianCamps)
	}

	s = GameReducer(s, Action{Type: ActionDeployBarbarian})
	if s.DeployedThisRound != 1 || s.BankedAttackPower != 0 || s.BarbarianCamps != 0 {
		t.Fatalf("after 2nd destroy (should reuse banked power, no new army): deployed=%d banked=%d camps=%d (want 1,0,0)", s.DeployedThisRound, s.BankedAttackPower, s.BarbarianCamps)
	}
}

func TestDroughtIsARealChoiceNotForced(t *testing.T) {
	s := CreateInitialState()
	s.PendingDrought = true
	before := 0
	for _, p := range s.Population {
		if p.State == SlotWorker {
			before++
		}
	}

	// Choosing unhappiness must be honored even though 3 Workers are available.
	s = GameReducer(s, Action{Type: ActionResolveDrought, Choice: "unhappiness"})
	after := 0
	for _, p := range s.Population {
		if p.State == SlotWorker {
			after++
		}
	}
	if after != before {
		t.Errorf("workers changed (%d -> %d) despite choosing unhappiness", before, after)
	}
	if s.Unhappiness != 1 {
		t.Errorf("unhappiness = %d, want 1", s.Unhappiness)
	}
	if s.PendingDrought {
		t.Error("pendingDrought still true after resolving")
	}
}

func TestDestroyedBuildingFootprintStaysBlocked(t *testing.T) {
	s := CreateInitialState()
	cell := MapCoord{X: 9, Y: 11} // a plains cell
	s.DestroyedBuildingCells = append(s.DestroyedBuildingCells, &cell)

	if CanPlaceBuilding(s, BuildingFarm, 9, 11).OK {
		t.Error("expected same-cell rebuild blocked by ruin")
	}
	if CanPlaceBuilding(s, BuildingFarm, 10, 11).OK {
		t.Error("expected adjacent-cell build blocked by touching a ruin")
	}
	// (20,5) is in the northern Plains region (unlike (20,11), which is now in the
	// southern Mountains band and would need Gold — see computeTerrain), so it stays
	// freely buildable and isolates the ruin-blocking behavior this test checks.
	if !CanPlaceBuilding(s, BuildingFarm, 20, 5).OK {
		t.Error("expected an unrelated cell to remain buildable")
	}
}

func TestScienceBranchingFullTree(t *testing.T) {
	s := CreateInitialState()
	s.MaxRounds = 10000 // enough rounds for ~48 School activations
	s.Buildings = append(s.Buildings, &BuildingInstance{Type: BuildingSchool, Staffed: true, Cell: MapCoord{X: 9, Y: 5}})

	activate := func(target ScienceTarget) {
		s = devPhase(s)
		die := firstUnusedDie(s)
		die.Value = 4
		s = GameReducer(s, Action{Type: ActionAssignDie, ID: die.ID, Use: &DieUse{Kind: UseActivate, Building: BuildingSchool, ScienceTarget: target}})
		s = GameReducer(s, Action{Type: ActionEndDevelopment})
		s = GameReducer(s, Action{Type: ActionEndRound})
	}

	for i := 0; i < 4; i++ {
		activate(TargetTrunk)
	}
	if s.ScienceTrunkMarked != 4 {
		t.Fatalf("trunk marked = %d, want 4", s.ScienceTrunkMarked)
	}
	if !hasMilestone(s, MilestoneIrrigation) {
		t.Error("irrigation not unlocked after trunk complete")
	}

	for i := 0; i < 16; i++ {
		activate(ScienceTarget(BranchPhilosophy))
	}
	if s.ScienceBranchMarked[BranchPhilosophy] != 16 {
		t.Fatalf("philosophy marked = %d, want 16", s.ScienceBranchMarked[BranchPhilosophy])
	}
	if !s.DiceUnlocked.Green {
		t.Error("green die not unlocked")
	}
	if !s.Masteries.Has("science-philosophy") {
		t.Error("science-philosophy mastery not granted")
	}

	for i := 0; i < 10; i++ {
		activate(ScienceTarget(BranchEngineeringApproach))
	}
	if s.ScienceBranchMarked[BranchEngineeringApproach] != 10 {
		t.Fatalf("engineeringApproach marked = %d, want 10", s.ScienceBranchMarked[BranchEngineeringApproach])
	}

	for i := 0; i < 7; i++ {
		activate(ScienceTarget(BranchEngineeringBranch))
	}
	if !s.DiceUnlocked.Black {
		t.Error("black die not unlocked")
	}
	if !s.Masteries.Has("science-engineeringBranch") {
		t.Error("science-engineeringBranch mastery not granted")
	}

	for i := 0; i < 11; i++ {
		activate(ScienceTarget(BranchWallsIron))
	}
	if !hasMilestone(s, MilestoneWalls) || !hasMilestone(s, MilestoneIron) {
		t.Error("walls/iron milestones not both reached")
	}
	if !s.Masteries.Has("science-wallsIron") {
		t.Error("science-wallsIron mastery not granted")
	}

	wantMasteries := []string{"science-philosophy", "science-engineeringBranch", "science-wallsIron"}
	for _, m := range wantMasteries {
		if !s.Masteries.Has(m) {
			t.Errorf("missing mastery %q; have %v", m, s.Masteries)
		}
	}
}

func TestFullRoundCycleAndGameOverScoring(t *testing.T) {
	s := CreateInitialState()
	s.MaxRounds = 1
	s = devPhase(s)
	if s.Phase != PhaseDevelopment {
		t.Fatalf("phase = %s, want development", s.Phase)
	}
	s = GameReducer(s, Action{Type: ActionEndDevelopment})
	if s.Phase != PhaseDeployment {
		t.Fatalf("phase = %s, want deployment", s.Phase)
	}
	s = GameReducer(s, Action{Type: ActionEndRound})
	if s.Phase != PhaseGameOver {
		t.Fatalf("phase = %s, want gameover (maxRounds=1)", s.Phase)
	}
	if s.GameOverScore == nil {
		t.Fatal("gameOverScore is nil at game over")
	}
	if s.GameOverScore.Total != 0 {
		t.Errorf("total score = %d, want 0 for a bare starting Empire", s.GameOverScore.Total)
	}
}

func TestRevoltSacrificeIsChosenAtResolutionNotPrePicked(t *testing.T) {
	s := CreateInitialState()
	s.Phase = PhaseDeployment
	s.PendingRevolt = true
	s.Buildings = []*BuildingInstance{
		{Type: BuildingFarm, Staffed: true, Cell: MapCoord{X: 3, Y: 12}},  // score 2
		{Type: BuildingSchool, Staffed: true, Cell: MapCoord{X: 9, Y: 6}}, // score 4
	}
	round := s.Round

	// An unresolved Revolt must pause the round, not resolve inline.
	s = GameReducer(s, Action{Type: ActionEndRound})
	if s.Round != round {
		t.Fatalf("round advanced despite unresolved Revolt: %d -> %d", round, s.Round)
	}
	if !s.PendingRevoltSacrifice || len(s.Buildings) != 2 {
		t.Fatalf("expected pendingRevoltSacrifice=true, buildings untouched; got pending=%v buildings=%d", s.PendingRevoltSacrifice, len(s.Buildings))
	}

	// Re-dispatching END_ROUND while the prompt is pending must no-op.
	again := GameReducer(s, Action{Type: ActionEndRound})
	if again.Round != round || !again.PendingRevoltSacrifice {
		t.Fatal("END_ROUND re-dispatch bypassed the pending sacrifice prompt")
	}

	// Explicitly choosing the School (index 1) — not the auto lowest-scoring Farm.
	idx := 1
	s = GameReducer(s, Action{Type: ActionResolveRevoltSacrifice, Index: &idx})
	if s.Round != round+1 {
		t.Errorf("round did not advance after resolving sacrifice: %d", s.Round)
	}
	if s.PendingRevoltSacrifice {
		t.Error("pendingRevoltSacrifice still true after resolving")
	}
	if len(s.Buildings) != 1 || s.Buildings[0].Type != BuildingFarm {
		t.Errorf("expected only the Farm to remain; got %+v", s.Buildings)
	}
	if len(s.DestroyedBuildingCells) != 1 {
		t.Errorf("expected a ruin recorded, got %d", len(s.DestroyedBuildingCells))
	}
}

func TestRevoltSacrificeAutoPicksLowestScoring(t *testing.T) {
	s := CreateInitialState()
	s.Phase = PhaseDeployment
	s.PendingRevolt = true
	s.Buildings = []*BuildingInstance{
		{Type: BuildingFarm, Staffed: true, Cell: MapCoord{X: 3, Y: 12}},
		{Type: BuildingSchool, Staffed: true, Cell: MapCoord{X: 9, Y: 6}},
	}
	s = GameReducer(s, Action{Type: ActionEndRound})
	s = GameReducer(s, Action{Type: ActionResolveRevoltSacrifice, Index: nil})
	if len(s.Buildings) != 1 || s.Buildings[0].Type != BuildingSchool {
		t.Errorf("expected auto-resolve to destroy the lower-scoring Farm, leaving School; got %+v", s.Buildings)
	}
}

func TestCloneStateIsIndependent(t *testing.T) {
	s := CreateInitialState()
	clone := CloneState(s)
	clone.Gold = 99
	clone.Population[0].State = "school"
	clone.Dice = append(clone.Dice, &Die{ID: "x"})

	if s.Gold == 99 {
		t.Error("mutating clone.Gold affected original")
	}
	if s.Population[0].State == "school" {
		t.Error("mutating clone.Population affected original (shallow slice copy bug)")
	}
	if len(s.Dice) == len(clone.Dice) {
		t.Error("mutating clone.Dice affected original")
	}
}
