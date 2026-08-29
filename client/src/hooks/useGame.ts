import { useReducer } from 'react'
import { gameReducer } from '../engine/reducer'
import { createInitialState } from '../engine/initialState'

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  return { state, dispatch }
}
