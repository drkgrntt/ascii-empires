import { describe, expect, it } from 'vitest'
import { createInitialState } from '../initialState'
import { gameReducer } from '../reducer'
import { buildingFootprint } from '../map'
import type { GameState, ScienceTarget } from '../types'
import { devPhase, firstUnusedDie } from './testHelpers'

// Mirrors server/internal/engine/reducer_test.go's TestScienceBranchingFullTree:
// walks the entire branching Science tree (trunk -> Philosophy, and
// trunk -> engineeringApproach -> {engineeringBranch, wallsIron}) via repeated
// School activations, checking every unlock milestone and terminal Mastery along
// the way.
function activateSchoolFor(s: GameState, target: ScienceTarget): GameState {
  let next = devPhase(s)
  const die = firstUnusedDie(next)
  die.value = 4 // meets School's minActivationDie of 4
  next = gameReducer(next, {
    type: 'ASSIGN_DIE',
    id: die.id,
    use: { kind: 'activate', building: 'school', scienceTarget: target },
  })
  next = gameReducer(next, { type: 'END_DEVELOPMENT' })
  next = gameReducer(next, { type: 'END_ROUND' })
  return next
}

describe('Science tree branching', () => {
  it('walks the full tree: trunk -> Philosophy / engineeringApproach -> engineeringBranch + wallsIron', () => {
    let s = createInitialState()
    s.maxRounds = 100000 // plenty of rounds for ~48 School activations
    s.buildings = [{ type: 'school', staffed: true, anchor: { x: 9, y: 5 }, cells: buildingFootprint('school', 9, 5) }]

    for (let i = 0; i < 4; i++) s = activateSchoolFor(s, 'trunk')
    expect(s.scienceTrunkMarked).toBe(4)

    for (let i = 0; i < 16; i++) s = activateSchoolFor(s, 'philosophy')
    expect(s.scienceBranchMarked.philosophy).toBe(16)
    expect(s.diceUnlocked.green).toBe(true)
    expect(s.masteries.has('science-philosophy')).toBe(true)

    for (let i = 0; i < 10; i++) s = activateSchoolFor(s, 'engineeringApproach')
    expect(s.scienceBranchMarked.engineeringApproach).toBe(10)

    for (let i = 0; i < 7; i++) s = activateSchoolFor(s, 'engineeringBranch')
    expect(s.diceUnlocked.black).toBe(true)
    expect(s.masteries.has('science-engineeringBranch')).toBe(true)

    for (let i = 0; i < 11; i++) s = activateSchoolFor(s, 'wallsIron')
    expect(s.masteries.has('science-wallsIron')).toBe(true)

    expect([...s.masteries]).toEqual(
      expect.arrayContaining(['science-philosophy', 'science-engineeringBranch', 'science-wallsIron']),
    )
  })

  it('a branch cannot be marked before its prerequisite is fully complete — falls back to an available target', () => {
    let s = createInitialState()
    s.buildings = [{ type: 'school', staffed: true, anchor: { x: 9, y: 5 }, cells: buildingFootprint('school', 9, 5) }]
    // Trunk is empty, so requesting the Philosophy branch (requires trunk complete)
    // must fall back to marking the trunk instead of the requested branch.
    s = activateSchoolFor(s, 'philosophy')
    expect(s.scienceBranchMarked.philosophy).toBe(0)
    expect(s.scienceTrunkMarked).toBe(1)
  })

  it('Irrigation (trunk milestone) protects against Drought', () => {
    let s = createInitialState()
    s.scienceTrunkMarked = 4 // Irrigation milestone
    // Pre-fill row 1's first two boxes so this round's guaranteed 1 deterministically
    // fills the 3rd box and actually triggers the Drought check (rather than leaving
    // it untriggered by chance, which would make the assertion vacuous).
    const row1 = s.disasterRows.find((r) => r.dieValue === 1)!
    row1.boxes = [true, true, false]
    s.phase = 'dice'
    s = gameReducer(s, { type: 'ROLL_DICE' })
    s.dice[0].value = 1
    const others = [4, 3, 5, 6]
    for (let i = 1; i < s.dice.length; i++) s.dice[i].value = others[i - 1]

    s = gameReducer(s, { type: 'CONFIRM_DIPLOMACY' })
    expect(s.disasterRows.find((r) => r.dieValue === 1)!.triggered).toBe(true)
    expect(s.pendingDrought).toBe(false)
  })
})
