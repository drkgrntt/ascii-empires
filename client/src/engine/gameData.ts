import type {
  BuildingDef,
  BuildingType,
  CultureRow,
  DisasterRow,
  ScienceBranchId,
  ScienceMilestone,
  ScienceTarget,
  TradeRow,
} from './types'
import { BARBARIAN_SITES } from './map'

// --- Buildings (Table, rulebook p.6) ---------------------------------
export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  farm: {
    id: 'farm',
    name: 'Farm',
    level: 1,
    lineCost: 8,
    minActivationDie: 2,
    scorePerBuilding: 2,
    needsStaff: true,
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    level: 1,
    lineCost: 8,
    minActivationDie: 5,
    scorePerBuilding: 2,
    needsStaff: true,
  },
  school: {
    id: 'school',
    name: 'School',
    level: 2,
    lineCost: 12,
    minActivationDie: 4,
    scorePerBuilding: 4,
    needsStaff: true,
  },
  garrison: {
    id: 'garrison',
    name: 'Garrison',
    level: 2,
    lineCost: 12,
    minActivationDie: 3,
    scorePerBuilding: 4,
    needsStaff: true,
  },
  colony: {
    id: 'colony',
    name: 'Colony',
    level: 3,
    lineCost: 0, // solo mode: earned free once all Barbarian camps are destroyed
    minActivationDie: 6,
    scorePerBuilding: 7,
    needsStaff: true,
  },
  palace: {
    id: 'palace',
    name: 'Palace',
    level: 3,
    lineCost: 24,
    minActivationDie: 0, // never activated
    scorePerBuilding: 36,
    needsStaff: false,
  },
}

export const BUILDING_ORDER: BuildingType[] = ['farm', 'mine', 'school', 'garrison', 'colony', 'palace']

// --- Population ---------------------------------------------------------
// Group sizes measured off the sheet's Population track (7 groups, not a uniform
// "every 4"): row 1 is three groups of 6, row 2 is a 5 and three 4s. Each completed
// group produces one Great Person. Sum = 35 total slots (3 preprinted Workers).
export const POPULATION_GROUPS = [6, 6, 6, 5, 4, 4, 4] // exported for UI group dividers too — see EmpireTracks.tsx
export const POPULATION_SLOTS = POPULATION_GROUPS.reduce((a, b) => a + b, 0)

// --- Gold / Military track lengths ----------------------------------------
export const GOLD_TRACK_MAX = 49 // 7x7 grid on the sheet, "!" mastery box bottom-right
export const MILITARY_BOXES = 14 // 7 cohorts of 2 boxes = 7 Armies max

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
export const SCIENCE_TRUNK_LENGTH = 4
export const SCIENCE_TRUNK_MILESTONES: ScienceMilestone[] = [
  { index: 4, label: 'Irrigation — protects from Drought', kind: 'irrigation' },
]

export interface ScienceBranchDef {
  id: ScienceBranchId
  label: string
  length: number
  requires: ScienceTarget // must be fully marked before this branch unlocks
  milestones: ScienceMilestone[]
}

