import type { Die, GameState } from '../types'
import { gameReducer } from '../reducer'

// Rolls dice and confirms Diplomacy, landing in Development, then neutralizes any
// random disaster fallout (Drought/Raid/Revolt/Unhappiness) so callers get a
// deterministic state to build scenarios on top of — mirrors the Go engine's
// own devPhase() test helper (server/internal/engine/reducer_test.go).
export function devPhase(state: GameState): GameState {
  let s = gameReducer(state, { type: 'ROLL_DICE' })
  s = gameReducer(s, { type: 'CONFIRM_DIPLOMACY' })
  s.pendingRaidDefense = false
  s.pendingRevolt = false
  s.pendingDrought = false
  s.unhappiness = 0
  return s
}

export function firstUnusedDie(s: GameState): Die {
  const die = s.dice.find((d) => !d.usedFor)
  if (!die) throw new Error('no unused die available')
  return die
}

export function dieById(s: GameState, id: string): Die {
  const die = s.dice.find((d) => d.id === id)
  if (!die) throw new Error(`die ${id} not found`)
  return die
}

export function countWorkers(s: GameState): number {
  return s.population.filter((p) => p.state === 'worker').length
}
