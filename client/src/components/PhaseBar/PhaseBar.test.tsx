import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { createInitialState } from '../../engine/initialState'
import { PhaseBar } from './PhaseBar'
import styles from './PhaseBar.module.scss'

describe('<PhaseBar />', () => {
  it('highlights the current phase and offers the dice-phase action', () => {
    const state = createInitialState()
    render(<PhaseBar state={state} dispatch={vi.fn()} selectedDieId={null} onClearSelection={vi.fn()} />)

    expect(screen.getByText('1 · Dice')).toHaveClass(styles.isActive)
    expect(screen.getByText('2 · Diplomacy')).not.toHaveClass(styles.isActive)
    expect(screen.getByRole('button', { name: /roll the five dice/i })).toBeInTheDocument()
  })

  it('dispatches ROLL_DICE when the roll button is clicked', () => {
    const dispatch = vi.fn()
    const state = createInitialState()
    render(<PhaseBar state={state} dispatch={dispatch} selectedDieId={null} onClearSelection={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /roll the five dice/i }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'ROLL_DICE' })
  })

  it('disables End Round while a Revolt sacrifice is pending', () => {
    const state = createInitialState()
    state.phase = 'deployment'
    state.pendingRevoltSacrifice = true
    render(<PhaseBar state={state} dispatch={vi.fn()} selectedDieId={null} onClearSelection={vi.fn()} />)

    expect(screen.getByRole('button', { name: /end round/i })).toBeDisabled()
  })
})
