import type {
  BuildingType,
  Die,
  DieUse,
  GameState,
  MapCoord,
  ScienceBranchId,
  ScienceTarget,
  ScoreBreakdown,
} from './types'
import {
  BUILDING_DEFS,
  CULTURE_COLUMN_COUNT,
  CULTURE_COLUMN_REWARDS,
  HAPPINESS_TRACK,
  POPULATION_GROUPS,
  REROLL_COST_SOLO,
  SCIENCE_BRANCHES,
  SCIENCE_BRANCH_ORDER,
  SCIENCE_TRUNK_LENGTH,
  SCIENCE_TRUNK_MILESTONES,
  TRADE_REWARDS,
  UNHAPPINESS_TRACK,
  cultureRewardText,
  tradeRewardText,
} from './gameData'
import { cloneState, nextId } from './initialState'
import { buildingFootprint, canPlaceBuilding, terrainAt } from './map'

export type Action =
  | { type: 'ROLL_DICE' }
  | { type: 'REROLL_DICE'; ids: string[] }
  | { type: 'CONFIRM_DIPLOMACY' }
  | { type: 'ASSIGN_DIE'; id: string; use: DieUse }
  | { type: 'UNASSIGN_DIE'; id: string }
  | { type: 'MODIFY_DIE'; id: string; delta: 1 | -1 }
  | { type: 'RESOLVE_DROUGHT'; choice: 'workers' | 'unhappiness' }
  | { type: 'COMPLETE_BUILDING'; building: BuildingType; cell: MapCoord }
  | {
      type: 'USE_GREAT_PERSON'
      choice: 'lines' | 'science' | 'culture'
      cultureTarget?: { row: number; col: number }
      scienceTarget?: ScienceTarget
    }
  | { type: 'TAXATION' }
  | { type: 'CONSCRIPTION' }
  | { type: 'BUILD_FREE_COLONY'; cell: MapCoord }
  | { type: 'END_DEVELOPMENT' }
  | { type: 'DEPLOY_BARBARIAN' }
  | { type: 'DEPLOY_DEFEND_RAID' }
  | { type: 'DEPLOY_DEFEND_REVOLT' }
  | { type: 'RESOLVE_REVOLT_SACRIFICE'; index: number | null }
  | { type: 'END_ROUND' }

function log(s: GameState, text: string) {
  s.log.push({ round: s.round, text })
}

function rollDie(color: Die['color']): number {
  return Math.ceil(Math.random() * 6) as number
}

function rollFreshDice(s: GameState) {
  const colors: Die['color'][] = ['white', 'white', 'white', 'green', 'black']
  s.dice = colors.map((color) => ({
    id: nextId('die'),
    color,
    value: rollDie(color),
    usedFor: null,
  }))
}

function availableDice(s: GameState): Die[] {
  return s.dice.filter((d) => {
    if (d.color === 'green' && !s.diceUnlocked.green) return false
    if (d.color === 'black' && !s.diceUnlocked.black) return false
    return true
  })
}

function addHappiness(s: GameState, n: number) {
  s.happiness = Math.min(s.happiness + n, s.happinessMax)
}
function addUnhappiness(s: GameState, n: number) {
  s.unhappiness = Math.min(s.unhappiness + n, s.unhappinessMax)
  if (s.unhappiness > s.happiness) s.pendingRevolt = true
}

function addGold(s: GameState, n: number) {
  s.gold = Math.min(s.gold + n, s.goldTrackMax)
  if (s.gold >= s.goldTrackMax) s.masteries.add('gold')
}
function spendGold(s: GameState, n: number): boolean {
  if (s.gold < n) return false
  s.gold -= n
  return true
}

function addWorker(s: GameState) {
  const slot = s.population.find((p) => p.state === 'empty')
  if (slot) slot.state = 'worker'
  checkPopulationGroups(s)
}

