import { describe, expect, it } from 'vitest'
import { createInitialState } from '../initialState'
import { gameReducer } from '../reducer'
import { buildingFootprint, canPlaceBuilding, terrainAt } from '../map'
import type { MapCoord } from '../types'
import { countWorkers, devPhase, dieById, firstUnusedDie } from './testHelpers'

// A guaranteed all-plains, un-Ore'd anchor for a Farm — used across tests that
// just need "a legal spot to build a Farm" without caring about map specifics.
function findAllPlainsFarmAnchor(): MapCoord {
  for (let y = 0; y < 23; y++) {
    for (let x = 0; x < 27; x++) {
      const cells = buildingFootprint('farm', x, y)
      if (cells.every((c) => terrainAt(c.x, c.y) === 'plains')) return { x, y }
    }
  }
  throw new Error('no plains anchor found')
}

describe('ROLL_DICE', () => {
  it('rolls 3 white + 1 green + 1 black dice and advances to diplomacy', () => {
    const s0 = createInitialState()
    const s1 = gameReducer(s0, { type: 'ROLL_DICE' })
    expect(s1.phase).toBe('diplomacy')
    expect(s1.dice).toHaveLength(5)
    expect(s1.dice.filter((d) => d.color === 'white')).toHaveLength(3)
    expect(s1.dice.filter((d) => d.color === 'green')).toHaveLength(1)
    expect(s1.dice.filter((d) => d.color === 'black')).toHaveLength(1)
    expect(s1.dice.every((d) => d.value >= 1 && d.value <= 6)).toBe(true)
    expect(s1.dice.every((d) => d.usedFor === null)).toBe(true)
    // Original state must be untouched (pure reducer).
    expect(s0.phase).toBe('dice')
    expect(s0.dice).toHaveLength(0)
  })

  it('is a no-op outside the dice phase', () => {
    const s1 = gameReducer(createInitialState(), { type: 'ROLL_DICE' })
    const s2 = gameReducer(s1, { type: 'ROLL_DICE' })
    expect(s2.dice).toEqual(s1.dice)
    expect(s2.phase).toBe('diplomacy')
  })
})

describe('REROLL_DICE', () => {
  it('spends 1 Gold per reroll and only works during diplomacy', () => {
    let s = createInitialState()
    s.gold = 5
    s = gameReducer(s, { type: 'ROLL_DICE' })
    const die = firstUnusedDie(s)
    const before = die.value

    s = gameReducer(s, { type: 'REROLL_DICE', ids: [die.id] })
    expect(s.gold).toBe(4)
    expect(s.rerollsThisRound).toBe(1)

    // Now confirm into development; rerolling there must no-op.
    s = gameReducer(s, { type: 'CONFIRM_DIPLOMACY' })
    const goldAfterConfirm = s.gold
    const anyDie = s.dice[0]
    s = gameReducer(s, { type: 'REROLL_DICE', ids: [anyDie.id] })
    expect(s.gold).toBe(goldAfterConfirm)
    void before
  })

  it('refuses to reroll without enough Gold', () => {
    let s = createInitialState()
    s.gold = 0
    s = gameReducer(s, { type: 'ROLL_DICE' })
    const die = firstUnusedDie(s)
    const beforeValue = die.value
    s = gameReducer(s, { type: 'REROLL_DICE', ids: [die.id] })
    expect(s.gold).toBe(0)
    expect(dieById(s, die.id).value).toBe(beforeValue)
  })
})

describe('CONFIRM_DIPLOMACY / disasters', () => {
  it('leaves the Disaster grid untouched when no die shows 1', () => {
    let s = createInitialState()
    s = gameReducer(s, { type: 'ROLL_DICE' })
    const vals = [4, 5, 3, 5, 6]
    s.dice.forEach((d, i) => (d.value = vals[i]))
    s = gameReducer(s, { type: 'CONFIRM_DIPLOMACY' })
    expect(s.phase).toBe('development')
    for (const row of s.disasterRows) {
      expect(row.boxes.filter(Boolean)).toHaveLength(0)
    }
  })

  it('marks row 1 for each 1 rolled, and the rerolled die also marks its final-value row', () => {
    let s = createInitialState()
    s = gameReducer(s, { type: 'ROLL_DICE' })
    s.dice[0].value = 1
    const others = [4, 3, 5, 6]
    for (let i = 1; i < s.dice.length; i++) s.dice[i].value = others[i - 1]
    const rerolledId = s.dice[0].id

    s = gameReducer(s, { type: 'CONFIRM_DIPLOMACY' })

    const rerolledDie = dieById(s, rerolledId)
    expect(rerolledDie.value).not.toBe(1)

    for (const row of s.disasterRows) {
      const marks = row.boxes.filter(Boolean).length
      if (row.dieValue === 1) {
        expect(marks).toBeGreaterThanOrEqual(1)
      } else if (row.dieValue === rerolledDie.value) {
        expect(marks).toBe(1)
      } else {
        expect(marks).toBe(0)
      }
    }
  })
})