export const SCIENCE_BRANCHES: Record<ScienceBranchId, ScienceBranchDef> = {
  philosophy: {
    id: 'philosophy',
    label: 'Philosophy (upper branch)',
    length: 16,
    requires: 'trunk',
    milestones: [
      { index: 1, label: 'Philosophy — unlocks the Green die', kind: 'philosophy' },
      { index: 2, label: 'Culture bonus', kind: 'culture-bonus' },
      { index: 5, label: 'Culture bonus', kind: 'culture-bonus' },
      { index: 8, label: 'Culture bonus', kind: 'culture-bonus' },
      { index: 11, label: 'Culture bonus', kind: 'culture-bonus' },
      { index: 13, label: 'Culture bonus', kind: 'culture-bonus' },
      { index: 15, label: 'Culture bonus', kind: 'culture-bonus' },
      { index: 16, label: 'Mastery', kind: 'mastery' },
    ],
  },
  engineeringApproach: {
    id: 'engineeringApproach',
    label: 'Engineering approach (middle/lower branch)',
    length: 10,
    requires: 'trunk',
    milestones: [
      { index: 2, label: 'Sailing — Reach to all players', kind: 'sailing' },
      { index: 4, label: 'Gold bonus', kind: 'gold-bonus' },
      { index: 7, label: 'Gold bonus', kind: 'gold-bonus' },
      { index: 10, label: 'Gold bonus', kind: 'gold-bonus' },
    ],
  },
  engineeringBranch: {
    id: 'engineeringBranch',
    label: 'Engineering (middle branch)',
    length: 7,
    requires: 'engineeringApproach',
    milestones: [
      { index: 1, label: 'Engineering — unlocks the Black die', kind: 'engineering' },
      { index: 3, label: 'Gold bonus', kind: 'gold-bonus' },
      { index: 6, label: 'Gold bonus', kind: 'gold-bonus' },
      { index: 7, label: 'Mastery', kind: 'mastery' },
    ],
  },
  wallsIron: {
    id: 'wallsIron',
    label: 'Walls & Iron (lower branch)',
    length: 11,
    requires: 'engineeringApproach',
    milestones: [
      { index: 1, label: 'Gold bonus', kind: 'gold-bonus' },
      { index: 2, label: 'Walls — +1 Power defending, immune to Raid', kind: 'walls' },
      { index: 7, label: 'Iron — +1 Power attacking', kind: 'iron' },
      { index: 11, label: 'Mastery', kind: 'mastery' },
    ],
  },
}

export const SCIENCE_BRANCH_ORDER: ScienceBranchId[] = ['philosophy', 'engineeringApproach', 'engineeringBranch', 'wallsIron']

// --- Happiness / Unhappiness track (values shown at each marked box) --
export const HAPPINESS_TRACK = [0, 4, 8, 12, 16, 20, 24, 30, 42, 60, 80]
export const UNHAPPINESS_TRACK = [0, 2, 4, 8, 12, 16, 20, 24, 30, 40, 50]

// --- Trade caravans (rulebook p.9, sheet TRADE section) ---------------
// Each caravan's reward to its owner, read directly off the sheet: 1 Happiness + 3
// Gold always, plus Science (rows 1-2) or Culture (rows 3-5) marks. The sheet also
// lists a smaller reward for other players "with Reach" — moot in solo play, since
// there are no other players to have Reach to you.
export interface TradeReward {
  happiness: number
  gold: number
  science: number
  culture: number
}

export const TRADE_REWARDS: TradeReward[] = [
  { happiness: 1, gold: 3, science: 1, culture: 0 }, // 5+ 6+           :) OOO S
  { happiness: 1, gold: 3, science: 2, culture: 0 }, // 4+ 5+ 6+        :) OOO SS
  { happiness: 1, gold: 3, science: 0, culture: 1 }, // 3+ 4+ 5+ 6+     :) OOO C
  { happiness: 1, gold: 3, science: 0, culture: 2 }, // 2+ 3+ 4+ 5+ 6+  :) OOO CC
  { happiness: 1, gold: 3, science: 0, culture: 2 }, // 2+ 3+ 4+ 5+ 6+  :) OOO CC
]

export function tradeRewardText(r: TradeReward): string {
  const parts: string[] = [`+${r.happiness} Happiness`, `+${r.gold} Gold`]
  if (r.science) parts.push(`+${r.science} Science`)
  if (r.culture) parts.push(`+${r.culture} Culture`)
  return parts.join(', ')
}

export function makeTradeRows(): TradeRow[] {
  const thresholds: number[][] = [
    [5, 6],
    [4, 5, 6],
    [3, 4, 5, 6],
    [2, 3, 4, 5, 6],
    [2, 3, 4, 5, 6],
  ]
  return thresholds.map((row) => ({
    cells: row.map((t) => ({ threshold: t, filled: false })),
    completed: false,
  }))
}