function checkPopulationGroups(s: GameState) {
  let offset = 0
  let earned = 0
  for (const size of POPULATION_GROUPS) {
    const slice = s.population.slice(offset, offset + size)
    if (slice.every((p) => p.state !== 'empty')) earned++
    offset += size
  }
  const alreadyGranted = (s as any)._greatPersonGranted ?? 0
  if (earned > alreadyGranted) {
    const diff = earned - alreadyGranted
    s.greatPersonTokens += diff
    ;(s as any)._greatPersonGranted = earned
    log(s, `A Great Person emerges! (+${diff})`)
  }
  if (s.population.every((p) => p.state !== 'empty')) s.masteries.add('population')
}

// A branch unlocks once whatever it `requires` (the trunk, or another branch) is
// fully marked — see SCIENCE_BRANCHES / the trunk-then-fork tree in gameData.ts.
function isScienceTargetComplete(s: GameState, target: ScienceTarget): boolean {
  if (target === 'trunk') return s.scienceTrunkMarked >= SCIENCE_TRUNK_LENGTH
  return s.scienceBranchMarked[target] >= SCIENCE_BRANCHES[target].length
}

function isBranchUnlocked(s: GameState, id: ScienceBranchId): boolean {
  return isScienceTargetComplete(s, SCIENCE_BRANCHES[id].requires)
}

// The trunk first, then whichever unlocked branch isn't finished yet — used as the
// science target for grants with no natural "pick a branch" moment (Trade/Culture
// rewards). School activation and the Great Person's Science choice let the player
// pick explicitly instead (see Buildings.tsx).
function firstAvailableScienceTarget(s: GameState): ScienceTarget {
  if (!isScienceTargetComplete(s, 'trunk')) return 'trunk'
  for (const id of SCIENCE_BRANCH_ORDER) {
    if (isBranchUnlocked(s, id) && s.scienceBranchMarked[id] < SCIENCE_BRANCHES[id].length) return id
  }
  return 'trunk'
}

function markScience(s: GameState, n: number, target?: ScienceTarget) {
  for (let i = 0; i < n; i++) {
    let t = target ?? firstAvailableScienceTarget(s)
    if (t !== 'trunk' && !isBranchUnlocked(s, t)) t = firstAvailableScienceTarget(s)
    if (isScienceTargetComplete(s, t)) {
      // Requested target is full (or everything is) — fall back rather than lose the mark.
      t = firstAvailableScienceTarget(s)
      if (isScienceTargetComplete(s, t)) break // every unlocked track is full
    }
    const milestones = t === 'trunk' ? SCIENCE_TRUNK_MILESTONES : SCIENCE_BRANCHES[t].milestones
    const marked = t === 'trunk' ? ++s.scienceTrunkMarked : ++s.scienceBranchMarked[t]
    const milestone = milestones.find((m) => m.index === marked)
    if (milestone) {
      log(s, `Science: ${milestone.label}`)
      if (milestone.kind === 'philosophy') s.diceUnlocked.green = true
      if (milestone.kind === 'engineering') s.diceUnlocked.black = true
      if (milestone.kind === 'gold-bonus') addGold(s, 1)
      if (milestone.kind === 'mastery') s.masteries.add(`science-${t}`)
      if (milestone.kind === 'culture-bonus') {
        // Granted as a banked token the player can spend on any Culture cell
        // (converted to a Great Person token at END_ROUND, see below).
        ;(s as any)._pendingCultureBonus = ((s as any)._pendingCultureBonus ?? 0) + 1
      }
    }
  }
}

function hasMilestone(s: GameState, kind: string): boolean {
  if (SCIENCE_TRUNK_MILESTONES.some((m) => m.kind === kind && s.scienceTrunkMarked >= m.index)) return true
  return SCIENCE_BRANCH_ORDER.some((id) =>
    SCIENCE_BRANCHES[id].milestones.some((m) => m.kind === kind && s.scienceBranchMarked[id] >= m.index),
  )
}

function staffedCountByType(s: GameState, type: BuildingType): number {
  return s.buildings.filter((b) => b.type === type && b.staffed).length
}

function canBuild(s: GameState, type: BuildingType): boolean {
  const def = BUILDING_DEFS[type]
  if (def.level === 2) {
    return staffedCountByType(s, 'farm') > 0 && staffedCountByType(s, 'mine') > 0
  }
  if (def.level === 3) {
    return staffedCountByType(s, 'school') > 0 && staffedCountByType(s, 'garrison') > 0
  }
  return true
}

