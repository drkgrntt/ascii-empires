// The Empire map (rulebook p.4-5, MAP LEGEND): buildings are constructed by drawing
// their fixed outline (see BUILDING_SHAPES below) on a dot-grid map. Water
// borders/bisects the land and can't be built on; Mountains cost 1 Gold to build
// on ("Ø to build" — Ø is the sheet's Gold-cost symbol, not "forbidden"; rulebook
// p.5 & p.11); Ore deposits are required to build a Mine; Barbarian camps sit on
// the map and are reclaimed (for a free Colony) once attacked.
//
// Sized and laid out to match the scanned sheet (docs/ASCII_Empires_Player_Sheet_Color.pdf):
// a 27x23 grid, measured directly off the sheet's colored zones and the MAP LEGEND's
// own swatch fills (confirmed from the PDF's actual vector fill colors, not just a
// raster read): Plains = green/tan (No building restrictions), Mountains = salmon
// (Ø to build) — the same salmon used for the "Barbarians" swatch right below it in
// the legend, because Barbarian camps sit *in* the Mountains, not on a separate
// cosmetic band. Two things are easy to miss at a glance and matter for map fidelity:
//  - The southern "Barbarian territory" band (salmon) IS the Mountains terrain, not a
//    cosmetic tint over Plains — it costs 1 Gold to build on, same as any Mountains.
//    It's also the *larger* of the two bands (roughly 12-13 of 21 land rows per
//    column vs. 8-9), so Mountains, not Plains, are the dominant terrain overall —
//    just dominant in the south, not the north as a first glance suggests.
//  - The dominant northern region (green/tan) plus the one-column corridor flanking
//    the strait are both free-to-build Plains; the corridor isn't a separate strip of
//    "extra-free" land carved out of an otherwise-costly north, since the whole north
//    is already Plains.
// This also matches the rulebook's own text (p.5, independent of any sheet colors):
// Ore deposits are "mostly, but not exclusively, located in the Mountains" — 6 of the
// 8 sit in the southern (salmon/Mountains) band and 2 in the northern (green/Plains)
// region, a 75/25 split that fits "mostly, not exclusively" exactly.
// See README for what's exact vs. simplified for solo play.
import type { BuildingType, GameState, MapCoord, Terrain } from './types'

export const MAP_WIDTH = 27
export const MAP_HEIGHT = 23

// The strait runs straight down at column 11 for the first few rows, then jogs one
// column west and runs straight the rest of the way — not the many-bend river the
// map originally guessed at. Water rows 0-1 are the sea; the strait itself only
// exists for rows 2-21 (it closes up before the southernmost row).
function straitColumn(y: number): number | null {
  if (y < 2 || y > 21) return null
  return y <= 6 ? 11 : 10
}

// Per-column row at which the Mountains/Barbarian-territory band begins (measured
// off the sheet — the boundary steps in a couple of places, mirroring the strait's
// own jog). The three strait-corridor columns (9-11) stay Plains (green) all the way
// down — the corridor is never Mountains — except at the very last row, where the
// strait has closed up and the Mountains band reaches all the way across.
const LAST_ROW = MAP_HEIGHT - 1
const BORDERLANDS_START_ROW_BY_COL = [
  10, 10, 11, 11, 11, 11, 11, 11, 11, LAST_ROW, LAST_ROW, LAST_ROW, 11, 11, 11, 11, 10,
  10, 10, 10, 10, 10, 10, 11, 11, 11, 11,
]

export function isBorderlands(x: number, y: number): boolean {
  return y >= (BORDERLANDS_START_ROW_BY_COL[x] ?? 11)
}

// Ore deposits (needed to build a Mine): 2 sit in the northern Plains region (free
// to build on, so a Mine there costs no Gold), the other 6 in the southern
// Mountains band itself (so a Mine there still costs the usual 1 Gold, same as any
// other building on Mountains) — a 6/8 majority, matching the rulebook's own text
// (p.5): Ore deposits are "mostly, but not exclusively, located in the Mountains."
export const ORE_CELLS: MapCoord[] = [
  { x: 20, y: 6 },
  { x: 2, y: 9 },
  { x: 21, y: 12 },
  { x: 4, y: 14 },
  { x: 14, y: 15 },
  { x: 2, y: 18 },
  { x: 17, y: 18 },
  { x: 25, y: 18 },
]

// Fixed Barbarian camp sites — 5 on the sheet (2 west of the strait, 3 east), not 3.
// Count must match BARBARIAN_CAMPS_TOTAL in gameData.ts.
export const BARBARIAN_SITES: MapCoord[] = [
  { x: 2, y: 21 },
  { x: 6, y: 21 },
  { x: 14, y: 21 },
  { x: 19, y: 21 },
  { x: 24, y: 21 },
]

// The sea borders the north edge, a winding strait splits the land into two coasts,
// a one-column Plains corridor flanks the strait, the dominant northern region is
// also free Plains, and the southern Barbarian-territory band is costly Mountains
// (Ø to build) — matching the MAP LEGEND's own swatch fills on the sheet, where
// "Mountains" and "Barbarians" share the same salmon color.
function computeTerrain(x: number, y: number): Terrain {
  if (y <= 1) return 'water'
  const strait = straitColumn(y)
  if (strait !== null) {
    if (x === strait) return 'water'
    if (x === strait - 1 || x === strait + 1) return 'plains'
  }
  if (isBorderlands(x, y)) return 'mountains'
  return 'plains'
}

export const MAP_TERRAIN: Terrain[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
  Array.from({ length: MAP_WIDTH }, (_, x) => computeTerrain(x, y)),
)

export function terrainAt(x: number, y: number): Terrain {
  return MAP_TERRAIN[y]?.[x] ?? 'water'
}

