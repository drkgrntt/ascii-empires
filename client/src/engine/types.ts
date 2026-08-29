// Core domain types for the ASCII Empires solo prototype.
// See /README.md for which rules are exact vs. simplified.

export type DieColor = 'white' | 'green' | 'black'

export interface Die {
  id: string
  color: DieColor
  value: number // 1-6
  usedFor: DieUse | null
}

export type DieUse =
  | { kind: 'construction' }
  | { kind: 'activate'; building: BuildingType; boostTarget?: BuildingType; scienceTarget?: ScienceTarget }
  | { kind: 'trade'; row: number }
  | { kind: 'culture'; row: number; col: number }

export type BuildingType = 'farm' | 'mine' | 'school' | 'garrison' | 'colony' | 'palace'

export interface BuildingDef {
  id: BuildingType
  name: string
  level: 1 | 2 | 3
  lineCost: number // lines needed to complete (0 for the solo-bonus Colony)
  minActivationDie: number // lowest die face that can activate it (0 = never directly)
  scorePerBuilding: number
  needsStaff: boolean
}

// --- Map (rulebook p.4-5: buildings are drawn as squares on a dot-grid) ---
export type Terrain = 'water' | 'plains' | 'mountains'

export interface MapCoord {
  x: number
  y: number
}

export interface BarbarianSite extends MapCoord {
  destroyed: boolean
}

export interface BuildingInstance {
  type: BuildingType
  staffed: boolean
  anchor: MapCoord // the labelled cell the player clicked to place it (see engine/map.ts BUILDING_SHAPES)
  cells: MapCoord[] // every plot the building's fixed-shape outline covers
}

export type Phase =
  | 'dice'
  | 'diplomacy'
  | 'disasters'
  | 'development'
  | 'deployment'
  | 'gameover'

export interface PopulationSlot {
  state: 'empty' | 'worker' | BuildingType // BuildingType when staffing that building type
}

// --- Science (rulebook p.7: a shared trunk forking into 3 branches) ---
// Trunk (4 boxes, Irrigation) forks — once complete — into the "Philosophy" branch
// (upper, humanities) and an "Engineering approach" branch (Sailing, then itself
// forks into the "Engineering" branch and the "Walls & Iron" branch: middle/lower,
// natural sciences). Each of the 3 terminal branches ends in its own Mastery box.
export type ScienceBranchId = 'philosophy' | 'engineeringApproach' | 'engineeringBranch' | 'wallsIron'
export type ScienceTarget = 'trunk' | ScienceBranchId

export interface ScienceMilestone {
  index: number // 1-indexed position within its branch (or the trunk)
  label: string
  kind:
    | 'irrigation'
    | 'philosophy'
    | 'sailing'
    | 'engineering'
    | 'walls'
    | 'iron'
    | 'culture-bonus'
    | 'gold-bonus'
    | 'mastery'
}

export interface CultureCell {
  threshold: number
  filled: boolean
}

export interface CultureRow {
  cells: CultureCell[]
  score: number
  completed: boolean
}

export interface TradeRow {
  cells: CultureCell[]
  completed: boolean
}

export interface DisasterRow {
  dieValue: number // 2-6 correspond to matched die faces; 1 is the special "any die showing 1" row
  name: string | null
  hasCultureBonus: boolean
  boxes: boolean[] // length 3; 3rd box filling triggers the disaster
  triggered: boolean
}

export interface LogEntry {
  round: number
  text: string
}

export interface GameState {
  round: number
  maxRounds: number
  phase: Phase
  dice: Die[]
  diceUnlocked: { white: boolean; green: boolean; black: boolean }
  rerollsThisRound: number

  population: PopulationSlot[]
  greatPersonTokens: number

  gold: number
  goldTrackMax: number

  militaryBoxes: boolean[] // filled boxes; every 2 = one army
  deployedThisRound: number // armies committed so far this Deployment phase
  bankedAttackPower: number // Power banked from armies deployed to attack, spendable across
  bankedDefensePower: number // multiple 1pt actions this round (Iron/Walls double it per army)

  scienceTrunkMarked: number
  scienceBranchMarked: Record<ScienceBranchId, number>

  buildings: BuildingInstance[]
  destroyedBuildingCells: MapCoord[] // ruins of Revolt-destroyed buildings — permanently blocked (rulebook p.5, p.10)
  constructionPoints: number // accumulated this round from dice/great-person, spent this round only

  tradeRows: TradeRow[]
  cultureRows: CultureRow[]
  cultureColumns: boolean[] // one-time bonus per column index, once every row that has that column is filled

  barbarianCamps: number
  barbarianCampsTotal: number
  barbarianCells: BarbarianSite[] // fixed map sites; `destroyed` flips as camps are attacked
  colonyAvailable: boolean // becomes true once all camps destroyed; lets the free Colony be built

  happiness: number
  happinessMax: number
  unhappiness: number
  unhappinessMax: number

  disasterRows: DisasterRow[]
  pendingDrought: boolean // player still owes a choice: -2 Workers or +1 Unhappiness (rulebook p.10)
  pendingRaidDefense: boolean
  pendingRevolt: boolean
  pendingRevoltSacrifice: boolean // round's over, Revolt went unanswered — waiting on which building to sacrifice

  masteries: Set<string>

  log: LogEntry[]
  gameOverScore: ScoreBreakdown | null
}

export interface ScoreBreakdown {
  farms: number
  mines: number
  schools: number
  garrisons: number
  colonies: number
  palace: number
  gold: number
  armies: number
  mastery: number
  culture: number
  happinessNet: number
  total: number
}