function completeBuilding(s: GameState, type: BuildingType, anchor: MapCoord) {
  const def = BUILDING_DEFS[type]
  const cells = buildingFootprint(type, anchor.x, anchor.y)
  // "Ø to build" on Mountains (Symbols table, p.11): 1 Gold if any part of the
  // building touches Mountainous terrain. canPlaceBuilding already confirmed it's
  // affordable — spendGold here just books the cost.
  if (cells.some((c) => terrainAt(c.x, c.y) === 'mountains')) {
    spendGold(s, 1)
    log(s, `Spent 1 Gold to build on Mountainous terrain.`)
  }
  const instance = { type, staffed: false, anchor, cells }
  if (def.needsStaff) {
    const worker = s.population.find((p) => p.state === 'worker')
    if (worker) {
      worker.state = type
      instance.staffed = true
    }
  } else {
    instance.staffed = true // Palace needs no staff
  }
  s.buildings.push(instance)
  log(s, `${def.name} constructed${instance.staffed ? ' and staffed' : ' (unstaffed — no Worker available)'}.`)
  if (
    s.buildings.some((b) => b.type === 'colony' && b.staffed) &&
    s.buildings.some((b) => b.type === 'palace')
  ) {
    s.masteries.add('buildings')
  }
}

// Rows are right-aligned to the CULTURE_COLUMN_COUNT-wide grid (sheet layout — see
// Culture.tsx), so a row of length L only reaches grid columns
// [CULTURE_COLUMN_COUNT - L, CULTURE_COLUMN_COUNT - 1]. `col` here is that grid
// column (0-indexed from the left), not a row-local cell index.
function rowGridOffset(cellCount: number): number {
  return CULTURE_COLUMN_COUNT - cellCount
}

function checkCultureColumn(s: GameState, col: number) {
  if (s.cultureColumns[col]) return // already claimed
  const rowsWithCol = s.cultureRows.filter((r) => rowGridOffset(r.cells.length) <= col)
  if (rowsWithCol.length === 0) return
  if (!rowsWithCol.every((r) => r.cells[col - rowGridOffset(r.cells.length)].filled)) return
  s.cultureColumns[col] = true
  const reward = CULTURE_COLUMN_REWARDS[col]
  if (reward) {
    for (let i = 0; i < reward.worker; i++) addWorker(s)
    if (reward.gold) addGold(s, reward.gold)
    if (reward.science) markScience(s, reward.science)
    if (reward.happiness) addHappiness(s, reward.happiness)
    log(s, `Culture column ${col + 1} completed! ${cultureRewardText(reward)}.`)
  }
}

function checkMasteryTracks(s: GameState) {
  if (s.militaryBoxes.every((b) => b)) s.masteries.add('military')
  if (s.tradeRows.every((r) => r.completed)) s.masteries.add('trade')
  if (s.cultureRows.every((r) => r.completed)) s.masteries.add('culture')
}

function markDisasterRow(s: GameState, dieValue: number) {
  const row = s.disasterRows.find((r) => r.dieValue === dieValue)
  if (!row || row.triggered) return
  const idx = row.boxes.findIndex((b) => !b)
  if (idx === -1) return
  row.boxes[idx] = true
  if (idx === 2) {
    row.triggered = true
    triggerDisaster(s, row.dieValue)
  }
}

