package engine

// The Empire map (rulebook p.4-5, MAP LEGEND): buildings are constructed by drawing
// a square on a dot-grid map. Water borders/bisects the land and can't be built on;
// Mountains cost 1 Gold to build on ("Ø to build" — Ø is the sheet's Gold-cost
// symbol, not "forbidden"; rulebook p.5 & p.11); Ore deposits are required to build
// a Mine; Barbarian camps sit on the map and are reclaimed (for a free Colony) once
// attacked.
//
// Sized and laid out to match the scanned sheet (docs/ASCII_Empires_Player_Sheet_Color.pdf):
// a 27x23 grid, measured directly off the sheet's colored zones (Plains = green,
// Mountains = tan, Barbarian territory = salmon). Two things about the real sheet
// are easy to miss at a glance and matter for map fidelity:
//   - Mountains, not Plains, are the *dominant* terrain — the tan zone covers most of
//     the map's northern two-thirds. The only *free* land up there is a one-column
//     Plains corridor hugging each side of the strait; the rest costs 1 Gold to build on.
//   - The southern "Barbarian territory" band (salmon) is cosmetic, not a third terrain:
//     it's fully buildable ground, just tinted to mark it as raid-prone.

const MapWidth = 27
const MapHeight = 23

// The strait runs straight down at column 11 for the first few rows, then jogs one
// column west and runs straight the rest of the way — not the many-bend river the
// map originally guessed at. Water rows 0-1 are the sea; the strait itself only
// exists for rows 2-21 (it closes up before the southernmost row).
func straitColumn(y int) (col int, ok bool) {
	if y < 2 || y > 21 {
		return 0, false
	}
	if y <= 6 {
		return 11, true
	}
	return 10, true
}

// Per-column row at which the Barbarian-territory tint begins (measured off the
// sheet — the boundary steps in a couple of places, mirroring the strait's own jog).
// The three strait-corridor columns (9-11) stay untinted Plains all the way down —
// on the sheet that strip reads green, never salmon — except at the very last row,
// where the strait has closed up and the tint reaches all the way across.
const lastRow = MapHeight - 1

var borderlandsStartRowByCol = []int{
	10, 10, 11, 11, 11, 11, 11, 11, 11, lastRow, lastRow, lastRow, 11, 11, 11, 11, 10,
	10, 10, 10, 10, 10, 10, 11, 11, 11, 11,
}

func IsBorderlands(x, y int) bool {
	threshold := 11
	if x >= 0 && x < len(borderlandsStartRowByCol) {
		threshold = borderlandsStartRowByCol[x]
	}
	return y >= threshold
}

// Ore deposits (needed to build a Mine): 2 sit in the northern Mountains band itself
// (so that Mine costs the usual 1 Gold, same as any other building on Mountains),
// the other 6 in the south.
var OreCells = []MapCoord{
	{X: 20, Y: 6},
	{X: 2, Y: 9},
	{X: 21, Y: 12},
	{X: 4, Y: 14},
	{X: 14, Y: 15},
	{X: 2, Y: 18},
	{X: 17, Y: 18},
	{X: 25, Y: 18},
}

// Fixed Barbarian camp sites — 5 on the sheet (2 west of the strait, 3 east), not 3.
// Count must match BarbarianCampsTotal.
var BarbarianSites = []MapCoord{
	{X: 2, Y: 21},
	{X: 6, Y: 21},
	{X: 14, Y: 21},
	{X: 19, Y: 21},
	{X: 24, Y: 21},
}

// The sea borders the north edge, a winding strait splits the land into two coasts,
// a one-column Plains corridor flanks the strait, Barbarian territory (south) is
// buildable ground, and everything else north of it is blocked Mountains.
func computeTerrain(x, y int) Terrain {
	if y <= 1 {
		return TerrainWater
	}
	if strait, ok := straitColumn(y); ok {
		if x == strait {
			return TerrainWater
		}
		if x == strait-1 || x == strait+1 {
			return TerrainPlains
		}
	}
	if IsBorderlands(x, y) {
		return TerrainPlains
	}
	return TerrainMountains
}

