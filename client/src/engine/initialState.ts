import type { GameState, PopulationSlot, ScienceBranchId } from './types'
import {
  BARBARIAN_CAMPS_TOTAL,
  CULTURE_COLUMN_COUNT,
  GOLD_TRACK_MAX,
  HAPPINESS_TRACK,
  MILITARY_BOXES,
  POPULATION_SLOTS,
  SCIENCE_BRANCH_ORDER,
  UNHAPPINESS_TRACK,
  makeCultureRows,
  makeDisasterRows,
  makeTradeRows,
} from './gameData'
import { BARBARIAN_SITES } from './map'

let idCounter = 0
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

export function createInitialState(): GameState {
  const population: PopulationSlot[] = Array.from({ length: POPULATION_SLOTS }, (_, i) => ({
    state: i < 3 ? 'worker' : 'empty', // start with 3 Workers, per rulebook
  }))

  return {
    round: 1,
    maxRounds: 20,
    phase: 'dice',
    dice: [],
    diceUnlocked: { white: true, green: false, black: false },
    rerollsThisRound: 0,

    population,
    greatPersonTokens: 0,

    gold: 0,
    goldTrackMax: GOLD_TRACK_MAX,

    militaryBoxes: Array.from({ length: MILITARY_BOXES }, () => false),
    deployedThisRound: 0,
    bankedAttackPower: 0,
    bankedDefensePower: 0,

    scienceTrunkMarked: 0,
    scienceBranchMarked: Object.fromEntries(SCIENCE_BRANCH_ORDER.map((id) => [id, 0])) as Record<
      ScienceBranchId,
      number
    >,

    buildings: [],
    destroyedBuildingCells: [],
    constructionPoints: 0,

    tradeRows: makeTradeRows(),
    cultureRows: makeCultureRows(),
    cultureColumns: Array.from({ length: CULTURE_COLUMN_COUNT }, () => false),

    barbarianCamps: BARBARIAN_CAMPS_TOTAL,
    barbarianCampsTotal: BARBARIAN_CAMPS_TOTAL,
    barbarianCells: BARBARIAN_SITES.map((c) => ({ ...c, destroyed: false })),
    colonyAvailable: false,

    happiness: 0,
    happinessMax: HAPPINESS_TRACK.length - 1,
    unhappiness: 0,
    unhappinessMax: UNHAPPINESS_TRACK.length - 1,

    disasterRows: makeDisasterRows(),
    pendingDrought: false,
    pendingRaidDefense: false,
    pendingRevolt: false,
    pendingRevoltSacrifice: false,

    masteries: new Set<string>(),

    log: [{ round: 1, text: 'Your Empire begins. Three Workers stand ready.' }],
    gameOverScore: null,
  }
}

// Manual clone: state has nested arrays of objects plus a Set, so JSON round-tripping
// would drop the Set. Cloning field-by-field keeps things explicit and cheap.
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    dice: s.dice.map((d) => ({ ...d })),
    diceUnlocked: { ...s.diceUnlocked },
    population: s.population.map((p) => ({ ...p })),
    militaryBoxes: [...s.militaryBoxes],
    scienceBranchMarked: { ...s.scienceBranchMarked },
    buildings: s.buildings.map((b) => ({ ...b, anchor: { ...b.anchor }, cells: b.cells.map((c) => ({ ...c })) })),
    destroyedBuildingCells: s.destroyedBuildingCells.map((c) => ({ ...c })),
    tradeRows: s.tradeRows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c })) })),
    cultureRows: s.cultureRows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c })) })),
    cultureColumns: [...s.cultureColumns],
    disasterRows: s.disasterRows.map((r) => ({ ...r, boxes: [...r.boxes] })),
    barbarianCells: s.barbarianCells.map((c) => ({ ...c })),
    masteries: new Set(s.masteries),
    log: [...s.log],
  }
}