function triggerDisaster(s: GameState, dieValue: number) {
  const row = s.disasterRows.find((r) => r.dieValue === dieValue)!
  if (row.hasCultureBonus) {
    ;(s as any)._pendingCultureBonus = ((s as any)._pendingCultureBonus ?? 0) + 1
  }
  if (dieValue === 1) {
    log(s, 'Disaster: Drought strikes!')
    if (!hasMilestone(s, 'irrigation')) {
      // "Cross off two Workers OR gain one Unhappiness" — the player's choice, not
      // forced by whether they happen to have 2 Workers (rulebook p.10). Deferred
      // like Raid/Revolt; RESOLVE_DROUGHT settles it, with a fallback at END_ROUND.
      s.pendingDrought = true
      log(s, 'Choose: cross off 2 Workers, or gain 1 Unhappiness.')
    } else {
      log(s, 'Irrigation protects you from the Drought.')
    }
  } else if (dieValue === 3) {
    log(s, 'Disaster: Barbarians raid!')
    if (hasMilestone(s, 'walls')) {
      log(s, 'Your Walls repel the Raid.')
    } else {
      s.pendingRaidDefense = true
      log(s, 'Deploy an Army in the Deployment phase to repel it, or suffer losses.')
    }
  } else if (dieValue === 5) {
    log(s, 'Disaster: unrest boils toward Revolt!')
    if (s.unhappiness > s.happiness) {
      s.pendingRevolt = true
      log(s, 'Deploy an Army in Deployment to prevent a building from being destroyed.')
    } else {
      log(s, 'Your people remain content — no Revolt.')
    }
  }
}

function resolveDisastersPhase(s: GameState) {
  // Rulebook p.10 / Diplomacy's own hint ("those with a value of 1... about to trigger
  // Disasters in the following phase") — it's specifically 1s that interact with the
  // Disaster grid. A die that never shows 1 sits this phase out entirely. Each occurrence
  // of a 1 marks row 1 (Drought's row — the only way it's ever reachable, since a die can
  // never end this process still showing 1) and is rerolled to get a usable value for
  // Development; if THAT die started as a 1, its final rerolled value also marks its own
  // row. Dice that were never 1 don't mark anything, this round.
  let guard = 0
  const rerolled = new Set<string>()
  while (s.dice.some((d) => d.value === 1) && guard < 20) {
    guard++
    for (const d of s.dice) {
      if (d.value === 1) {
        rerolled.add(d.id)
        markDisasterRow(s, 1)
        d.value = rollDie(d.color)
      }
    }
  }
  for (const d of s.dice) {
    if (rerolled.has(d.id)) markDisasterRow(s, d.value)
  }
}

function unusedLines(s: GameState): number {
  return s.constructionPoints
}

// Deploying an Army grants 1 point of Power, or 2 if you've researched the matching
// upgrade (Iron for attacking, Walls for defending) — rulebook p.8. Power from an
// army is banked and can cover multiple 1pt actions of that kind in the same
// Deployment phase (it just doesn't carry over to the next round).
function armiesAvailable(s: GameState): number {
  return Math.floor(s.militaryBoxes.filter(Boolean).length / 2) - s.deployedThisRound
}

function ensureAttackPower(s: GameState): boolean {
  if (s.bankedAttackPower > 0) return true
  if (armiesAvailable(s) <= 0) return false
  s.deployedThisRound += 1
  s.bankedAttackPower += hasMilestone(s, 'iron') ? 2 : 1
  return true
}

function ensureDefensePower(s: GameState): boolean {
  if (s.bankedDefensePower > 0) return true
  if (armiesAvailable(s) <= 0) return false
  s.deployedThisRound += 1
  s.bankedDefensePower += hasMilestone(s, 'walls') ? 2 : 1
  return true
}