export function isOreCell(x: number, y: number): boolean {
  return ORE_CELLS.some((c) => c.x === x && c.y === y)
}

export function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT
}

// A destroyed building's plot stays blocked for the rest of the game — "may not
// touch or overlap other buildings... including with buildings previously
// destroyed by game effects" (rulebook p.5); Revolt spells this out too: "No new
// buildings may be built in the same space" (p.10). So both checks below also
// consult the ruins list, not just the currently-standing buildings.
export function cellOccupied(s: GameState, x: number, y: number): boolean {
  if (s.buildings.some((b) => b.cells.some((c) => c.x === x && c.y === y))) return true
  return s.destroyedBuildingCells.some((c) => c.x === x && c.y === y)
}

// Buildings (including the Colony) can't touch — checked including diagonals.
// `cells` is the full set of plots one candidate building would occupy;
// adjacency to one of that same building's own cells doesn't count (they're
// meant to touch each other — that's what makes it one shape).
function touchesBuilding(s: GameState, cells: MapCoord[]): boolean {
  const isOwn = (c: MapCoord) => cells.some((fc) => fc.x === c.x && fc.y === c.y)
  const adjacent = (a: MapCoord, b: MapCoord) =>
    Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && !(a.x === b.x && a.y === b.y)
  for (const cell of cells) {
    for (const b of s.buildings) {
      if (b.cells.some((bc) => !isOwn(bc) && adjacent(cell, bc))) return true
    }
    if (s.destroyedBuildingCells.some((bc) => !isOwn(bc) && adjacent(cell, bc))) return true
  }
  return false
}

// --- Building shapes (rulebook p.5-6: buildings are drawn as fixed outlines on
// the dot-grid map, "in the orientation shown on the Empire sheet — you cannot
// rotate them"). Each shape below is read directly off the sheet's BUILDINGS
// section, as offsets from the building's labelled cell ("F"/"M"/"S"/"G", or the
// centered "@" for the Palace) — that labelled cell is also the anchor a player
// clicks on the map to place the building, so the clicked plot always ends up
// part of the finished shape. Line counts double as a checksum: each polyomino
// below has a perimeter matching the sheet's "(N)" lines-to-complete exactly.
export const BUILDING_SHAPES: Record<BuildingType, MapCoord[]> = {
  // Farm (8 lines): an L-tromino — two plots in the row above the anchor, plus
  // the anchor itself.
  farm: [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 0, y: 0 },
  ],
  // Mine (8 lines): a solid 2x2 square. The Ore deposit sits in the top-right
  // cell on the sheet, but the square has no rotational asymmetry, so only "an
  // Ore deposit somewhere in the footprint" matters here.
  mine: [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ],
  // School (12 lines): solid 3-wide top row, notched underneath the middle
  // (an open archway below the anchor).
  school: [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
  ],
  // Garrison (12 lines): mirror of the School — crenellated top (two towers
  // flanking a gap), solid 3-wide bottom row.
  garrison: [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ],
  // Colony: granted free on a single reclaimed Barbarian plot — no lines are
  // drawn for it (the sheet's Colony template is for tracking on an *opponent's*
  // sheet only, moot in solo play).
  colony: [{ x: 0, y: 0 }],
  // Palace (24 lines): a crenellated 5-wide, 3-tall keep with an extra tower
  // rising above the center merlon and a notch at the bottom center — anchored
  // on its centered "@" cell.
  palace: [
    { x: 0, y: -2 },
    { x: -2, y: -1 },
    { x: 0, y: -1 },
    { x: 2, y: -1 },
    { x: -2, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: -2, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
}

// Every plot a building of `type` would occupy if its anchor (the labelled cell
// a player clicks) is placed at (x, y).
export function buildingFootprint(type: BuildingType, x: number, y: number): MapCoord[] {
  return BUILDING_SHAPES[type].map((o) => ({ x: x + o.x, y: y + o.y }))
}

export interface PlacementCheck {
  ok: boolean
  reason?: string
}

export function canPlaceBuilding(s: GameState, type: BuildingType, x: number, y: number): PlacementCheck {
  const cells = buildingFootprint(type, x, y)
  for (const c of cells) {
    if (!isInBounds(c.x, c.y)) return { ok: false, reason: 'Off the map.' }
    if (terrainAt(c.x, c.y) === 'water') return { ok: false, reason: 'Water cannot be built on.' }
  }
  // Mountains don't block building — "Ø to build" is the sheet's Gold-cost symbol
  // (Symbols table, rulebook p.11), not a prohibition. If any part of a building's
  // outline touches Mountainous terrain it costs 1 Gold, and you simply can't build
  // there with none (rulebook p.5). The 6 Ore deposits sitting on Mountains (in the
  // southern Barbarian-territory band) work the same way — a Mine there still costs
  // the 1 Gold.
  if (cells.some((c) => terrainAt(c.x, c.y) === 'mountains') && s.gold < 1) {
    return { ok: false, reason: 'Building on Mountains costs 1 Gold, and you have none.' }
  }
  if (cells.some((c) => cellOccupied(s, c.x, c.y))) return { ok: false, reason: 'That plot is already built on.' }
  if (touchesBuilding(s, cells)) return { ok: false, reason: 'Buildings cannot touch each other.' }
  if (type === 'mine' && !cells.some((c) => isOreCell(c.x, c.y))) {
    return { ok: false, reason: 'Mines require an Ore deposit within their footprint.' }
  }
  if (type === 'colony') {
    const site = s.barbarianCells.find((c) => c.x === x && c.y === y)
    if (!site || !site.destroyed) return { ok: false, reason: 'The Colony can only be built on reclaimed Barbarian land.' }
  }
  return { ok: true }
}
