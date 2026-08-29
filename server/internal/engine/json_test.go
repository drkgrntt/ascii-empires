package engine

import (
	"encoding/json"
	"testing"
)

func TestMapSiteCounts(t *testing.T) {
	if got := len(BarbarianSites); got != 5 {
		t.Errorf("barbarian sites = %d, want 5", got)
	}
	if got := len(OreCells); got != 8 {
		t.Errorf("ore cells = %d, want 8", got)
	}
	s := CreateInitialState()
	if s.BarbarianCampsTotal != 5 {
		t.Errorf("barbarianCampsTotal = %d, want 5", s.BarbarianCampsTotal)
	}
}

// The whole point of matching field names/casing to the TS types is that a
// GameState round-trips through JSON without surprises — that's both the
// Phase-2 WebSocket wire format and the GamePlayer.EmpireState jsonb column.
func TestGameStateJSONRoundTrip(t *testing.T) {
	s := CreateInitialState()
	s.Masteries.Add("gold")
	s.Masteries.Add("population")
	s.PendingRevoltSacrifice = true
	s.Dice = []*Die{
		{ID: "die-1", Color: DieWhite, Value: 4, UsedFor: &DieUse{Kind: UseActivate, Building: BuildingFarm}},
	}

	data, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var roundTripped GameState
	if err := json.Unmarshal(data, &roundTripped); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if roundTripped.Round != s.Round || roundTripped.Phase != s.Phase {
		t.Errorf("round/phase mismatch after round-trip: %d/%s vs %d/%s", roundTripped.Round, roundTripped.Phase, s.Round, s.Phase)
	}
	if len(roundTripped.Population) != len(s.Population) {
		t.Errorf("population length mismatch: %d vs %d", len(roundTripped.Population), len(s.Population))
	}
	if !roundTripped.Masteries.Has("gold") || !roundTripped.Masteries.Has("population") {
		t.Errorf("masteries not preserved: %v", roundTripped.Masteries)
	}
	if !roundTripped.PendingRevoltSacrifice {
		t.Error("pendingRevoltSacrifice not preserved")
	}
	if len(roundTripped.Dice) != 1 || roundTripped.Dice[0].UsedFor == nil || roundTripped.Dice[0].UsedFor.Kind != UseActivate {
		t.Errorf("dice/usedFor not preserved: %+v", roundTripped.Dice)
	}

	// Field names must be camelCase matching the TS types, since this JSON is what
	// the client (eventually) and Postgres jsonb both key off of.
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal to map error: %v", err)
	}
	for _, key := range []string{"round", "maxRounds", "phase", "dice", "diceUnlocked", "population", "goldTrackMax", "scienceTrunkMarked", "scienceBranchMarked", "destroyedBuildingCells", "barbarianCells", "masteries", "gameOverScore"} {
		if _, ok := raw[key]; !ok {
			t.Errorf("expected JSON key %q, not present in marshaled output", key)
		}
	}
	if _, present := raw["pendingCultureBonus"]; present {
		t.Error("unexported internal bookkeeping field leaked into JSON")
	}
}

// An Action round-trips the same way a client's JSON.stringify(action) would —
// this is literally the payload the WebSocket handler will unmarshal in Phase 2.
func TestActionJSONRoundTrip(t *testing.T) {
	raw := `{"type":"ASSIGN_DIE","id":"die-1","use":{"kind":"activate","building":"school","scienceTarget":"philosophy"}}`
	var a Action
	if err := json.Unmarshal([]byte(raw), &a); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if a.Type != ActionAssignDie || a.ID != "die-1" || a.Use == nil {
		t.Fatalf("action not parsed correctly: %+v", a)
	}
	if a.Use.Kind != UseActivate || a.Use.Building != BuildingSchool || a.Use.ScienceTarget != ScienceTarget(BranchPhilosophy) {
		t.Errorf("die use not parsed correctly: %+v", a.Use)
	}
}