export function gameReducer(state: GameState, action: Action): GameState {
  const s = cloneState(state)

  switch (action.type) {
    case 'ROLL_DICE': {
      if (s.phase !== 'dice') return s
      rollFreshDice(s)
      s.rerollsThisRound = 0
      s.phase = 'diplomacy'
      log(s, `Round ${s.round}: rolled ${s.dice.map((d) => d.value).join(', ')}.`)
      return s
    }

    case 'REROLL_DICE': {
      if (s.phase !== 'diplomacy') return s
      if (action.ids.length === 0) return s
      if (!spendGold(s, REROLL_COST_SOLO)) {
        log(s, 'Not enough Gold to reroll.')
        return s
      }
      for (const d of s.dice) {
        if (action.ids.includes(d.id)) d.value = rollDie(d.color)
      }
      s.rerollsThisRound += 1
      log(s, `Rerolled ${action.ids.length} die/dice for ${REROLL_COST_SOLO} Gold.`)
      return s
    }

    case 'CONFIRM_DIPLOMACY': {
      if (s.phase !== 'diplomacy') return s
      s.phase = 'disasters'
      resolveDisastersPhase(s)
      s.phase = 'development'
      return s
    }

    case 'ASSIGN_DIE': {
      if (s.phase !== 'development') return s
      const die = s.dice.find((d) => d.id === action.id)
      if (!die || die.usedFor) return s
      if (!availableDice(s).some((d) => d.id === die.id)) return s

      const use = action.use
      if (use.kind === 'construction') {
        die.usedFor = use
        s.constructionPoints += die.value
      } else if (use.kind === 'activate') {
        const def = BUILDING_DEFS[use.building]
        if (die.value < def.minActivationDie || def.minActivationDie === 0) return s
        const count = staffedCountByType(s, use.building)
        if (count === 0) return s
        if (use.building === 'colony') {
          if (!use.boostTarget) return s
          die.usedFor = use
          activateColonyBoost(s, use.boostTarget, use.scienceTarget)
        } else {
          die.usedFor = use
          activateBuilding(s, use.building, count, use.scienceTarget)
        }
      } else if (use.kind === 'trade') {
        const row = s.tradeRows[use.row]
        if (!row || row.completed) return s
        const cell = row.cells.find((c) => !c.filled)
        if (!cell || die.value < cell.threshold) return s
        cell.filled = true
        die.usedFor = use
        if (row.cells.every((c) => c.filled)) {
          row.completed = true
          const reward = TRADE_REWARDS[use.row]
          addHappiness(s, reward.happiness)
          addGold(s, reward.gold)
          if (reward.science) markScience(s, reward.science)
          if (reward.culture) {
            // Banked like a disaster/science culture bonus: the player picks which
            // Culture cell(s) to mark via a Great Person-style token (see END_ROUND).
            ;(s as any)._pendingCultureBonus = ((s as any)._pendingCultureBonus ?? 0) + reward.culture
          }
          log(s, `Caravan ${use.row + 1} reaches its destination! ${tradeRewardText(reward)}.`)
          checkMasteryTracks(s)
        }
      } else if (use.kind === 'culture') {
        const row = s.cultureRows[use.row]
        const cell = row?.cells[use.col]
        if (!row || !cell || cell.filled) return s
        if (die.value < cell.threshold) return s
        cell.filled = true
        die.usedFor = use
        if (row.cells.every((c) => c.filled)) {
          row.completed = true
          log(s, `Culture row ${use.row + 1} completed (+${row.score} pts at game end).`)
          checkMasteryTracks(s)
        }
        checkCultureColumn(s, use.col + rowGridOffset(row.cells.length))
      }
      return s
    }

    case 'MODIFY_DIE': {
      // 1 Gold shifts a die's value by 1 (either direction, spendable repeatedly);
      // it can climb past 6 but never drops below 2. Rulebook p.7.
      if (s.phase !== 'development') return s
      const die = s.dice.find((d) => d.id === action.id)
      if (!die || die.usedFor) return s
      if (!availableDice(s).some((d) => d.id === die.id)) return s
      const next = die.value + action.delta
      if (next < 2) return s
      if (!spendGold(s, 1)) {
        log(s, 'Not enough Gold to modify die.')
        return s
      }
      die.value = next
      log(s, `Spent 1 Gold: ${die.color} die now shows ${next}.`)
      return s
    }

    case 'UNASSIGN_DIE': {
      if (s.phase !== 'development') return s
      const die = s.dice.find((d) => d.id === action.id)
      if (!die || !die.usedFor) return s
      if (die.usedFor.kind === 'construction') {
        s.constructionPoints = Math.max(0, s.constructionPoints - die.value)
      } else if (die.usedFor.kind === 'trade') {
        const row = s.tradeRows[die.usedFor.row]
        const cell = [...row.cells].reverse().find((c) => c.filled)
        if (cell) cell.filled = false
        row.completed = false
      } else if (die.usedFor.kind === 'culture') {
        const row = s.cultureRows[die.usedFor.row]
        const cell = row.cells[die.usedFor.col]
        if (cell) cell.filled = false
        row.completed = false
      }
      // Activation effects are not reversible (resources already granted); undo is
      // intentionally limited to construction/trade/culture assignments.
      die.usedFor = null
      return s
    }

    case 'COMPLETE_BUILDING': {
      if (s.phase !== 'development') return s
      const def = BUILDING_DEFS[action.building]
      if (def.lineCost === 0) return s // Colony is granted via BUILD_FREE_COLONY
      if (!canBuild(s, action.building)) {
        log(s, `Prerequisites not met for ${def.name}.`)
        return s
      }
      if (unusedLines(s) < def.lineCost) {
        log(s, `Not enough construction lines for ${def.name}.`)
        return s
      }
      const placement = canPlaceBuilding(s, action.building, action.cell.x, action.cell.y)
      if (!placement.ok) {
        log(s, placement.reason ?? `Cannot build ${def.name} there.`)
        return s
      }
      s.constructionPoints -= def.lineCost
      completeBuilding(s, action.building, action.cell)
      return s
    }

    case 'USE_GREAT_PERSON': {
      if (s.greatPersonTokens <= 0) return s
      s.greatPersonTokens -= 1
      if (action.choice === 'lines') {
        s.constructionPoints += 4
        log(s, 'Great Person: +4 construction lines.')
      } else if (action.choice === 'science') {
        markScience(s, 2, action.scienceTarget)
        log(s, 'Great Person: +2 Science.')
      } else if (action.choice === 'culture' && action.cultureTarget) {
        const row = s.cultureRows[action.cultureTarget.row]
        const cell = row?.cells[action.cultureTarget.col]
        if (cell && !cell.filled) {
          cell.filled = true
          if (row.cells.every((c) => c.filled)) {
            row.completed = true
            log(s, `Culture row ${action.cultureTarget.row + 1} completed via Great Person.`)
            checkMasteryTracks(s)
          }
          checkCultureColumn(s, action.cultureTarget.col + rowGridOffset(row.cells.length))
        }
      }
      return s
    }

    case 'RESOLVE_DROUGHT': {
      if (!s.pendingDrought) return s
      if (action.choice === 'workers') {
        const workers = s.population.filter((p) => p.state === 'worker')
        if (workers.length < 2) return s // can't take this option — not enough Workers
        workers[0].state = 'empty'
        workers[1].state = 'empty'
        log(s, 'Drought: crossed off 2 Workers.')
      } else {
        addUnhappiness(s, 1)
        log(s, 'Drought: +1 Unhappiness.')
      }
      s.pendingDrought = false
      return s
    }

    case 'TAXATION': {
      addUnhappiness(s, 1)
      addGold(s, 2)
      log(s, 'Taxation: +2 Gold, +1 Unhappiness.')
      return s
    }

    case 'CONSCRIPTION': {
      const workers = s.population.filter((p) => p.state === 'worker')
      const n = Math.min(2, workers.length)
      if (n === 0) {
        log(s, 'No Workers available to conscript.')
        return s
      }
      addUnhappiness(s, 1)
      for (let i = 0; i < n; i++) {
        workers[i].state = 'empty'
        const idx = s.militaryBoxes.findIndex((b) => !b)
        if (idx !== -1) s.militaryBoxes[idx] = true
      }
      log(s, `Conscription: ${n} Worker(s) → Soldiers, +1 Unhappiness.`)
      checkMasteryTracks(s)
      return s
    }

    case 'BUILD_FREE_COLONY': {
      if (!s.colonyAvailable) return s
      if (!canBuild(s, 'colony')) {
        log(s, 'Colony requires a staffed School and Garrison first.')
        return s
      }
      if (s.buildings.some((b) => b.type === 'colony')) return s
      const placement = canPlaceBuilding(s, 'colony', action.cell.x, action.cell.y)
      if (!placement.ok) {
        log(s, placement.reason ?? 'Cannot found the Colony there.')
        return s
      }
      s.colonyAvailable = false
      completeBuilding(s, 'colony', action.cell)
      log(s, 'The reclaimed Barbarian land becomes your Colony!')
      return s
    }

    case 'END_DEVELOPMENT': {
      if (s.phase !== 'development') return s
      s.constructionPoints = 0 // unused lines are lost, per rules
      s.phase = 'deployment'
      s.deployedThisRound = 0
      s.bankedAttackPower = 0
      s.bankedDefensePower = 0
      return s
    }

    case 'DEPLOY_BARBARIAN': {
      if (s.phase !== 'deployment') return s
      const site = s.barbarianCells.find((c) => !c.destroyed)
      if (!site || !ensureAttackPower(s)) return s
      s.bankedAttackPower -= 1
      site.destroyed = true
      s.barbarianCamps -= 1
      addGold(s, 3)
      log(s, 'Army destroys a Barbarian camp! +3 Gold.')
      if (s.barbarianCamps === 0) {
        addHappiness(s, 2)
        s.colonyAvailable = true
        log(s, 'All Barbarian camps destroyed! +2 Happiness. A free Colony site is available.')
      }
      return s
    }

    case 'DEPLOY_DEFEND_RAID': {
      if (s.phase !== 'deployment' || !s.pendingRaidDefense) return s
      if (!ensureDefensePower(s)) return s
      s.bankedDefensePower -= 1
      s.pendingRaidDefense = false
      log(s, 'Army repels the Barbarian Raid.')
      return s
    }

    case 'DEPLOY_DEFEND_REVOLT': {
      if (s.phase !== 'deployment' || !s.pendingRevolt) return s
      if (!ensureDefensePower(s)) return s
      s.bankedDefensePower -= 1
      s.pendingRevolt = false
      addUnhappiness(s, 1)
      log(s, 'Army prevents Revolt from destroying a building (+1 Unhappiness).')
      return s
    }

    case 'END_ROUND': {
      if (s.phase !== 'deployment') return s
      if (s.pendingRevoltSacrifice) return s // must resolve the sacrifice prompt first

      // Unresolved Drought choice: default to losing Workers when possible (matches
      // the old forced behavior), else Unhappiness — same fallback spirit as the
      // Revolt sacrifice's auto-target default.
      if (s.pendingDrought) {
        const workers = s.population.filter((p) => p.state === 'worker')
        if (workers.length >= 2) {
          workers[0].state = 'empty'
          workers[1].state = 'empty'
          log(s, 'Drought (unresolved): crossed off 2 Workers.')
        } else {
          addUnhappiness(s, 1)
          log(s, 'Drought (unresolved): +1 Unhappiness.')
        }
        s.pendingDrought = false
      }

      // Unresolved Raid: lose 3 Gold (if able) + 1 Unhappiness.
      if (s.pendingRaidDefense) {
        const lost = Math.min(3, s.gold)
        s.gold -= lost
        addUnhappiness(s, 1)
        log(s, `Unrepelled Raid: -${lost} Gold, +1 Unhappiness.`)
        s.pendingRaidDefense = false
      }
      // Unresolved Revolt: "a building of your choice is destroyed" (rulebook p.10) —
      // that choice happens now, at the actual moment of resolution, not pre-picked
      // earlier in Deployment. Pause the round here; RESOLVE_REVOLT_SACRIFICE finishes it.
      if (s.pendingRevolt) {
        s.pendingRevolt = false
        s.pendingRevoltSacrifice = true
        log(s, 'The Revolt goes unanswered — choose which building to sacrifice.')
        return s
      }

      finishRound(s)
      return s
    }

    case 'RESOLVE_REVOLT_SACRIFICE': {
      if (!s.pendingRevoltSacrifice) return s
      const staffed = s.buildings
        .map((b, i) => ({ b, i }))
        .filter((x) => x.b.staffed && x.b.type !== 'palace')
      const chosen = staffed.find((x) => x.i === action.index)
      const target =
        chosen ??
        [...staffed].sort((a, b) => BUILDING_DEFS[a.b.type].scorePerBuilding - BUILDING_DEFS[b.b.type].scorePerBuilding)[0]
      if (target) {
        log(s, `Revolt destroys your ${BUILDING_DEFS[target.b.type].name}.`)
        // The ruin blocks that plot (and touching it) for the rest of the game —
        // "No new buildings may be built in the same space" (rulebook p.10).
        s.destroyedBuildingCells.push(...target.b.cells.map((c) => ({ ...c })))
        s.buildings.splice(target.i, 1)
      }
      s.pendingRevoltSacrifice = false
      finishRound(s)
      return s
    }

    default:
      return s
  }
}