describe('ASSIGN_DIE / MODIFY_DIE / UNASSIGN_DIE (construction)', () => {
  it('assigning a die to construction adds its value to constructionPoints, and can be undone', () => {
    let s = createInitialState()
    s = devPhase(s)
    const die = firstUnusedDie(s)
    const value = die.value

    s = gameReducer(s, { type: 'ASSIGN_DIE', id: die.id, use: { kind: 'construction' } })
    expect(s.constructionPoints).toBe(value)
    expect(dieById(s, die.id).usedFor).toEqual({ kind: 'construction' })

    s = gameReducer(s, { type: 'UNASSIGN_DIE', id: die.id })
    expect(s.constructionPoints).toBe(0)
    expect(dieById(s, die.id).usedFor).toBeNull()
  })

  it('MODIFY_DIE spends 1 Gold per +/-1 step, floors at 2, and only works in development', () => {
    let s = createInitialState()
    s.gold = 10
    s = gameReducer(s, { type: 'ROLL_DICE' })
    const die = firstUnusedDie(s)
    die.value = 4 // pin away from 1 so CONFIRM_DIPLOMACY's reroll loop can't touch it

    // Wrong phase (diplomacy): no-op.
    s = gameReducer(s, { type: 'MODIFY_DIE', id: die.id, delta: 1 })
    expect(s.gold).toBe(10)

    s = gameReducer(s, { type: 'CONFIRM_DIPLOMACY' })
    s = gameReducer(s, { type: 'MODIFY_DIE', id: die.id, delta: 1 })
    expect(dieById(s, die.id).value).toBe(5)
    expect(s.gold).toBe(9)

    // Drive it down to the floor of 2 and confirm it won't go lower.
    s = gameReducer(s, { type: 'MODIFY_DIE', id: die.id, delta: -1 })
    s = gameReducer(s, { type: 'MODIFY_DIE', id: die.id, delta: -1 })
    s = gameReducer(s, { type: 'MODIFY_DIE', id: die.id, delta: -1 })
    expect(dieById(s, die.id).value).toBe(2)
    const goldAtFloor = s.gold
    s = gameReducer(s, { type: 'MODIFY_DIE', id: die.id, delta: -1 })
    expect(dieById(s, die.id).value).toBe(2)
    expect(s.gold).toBe(goldAtFloor) // no Gold spent on the rejected modification
  })
})

describe('COMPLETE_BUILDING', () => {
  it('refuses to build without enough construction lines', () => {
    let s = createInitialState()
    s = devPhase(s)
    const anchor = findAllPlainsFarmAnchor()
    s = gameReducer(s, { type: 'COMPLETE_BUILDING', building: 'farm', cell: anchor })
    expect(s.buildings).toHaveLength(0)
  })

  it('builds a Farm once enough lines are banked, staffing it from Population', () => {
    let s = createInitialState()
    s = devPhase(s)
    s.constructionPoints = 8 // Farm costs exactly 8 lines
    const anchor = findAllPlainsFarmAnchor()
    const workersBefore = countWorkers(s)

    s = gameReducer(s, { type: 'COMPLETE_BUILDING', building: 'farm', cell: anchor })

    expect(s.buildings).toHaveLength(1)
    expect(s.buildings[0].type).toBe('farm')
    expect(s.buildings[0].staffed).toBe(true)
    expect(s.constructionPoints).toBe(0)
    expect(countWorkers(s)).toBe(workersBefore - 1)
  })

  it('spends 1 Gold automatically when the footprint touches Mountains', () => {
    let s = createInitialState()
    s = devPhase(s)
    s.gold = 5
    s.constructionPoints = 8
    // Find a Mountains-touching, otherwise-legal anchor.
    let anchor: MapCoord | null = null
    for (let y = 1; y < 23 && !anchor; y++) {
      for (let x = 0; x < 26; x++) {
        const check = canPlaceBuilding(s, 'farm', x, y)
        const cells = buildingFootprint('farm', x, y)
        if (check.ok && cells.some((c) => terrainAt(c.x, c.y) === 'mountains')) {
          anchor = { x, y }
          break
        }
      }
    }
    expect(anchor).not.toBeNull()
    s = gameReducer(s, { type: 'COMPLETE_BUILDING', building: 'farm', cell: anchor! })
    expect(s.buildings).toHaveLength(1)
    expect(s.gold).toBe(4)
  })

  it('enforces the Level II prerequisite (staffed Farm + Mine) before a School/Garrison can be built', () => {
    let s = createInitialState()
    s = devPhase(s)
    s.constructionPoints = 12
    const anchor = { x: 20, y: 8 } // arbitrary; prereq check should fail before placement matters
    s = gameReducer(s, { type: 'COMPLETE_BUILDING', building: 'school', cell: anchor })
    expect(s.buildings).toHaveLength(0)
    expect(s.constructionPoints).toBe(12) // lines not spent — rejected before deduction
  })
})

