import { describe, expect, it } from 'vitest'
import { cloneState, createInitialState, nextId } from '../initialState'
import { BARBARIAN_CAMPS_TOTAL, CULTURE_COLUMN_COUNT, GOLD_TRACK_MAX, MILITARY_BOXES, POPULATION_SLOTS } from '../gameData'

describe('createInitialState', () => {
  it('has the documented track lengths (measured off the sheet)', () => {
    const s = createInitialState()
    expect(s.population).toHaveLength(35)
    expect(s.population).toHaveLength(POPULATION_SLOTS)
    expect(s.goldTrackMax).toBe(49)
    expect(s.goldTrackMax).toBe(GOLD_TRACK_MAX)
    expect(s.militaryBoxes).toHaveLength(14)
    expect(s.militaryBoxes).toHaveLength(MILITARY_BOXES)
  })

  it('starts with exactly 3 Workers, the rest of Population empty', () => {
    const s = createInitialState()
    const workers = s.population.filter((p) => p.state === 'worker')
    const empty = s.population.filter((p) => p.state === 'empty')
    expect(workers).toHaveLength(3)
    expect(empty).toHaveLength(32)
  })

  it('starts at round 1 of 20, in the dice phase, with no dice rolled yet', () => {
    const s = createInitialState()
    expect(s.round).toBe(1)
    expect(s.maxRounds).toBe(20)
    expect(s.phase).toBe('dice')
    expect(s.dice).toHaveLength(0)
    expect(s.rerollsThisRound).toBe(0)
  })

  it('unlocks only the white die at the start', () => {
    const s = createInitialState()
    expect(s.diceUnlocked).toEqual({ white: true, green: false, black: false })
  })

  it('has zero Gold, zero Military progress, and no buildings', () => {
    const s = createInitialState()
    expect(s.gold).toBe(0)
    expect(s.militaryBoxes.every((b) => b === false)).toBe(true)
    expect(s.buildings).toHaveLength(0)
    expect(s.constructionPoints).toBe(0)
    expect(s.greatPersonTokens).toBe(0)
  })

  it('seeds one Barbarian camp per fixed map site (5), none destroyed', () => {
    const s = createInitialState()
    expect(s.barbarianCamps).toBe(5)
    expect(s.barbarianCamps).toBe(BARBARIAN_CAMPS_TOTAL)
    expect(s.barbarianCampsTotal).toBe(5)
    expect(s.barbarianCells).toHaveLength(5)
    expect(s.barbarianCells.every((c) => c.destroyed === false)).toBe(true)
    expect(s.colonyAvailable).toBe(false)
  })

  it('has the documented Trade/Culture/Disaster grid shapes', () => {
    const s = createInitialState()
    expect(s.tradeRows).toHaveLength(5)
    expect(s.cultureRows).toHaveLength(4)
    expect(s.cultureColumns).toHaveLength(CULTURE_COLUMN_COUNT)
    expect(s.disasterRows).toHaveLength(6)
    expect(s.disasterRows.map((r) => r.dieValue)).toEqual([1, 2, 3, 4, 5, 6])
    expect(s.disasterRows.every((r) => r.boxes.length === 3 && !r.triggered)).toBe(true)
  })

  it('has no Masteries and a fully unmarked Science tree', () => {
    const s = createInitialState()
    expect(s.masteries.size).toBe(0)
    expect(s.scienceTrunkMarked).toBe(0)
    expect(Object.values(s.scienceBranchMarked).every((n) => n === 0)).toBe(true)
  })

  it('has no pending disaster prompts and zero happiness/unhappiness', () => {
    const s = createInitialState()
    expect(s.pendingDrought).toBe(false)
    expect(s.pendingRaidDefense).toBe(false)
    expect(s.pendingRevolt).toBe(false)
    expect(s.pendingRevoltSacrifice).toBe(false)
    expect(s.happiness).toBe(0)
    expect(s.unhappiness).toBe(0)
  })

  it('logs the opening entry for round 1', () => {
    const s = createInitialState()
    expect(s.log).toHaveLength(1)
    expect(s.log[0].round).toBe(1)
  })
})

describe('nextId', () => {
  it('produces unique ids under the given prefix', () => {
    const a = nextId('die')
    const b = nextId('die')
    expect(a).not.toBe(b)
    expect(a.startsWith('die-')).toBe(true)
    expect(b.startsWith('die-')).toBe(true)
  })
})

describe('cloneState', () => {
  it('produces an independent deep copy — mutating the clone never affects the original', () => {
    const s = createInitialState()
    const clone = cloneState(s)

    clone.gold = 99
    clone.population[0].state = 'school'
    clone.dice.push({ id: 'x', color: 'white', value: 1, usedFor: null })
    clone.militaryBoxes[0] = true
    clone.masteries.add('gold')
    clone.buildings.push({ type: 'farm', staffed: true, anchor: { x: 0, y: 0 }, cells: [{ x: 0, y: 0 }] })
    clone.log.push({ round: 1, text: 'mutated' })

    expect(s.gold).toBe(0)
    expect(s.population[0].state).toBe('worker')
    expect(s.dice).toHaveLength(0)
    expect(s.militaryBoxes[0]).toBe(false)
    expect(s.masteries.size).toBe(0)
    expect(s.buildings).toHaveLength(0)
    expect(s.log).toHaveLength(1)
  })
})