// The END_ROUND tail: banks any pending Culture bonus, checks mastery tracks, and
// either ends the game or advances to the next round. Shared by END_ROUND directly
// (no Revolt to resolve) and RESOLVE_REVOLT_SACRIFICE (once the sacrifice is chosen)
// so a pending Revolt genuinely pauses the round instead of resolving inline.
function finishRound(s: GameState) {
  // Spend any pending culture-bonus tokens automatically isn't possible without a
  // target, so they stay banked as Great Person-style tokens for the player to use.
  const pendingCulture = (s as any)._pendingCultureBonus ?? 0
  if (pendingCulture > 0) {
    s.greatPersonTokens += pendingCulture
    ;(s as any)._pendingCultureBonus = 0
  }

  checkMasteryTracks(s)

  if (s.round >= s.maxRounds) {
    s.phase = 'gameover'
    s.gameOverScore = computeScore(s)
    log(s, `Round ${s.maxRounds} complete. The Empire's history is written.`)
    return
  }

  s.round += 1
  s.phase = 'dice'
}

function activateBuilding(s: GameState, type: BuildingType, count: number, scienceTarget?: ScienceTarget) {
  if (type === 'farm') {
    for (let i = 0; i < count; i++) addWorker(s)
  } else if (type === 'mine') {
    addGold(s, count)
  } else if (type === 'school') {
    markScience(s, count, scienceTarget)
  } else if (type === 'garrison') {
    for (let i = 0; i < count; i++) {
      const worker = s.population.find((p) => p.state === 'worker')
      if (!worker) break
      worker.state = 'empty'
      const idx = s.militaryBoxes.findIndex((b) => !b)
      if (idx !== -1) s.militaryBoxes[idx] = true
    }
  }
}