describe('END_DEVELOPMENT / deployment / END_ROUND', () => {
  it('END_DEVELOPMENT clears unused lines and moves to deployment', () => {
    let s = createInitialState()
    s = devPhase(s)
    s.constructionPoints = 6
    s = gameReducer(s, { type: 'END_DEVELOPMENT' })
    expect(s.phase).toBe('deployment')
    expect(s.constructionPoints).toBe(0)
    expect(s.deployedThisRound).toBe(0)
    expect(s.bankedAttackPower).toBe(0)
    expect(s.bankedDefensePower).toBe(0)
  })

  it('DEPLOY_BARBARIAN spends an Army, destroys a camp, and grants 3 Gold', () => {
    let s = createInitialState()
    s.militaryBoxes[0] = true
    s.militaryBoxes[1] = true // 1 full Army
    s.phase = 'deployment'
    const before = s.barbarianCamps

    s = gameReducer(s, { type: 'DEPLOY_BARBARIAN' })

    expect(s.barbarianCamps).toBe(before - 1)
    expect(s.gold).toBe(3)
    expect(s.deployedThisRound).toBe(1)
    expect(s.bankedAttackPower).toBe(0) // the 1 Power banked was fully spent on this attack
  })

  it('grants the free Colony site and +2 Happiness once the last camp falls', () => {
    let s = createInitialState()
    s.militaryBoxes[0] = true
    s.militaryBoxes[1] = true
    s.barbarianCells = s.barbarianCells.map((c, i) => ({ ...c, destroyed: i !== 0 }))
    s.barbarianCamps = 1
    s.phase = 'deployment'

    s = gameReducer(s, { type: 'DEPLOY_BARBARIAN' })

    expect(s.barbarianCamps).toBe(0)
    expect(s.colonyAvailable).toBe(true)
    expect(s.happiness).toBe(2)
  })

  it('Iron doubles Army attack Power, and banked Power covers a second attack with no new Army', () => {
    let s = createInitialState()
    s.scienceBranchMarked.engineeringApproach = 10 // unlocks wallsIron
    s.scienceTrunkMarked = 4
    s.scienceBranchMarked.wallsIron = 7 // Iron milestone (index 7)
    s.militaryBoxes[0] = true
    s.militaryBoxes[1] = true // exactly 1 Army
    s.barbarianCells = [
      { x: 0, y: 0, destroyed: false },
      { x: 1, y: 0, destroyed: false },
    ]
    s.barbarianCamps = 2
    s.phase = 'deployment'

    s = gameReducer(s, { type: 'DEPLOY_BARBARIAN' })
    expect(s.deployedThisRound).toBe(1)
    expect(s.bankedAttackPower).toBe(1) // Iron granted 2, 1 spent on this attack
    expect(s.barbarianCamps).toBe(1)

    s = gameReducer(s, { type: 'DEPLOY_BARBARIAN' })
    expect(s.deployedThisRound).toBe(1) // no new Army deployed — reused banked Power
    expect(s.bankedAttackPower).toBe(0)
    expect(s.barbarianCamps).toBe(0)
  })

  it('advances to the next round in the dice phase', () => {
    let s = createInitialState()
    s.phase = 'deployment'
    const round = s.round
    s = gameReducer(s, { type: 'END_ROUND' })
    expect(s.round).toBe(round + 1)
    expect(s.phase).toBe('dice')
  })

  it('ends the game with a computed score once the final round completes', () => {
    let s = createInitialState()
    s.maxRounds = 1
    s.phase = 'deployment'
    s = gameReducer(s, { type: 'END_ROUND' })
    expect(s.phase).toBe('gameover')
    expect(s.gameOverScore).not.toBeNull()
    expect(s.gameOverScore!.total).toBe(0) // a bare starting Empire scores 0
  })
})