var mapTerrain = func() [][]Terrain {
	grid := make([][]Terrain, MapHeight)
	for y := 0; y < MapHeight; y++ {
		row := make([]Terrain, MapWidth)
		for x := 0; x < MapWidth; x++ {
			row[x] = computeTerrain(x, y)
		}
		grid[y] = row
	}
	return grid
}()

func TerrainAt(x, y int) Terrain {
	if y < 0 || y >= MapHeight || x < 0 || x >= MapWidth {
		return TerrainWater
	}
	return mapTerrain[y][x]
}

func IsOreCell(x, y int) bool {
	for _, c := range OreCells {
		if c.X == x && c.Y == y {
			return true
		}
	}
	return false
}

func IsInBounds(x, y int) bool {
	return x >= 0 && x < MapWidth && y >= 0 && y < MapHeight
}

// A destroyed building's plot stays blocked for the rest of the game — "may not
// touch or overlap other buildings... including with buildings previously
// destroyed by game effects" (rulebook p.5); Revolt spells this out too: "No new
// buildings may be built in the same space" (p.10). So both checks below also
// consult the ruins list, not just the currently-standing buildings.
func CellOccupied(s *GameState, x, y int) bool {
	for _, b := range s.Buildings {
		if b.Cell.X == x && b.Cell.Y == y {
			return true
		}
	}
	for _, c := range s.DestroyedBuildingCells {
		if c.X == x && c.Y == y {
			return true
		}
	}
	return false
}

// Buildings (including the Colony) can't touch — checked including diagonals, since
// each building occupies one plot in this simplified square-grid model.
func TouchesBuilding(s *GameState, x, y int) bool {
	adjacent := func(cx, cy int) bool {
		dx, dy := cx-x, cy-y
		if dx < 0 {
			dx = -dx
		}
		if dy < 0 {
			dy = -dy
		}
		return dx <= 1 && dy <= 1 && !(cx == x && cy == y)
	}
	for _, b := range s.Buildings {
		if adjacent(b.Cell.X, b.Cell.Y) {
			return true
		}
	}
	for _, c := range s.DestroyedBuildingCells {
		if adjacent(c.X, c.Y) {
			return true
		}
	}
	return false
}

type PlacementCheck struct {
	OK     bool
	Reason string
}

func ok() PlacementCheck                { return PlacementCheck{OK: true} }
func fail(reason string) PlacementCheck { return PlacementCheck{OK: false, Reason: reason} }

func CanPlaceBuilding(s *GameState, buildingType BuildingType, x, y int) PlacementCheck {
	if !IsInBounds(x, y) {
		return fail("Off the map.")
	}
	terrain := TerrainAt(x, y)
	if terrain == TerrainWater {
		return fail("Water cannot be built on.")
	}
	// Mountains don't block building — "Ø to build" is the sheet's Gold-cost symbol
	// (Symbols table, rulebook p.11), not a prohibition. If any part of a building's
	// outline touches Mountainous terrain it costs 1 Gold, and you simply can't build
	// there with none (rulebook p.5). The 2 Ore deposits sitting on Mountains work the
	// same way — a Mine there still costs the 1 Gold.
	if terrain == TerrainMountains && s.Gold < 1 {
		return fail("Building on Mountains costs 1 Gold, and you have none.")
	}
	if CellOccupied(s, x, y) {
		return fail("That plot is already built on.")
	}
	if TouchesBuilding(s, x, y) {
		return fail("Buildings cannot touch each other.")
	}
	if buildingType == BuildingMine && !IsOreCell(x, y) {
		return fail("Mines require an Ore deposit.")
	}
	if buildingType == BuildingColony {
		var site *BarbarianSite
		for _, c := range s.BarbarianCells {
			if c.X == x && c.Y == y {
				site = c
				break
			}
		}
		if site == nil || !site.Destroyed {
			return fail("The Colony can only be built on reclaimed Barbarian land.")
		}
	}
	return ok()
}