function activateColonyBoost(s: GameState, target: BuildingType, scienceTarget?: ScienceTarget) {
  // Solo bonus: activating the Colony activates one other building type as if
  // you had 2 more of it staffed. Player picks which type; see README.
  const count = staffedCountByType(s, target) + 2
  activateBuilding(s, target, count, scienceTarget)
  log(s, `Colony activated: treated as 2 extra ${BUILDING_DEFS[target].name}s this round.`)
}

export function computeScore(s: GameState): ScoreBreakdown {
  const count = (t: BuildingType) => s.buildings.filter((b) => b.type === t && b.staffed).length
  const farms = count('farm') * BUILDING_DEFS.farm.scorePerBuilding
  const mines = count('mine') * BUILDING_DEFS.mine.scorePerBuilding
  const schools = count('school') * BUILDING_DEFS.school.scorePerBuilding
  const garrisons = count('garrison') * BUILDING_DEFS.garrison.scorePerBuilding
  const colonies = count('colony') * BUILDING_DEFS.colony.scorePerBuilding
  const palace = s.buildings.some((b) => b.type === 'palace') ? BUILDING_DEFS.palace.scorePerBuilding : 0
  const gold = s.gold * 1
  const armies = Math.floor(s.militaryBoxes.filter(Boolean).length / 2) * 3
  const mastery = s.masteries.size * 21
  // Column bonuses are immediate Worker/Gold/Science/Happiness grants (see
  // checkCultureColumn), not deferred points — they're already reflected above via
  // gold, and via happinessVal/mastery below, so they aren't added again here.
  const culture = s.cultureRows.filter((r) => r.completed).reduce((a, r) => a + r.score, 0)
  const happinessVal = HAPPINESS_TRACK[s.happiness] ?? 0
  const unhappinessVal = UNHAPPINESS_TRACK[s.unhappiness] ?? 0
  const happinessNet = happinessVal - unhappinessVal
  const total = farms + mines + schools + garrisons + colonies + palace + gold + armies + mastery + culture + happinessNet
  return { farms, mines, schools, garrisons, colonies, palace, gold, armies, mastery, culture, happinessNet, total }
}
