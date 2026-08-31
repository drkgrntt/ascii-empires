import { describe, expect, it } from 'vitest'
import { createInitialState } from '../initialState'
import { BUILDING_DEFS } from '../gameData'
import type { BuildingType, MapCoord } from '../types'
import {
  BUILDING_SHAPES,
  MAP_HEIGHT,
  MAP_WIDTH,
  buildingFootprint,
  canPlaceBuilding,
  isInBounds,
  isOreCell,
  terrainAt,
} from '../map'

// Perimeter of the polyomino formed by `cells` (unit squares glued edge-to-edge):
// each square contributes 4, and every shared edge between two of the building's
// own cells removes 2 (one side from each square). The BUILDING_SHAPES comments
// claim this matches each building's rulebook "(N) lines to complete" exactly.
function perimeter(cells: MapCoord[]): number {
  let sharedEdges = 0
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const dx = Math.abs(cells[i].x - cells[j].x)
      const dy = Math.abs(cells[i].y - cells[j].y)
      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) sharedEdges++
    }
  }
  return cells.length * 4 - sharedEdges * 2
}

function findCell(predicate: (x: number, y: number) => boolean): MapCoord {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (predicate(x, y)) return { x, y }
    }
  }
  throw new Error('no matching cell found on the map')
}

function findAllPlainsAnchor(type: BuildingType, avoidOre = false): MapCoord {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const cells = buildingFootprint(type, x, y)
      if (!cells.every((c) => isInBounds(c.x, c.y) && terrainAt(c.x, c.y) === 'plains')) continue
      if (avoidOre && cells.some((c) => isOreCell(c.x, c.y))) continue
      return { x, y }
    }
  }
  throw new Error(`no all-plains anchor found for ${type}`)
}

function findFarmAnchorOnMountains(): MapCoord {
  for (let y = 1; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH - 1; x++) {
      const cells = buildingFootprint('farm', x, y)
      if (!cells.every((c) => isInBounds(c.x, c.y) && terrainAt(c.x, c.y) !== 'water')) continue
      if (cells.some((c) => terrainAt(c.x, c.y) === 'mountains')) return { x, y }
    }
  }
  throw new Error('no farm anchor touching Mountains found')
}

function findMineAnchorOnOre(): MapCoord {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const cells = buildingFootprint('mine', x, y)
      if (!cells.every((c) => isInBounds(c.x, c.y) && terrainAt(c.x, c.y) !== 'water')) continue
      if (cells.some((c) => isOreCell(c.x, c.y))) return { x, y }
    }
  }
  throw new Error('no mine anchor covering an Ore deposit found')
}

function findFarmAnchorWithPlainsNeighbor(): { anchor: MapCoord; neighbor: MapCoord } {
  for (let y = 1; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH - 1; x++) {
      const anchor = { x, y }
      const cells = buildingFootprint('farm', x, y)
      if (!cells.every((c) => isInBounds(c.x, c.y) && terrainAt(c.x, c.y) === 'plains')) continue
      const neighbor = { x: x + 1, y }
      if (terrainAt(neighbor.x, neighbor.y) !== 'plains') continue
      return { anchor, neighbor }
    }
  }
  throw new Error('no farm anchor with a plains neighbor found')
}

describe('BUILDING_SHAPES line costs', () => {
  const perimeterBuildings: BuildingType[] = ['farm', 'mine', 'school', 'garrison', 'palace']

  it.each(perimeterBuildings)('%s footprint perimeter matches its documented lineCost', (type) => {
    expect(perimeter(BUILDING_SHAPES[type])).toBe(BUILDING_DEFS[type].lineCost)
  })

  it('colony is a single free plot, not a perimeter-costed shape (lineCost 0)', () => {
    expect(BUILDING_SHAPES.colony).toHaveLength(1)
    expect(BUILDING_DEFS.colony.lineCost).toBe(0)
  })
})

describe('buildingFootprint', () => {
  it('translates each shape offset by the given anchor', () => {
    expect(buildingFootprint('farm', 5, 5)).toEqual([
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 5, y: 5 },
    ])
    expect(buildingFootprint('mine', 10, 10)).toEqual([
      { x: 10, y: 9 },
      { x: 11, y: 9 },
      { x: 10, y: 10 },
      { x: 11, y: 10 },
    ])
  })
})