describe('USE_GREAT_PERSON', () => {
  it('the "lines" choice grants +4 construction lines and consumes a token', () => {
    let s = createInitialState()
    s.greatPersonTokens = 1
    s.phase = 'development'
    s = gameReducer(s, { type: 'USE_GREAT_PERSON', choice: 'lines' })
    expect(s.constructionPoints).toBe(4)
    expect(s.greatPersonTokens).toBe(0)
  })

  it('is a no-op with zero tokens available', () => {
    let s = createInitialState()
    s.greatPersonTokens = 0
    s = gameReducer(s, { type: 'USE_GREAT_PERSON', choice: 'lines' })
    expect(s.constructionPoints).toBe(0)
  })
})

describe('RESOLVE_DROUGHT', () => {
  it('is a genuine choice — choosing Unhappiness is honored even with enough Workers to lose instead', () => {
    let s = createInitialState()
    s.pendingDrought = true
    const before = countWorkers(s)

    s = gameReducer(s, { type: 'RESOLVE_DROUGHT', choice: 'unhappiness' })

    expect(countWorkers(s)).toBe(before)
    expect(s.unhappiness).toBe(1)
    expect(s.pendingDrought).toBe(false)
  })

  it('the "workers" choice crosses off exactly 2 Workers', () => {
    let s = createInitialState()
    s.pendingDrought = true
    const before = countWorkers(s)
    s = gameReducer(s, { type: 'RESOLVE_DROUGHT', choice: 'workers' })
    expect(countWorkers(s)).toBe(before - 2)
    expect(s.unhappiness).toBe(0)
  })
})

describe('Revolt sacrifice flow', () => {
  it('pauses the round at END_ROUND until a sacrifice is chosen, then honors an explicit choice', () => {
    let s = createInitialState()
    s.phase = 'deployment'
    s.pendingRevolt = true
    s.buildings = [
      { type: 'farm', staffed: true, anchor: { x: 3, y: 12 }, cells: buildingFootprint('farm', 3, 12) },
      { type: 'school', staffed: true, anchor: { x: 9, y: 6 }, cells: buildingFootprint('school', 9, 6) },
    ]
    const round = s.round

    s = gameReducer(s, { type: 'END_ROUND' })
    expect(s.round).toBe(round)
    expect(s.pendingRevoltSacrifice).toBe(true)
    expect(s.buildings).toHaveLength(2)

    // Re-dispatching END_ROUND while the prompt is pending must no-op.
    const again = gameReducer(s, { type: 'END_ROUND' })
    expect(again.round).toBe(round)
    expect(again.pendingRevoltSacrifice).toBe(true)

    // Explicitly sacrifice the School (index 1), not the auto lowest-scoring Farm.
    s = gameReducer(s, { type: 'RESOLVE_REVOLT_SACRIFICE', index: 1 })
    expect(s.round).toBe(round + 1)
    expect(s.pendingRevoltSacrifice).toBe(false)
    expect(s.buildings).toHaveLength(1)
    expect(s.buildings[0].type).toBe('farm')
    expect(s.destroyedBuildingCells.length).toBeGreaterThan(0)
  })

  it('auto-picks the lowest-scoring building when no explicit choice is given', () => {
    let s = createInitialState()
    s.phase = 'deployment'
    s.pendingRevolt = true
    s.buildings = [
      { type: 'farm', staffed: true, anchor: { x: 3, y: 12 }, cells: buildingFootprint('farm', 3, 12) },
      { type: 'school', staffed: true, anchor: { x: 9, y: 6 }, cells: buildingFootprint('school', 9, 6) },
    ]
    s = gameReducer(s, { type: 'END_ROUND' })
    s = gameReducer(s, { type: 'RESOLVE_REVOLT_SACRIFICE', index: null })
    expect(s.buildings).toHaveLength(1)
    expect(s.buildings[0].type).toBe('school') // Farm (score 2) is the lower-scoring one
  })
})

describe('Population Great Person groups', () => {
  it('completing a group of 6 Workers grants exactly 1 Great Person token', () => {
    let s = createInitialState()
    for (let i = 0; i < 6; i++) s.population[i].state = 'worker'
    expect(s.greatPersonTokens).toBe(0)
    s.buildings = [{ type: 'farm', staffed: true, anchor: { x: 1, y: 11 }, cells: buildingFootprint('farm', 1, 11) }]
    s = devPhase(s)
    const die = firstUnusedDie(s)
    die.value = 2 // meets Farm's minActivationDie of 2
    s = gameReducer(s, { type: 'ASSIGN_DIE', id: die.id, use: { kind: 'activate', building: 'farm' } })

    expect(countWorkers(s)).toBe(7)
    expect(s.greatPersonTokens).toBe(1)
  })
})