// --- Culture grid (sheet CULTURE section, rows read left to right) ----
export function makeCultureRows(): CultureRow[] {
  const rows: { thresholds: number[]; score: number }[] = [
    { thresholds: [5, 5, 4, 6], score: 15 },
    { thresholds: [2, 3, 4, 5, 5, 6], score: 20 },
    { thresholds: [3, 3, 5, 2, 4, 6, 5], score: 30 },
    { thresholds: [4, 5, 4, 5, 6, 5, 6], score: 35 },
  ]
  return rows.map((r) => ({
    cells: r.thresholds.map((t) => ({ threshold: t, filled: false })),
    score: r.score,
    completed: false,
  }))
}

// One-time bonus for filling every cell in a given column across all rows that
// have a cell at that index (rows are 4/6/7/7 cells long and right-aligned, so
// the rightmost columns span all four rows and the leftmost only the two longest
// ones — see Culture.tsx). Read directly off the sheet's two symbol rows under
// the grid (/ Worker, O Gold, S Science, :) Happiness), one grant per row, per
// column — not a flat point bonus.
export const CULTURE_COLUMN_COUNT = 7

export interface CultureColumnReward {
  worker: number
  gold: number
  science: number
  happiness: number
}

export const CULTURE_COLUMN_REWARDS: CultureColumnReward[] = [
  { worker: 1, gold: 1, science: 0, happiness: 0 }, // column 1: / O
  { worker: 0, gold: 2, science: 0, happiness: 0 }, // column 2: O O
  { worker: 1, gold: 0, science: 1, happiness: 0 }, // column 3: / S
  { worker: 0, gold: 1, science: 1, happiness: 0 }, // column 4: O S
  { worker: 0, gold: 0, science: 1, happiness: 1 }, // column 5: S :)
  { worker: 0, gold: 0, science: 0, happiness: 2 }, // column 6: :) :)
  { worker: 0, gold: 0, science: 0, happiness: 2 }, // column 7: :) :)
]

export function cultureRewardText(r: CultureColumnReward): string {
  const parts: string[] = []
  if (r.worker) parts.push(`+${r.worker} Worker${r.worker > 1 ? 's' : ''}`)
  if (r.gold) parts.push(`+${r.gold} Gold`)
  if (r.science) parts.push(`+${r.science} Science`)
  if (r.happiness) parts.push(`+${r.happiness} Happiness`)
  return parts.join(', ')
}

export function cultureRewardGlyphs(r: CultureColumnReward): string[] {
  const glyphs: string[] = []
  for (let i = 0; i < r.worker; i++) glyphs.push('/')
  for (let i = 0; i < r.gold; i++) glyphs.push('O')
  for (let i = 0; i < r.science; i++) glyphs.push('S')
  for (let i = 0; i < r.happiness; i++) glyphs.push(':)')
  return glyphs
}

// --- Disaster grid (sheet, rows 1-6) -----------------------------------
// Row "1" is marked whenever a die shows 1, before it gets rerolled.
// Rows 2-6 are marked once per final die value after the reroll-1s loop.
export function makeDisasterRows(): DisasterRow[] {
  const config: { dieValue: number; name: string | null; hasCultureBonus: boolean }[] = [
    { dieValue: 1, name: 'Drought', hasCultureBonus: false },
    { dieValue: 2, name: null, hasCultureBonus: false },
    { dieValue: 3, name: 'Barbarian Raid', hasCultureBonus: true },
    { dieValue: 4, name: null, hasCultureBonus: true },
    { dieValue: 5, name: 'Revolt', hasCultureBonus: true },
    { dieValue: 6, name: null, hasCultureBonus: true },
  ]
  return config.map((c) => ({
    dieValue: c.dieValue,
    name: c.name,
    hasCultureBonus: c.hasCultureBonus,
    boxes: [false, false, false],
    triggered: false,
  }))
}

export const BARBARIAN_CAMPS_TOTAL = BARBARIAN_SITES.length // one per map site, see engine/map.ts

export const REROLL_COST_SOLO = 1 // "collectively spend Gold equal to no. of players" — 1 in solo