describe('canPlaceBuilding', () => {
  it('rejects a footprint that runs off the map', () => {
    const s = createInitialState()
    const result = canPlaceBuilding(s, 'farm', -1, 0)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/off the map/i)
  })

  it('rejects building on water', () => {
    const s = createInitialState()
    // Rows 0-1 are open sea per computeTerrain(); anchor (0,1) keeps the whole
    // L-tromino footprint ((0,0),(1,0),(0,1)) within bounds and on water.
    expect(terrainAt(0, 0)).toBe('water')
    const result = canPlaceBuilding(s, 'farm', 0, 1)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/water/i)
  })

  it('blocks building on Mountains with no Gold, allows it once Gold is available', () => {
    const anchor = findFarmAnchorOnMountains()
    const s = createInitialState()
    s.gold = 0
    expect(canPlaceBuilding(s, 'farm', anchor.x, anchor.y).ok).toBe(false)
    s.gold = 1
    expect(canPlaceBuilding(s, 'farm', anchor.x, anchor.y).ok).toBe(true)
  })

  it('rejects placing a building on an already-occupied plot', () => {
    const anchor = findAllPlainsAnchor('farm')
    const s = createInitialState()
    s.buildings = [{ type: 'farm', staffed: true, anchor, cells: buildingFootprint('farm', anchor.x, anchor.y) }]
    const result = canPlaceBuilding(s, 'farm', anchor.x, anchor.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/already built/i)
  })

  it('rejects a building that would touch an existing one, even without overlapping', () => {
    const { anchor, neighbor } = findFarmAnchorWithPlainsNeighbor()
    const s = createInitialState()
    s.buildings = [{ type: 'farm', staffed: true, anchor, cells: buildingFootprint('farm', anchor.x, anchor.y) }]
    const result = canPlaceBuilding(s, 'colony', neighbor.x, neighbor.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/touch/i)
  })

  it('rejects a Mine with no Ore deposit anywhere in its footprint', () => {
    const anchor = findAllPlainsAnchor('mine', true)
    const s = createInitialState()
    const result = canPlaceBuilding(s, 'mine', anchor.x, anchor.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/ore/i)
  })

  it('accepts a Mine whose footprint covers an Ore deposit', () => {
    const anchor = findMineAnchorOnOre()
    const s = createInitialState()
    s.gold = 1 // covers the case where the anchor also touches Mountains
    const result = canPlaceBuilding(s, 'mine', anchor.x, anchor.y)
    expect(result.ok).toBe(true)
  })

  it('rejects a Colony on Barbarian land that has not been reclaimed, accepts it once destroyed', () => {
    const s = createInitialState()
    const site = s.barbarianCells[0]
    // Barbarian camps sit in the Mountains (rulebook p.5/8: Barbarian territory is
    // the Mountains band, not a separate free strip), so the reclaimed plot still
    // costs 1 Gold to build on, same as any other Mountains cell.
    expect(terrainAt(site.x, site.y)).toBe('mountains')
    s.gold = 1
    expect(canPlaceBuilding(s, 'colony', site.x, site.y).ok).toBe(false)
    site.destroyed = true
    expect(canPlaceBuilding(s, 'colony', site.x, site.y).ok).toBe(true)
  })

  it('a destroyed building leaves a permanently blocked ruin — same plot cannot be rebuilt on', () => {
    const ruin = findCell((x, y) => terrainAt(x, y) === 'plains')
    const s = createInitialState()
    s.destroyedBuildingCells = [ruin]
    const result = canPlaceBuilding(s, 'colony', ruin.x, ruin.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/already built/i)
  })

  it('a destroyed building also blocks anything touching its ruin', () => {
    const ruin = findCell((x, y) => terrainAt(x, y) === 'plains' && terrainAt(x + 1, y) === 'plains')
    const s = createInitialState()
    s.destroyedBuildingCells = [ruin]
    const result = canPlaceBuilding(s, 'colony', ruin.x + 1, ruin.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/touch/i)
  })

  it('an unrelated, far-away plot is unaffected by an existing ruin', () => {
    const ruin = findCell((x, y) => terrainAt(x, y) === 'plains')
    const s = createInitialState()
    s.destroyedBuildingCells = [ruin]
    const far = findCell(
      (x, y) => terrainAt(x, y) === 'plains' && (Math.abs(x - ruin.x) > 2 || Math.abs(y - ruin.y) > 2),
    )
    const result = canPlaceBuilding(s, 'colony', far.x, far.y)
    expect(result.reason).not.toMatch(/already built|touch/i)
  })
})
