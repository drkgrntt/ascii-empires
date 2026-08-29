import type { GameState } from '../engine/types'
import type { Action } from '../engine/reducer'

const PHASE_LABEL: Record<GameState['phase'], string> = {
  dice: '1 · Dice',
  diplomacy: '2 · Diplomacy',
  disasters: '3 · Disasters',
  development: '4 · Development',
  deployment: '5 · Deployment',
  gameover: 'Empire Complete',
}

interface Props {
  state: GameState
  dispatch: React.Dispatch<Action>
  selectedDieId: string | null
  onClearSelection: () => void
}

export function PhaseBar({ state, dispatch, selectedDieId, onClearSelection }: Props) {
  const phases: GameState['phase'][] = ['dice', 'diplomacy', 'disasters', 'development', 'deployment']

  return (
    <div className="phase-bar" data-tutorial="phase-bar">
      <div className="phase-bar__steps">
        {phases.map((p) => (
          <span key={p} className={['phase-bar__step', state.phase === p ? 'is-active' : ''].join(' ')}>
            {PHASE_LABEL[p]}
          </span>
        ))}
      </div>

      <div className="phase-bar__action">
        {state.phase === 'dice' && (
          <button className="btn btn--primary" onClick={() => dispatch({ type: 'ROLL_DICE' })}>
            Roll the five dice
          </button>
        )}
        {state.phase === 'diplomacy' && (
          <div className="phase-bar__diplomacy">
            <p className="hint">
              Select die faces above, then reroll them for {1} Gold per reroll — or move straight to Disasters.
            </p>
            <div className="phase-bar__row">
              <button
                className="btn"
                disabled={!selectedDieId}
                onClick={() => {
                  if (selectedDieId) {
                    dispatch({ type: 'REROLL_DICE', ids: [selectedDieId] })
                    onClearSelection()
                  }
                }}
              >
                Reroll selected die ({state.gold} Gold available)
              </button>
              <button className="btn btn--primary" onClick={() => dispatch({ type: 'CONFIRM_DIPLOMACY' })}>
                Proceed to Disasters →
              </button>
            </div>
          </div>
        )}
        {state.phase === 'development' && (
          <button className="btn btn--primary" onClick={() => dispatch({ type: 'END_DEVELOPMENT' })}>
            End Development →
          </button>
        )}
        {state.phase === 'deployment' && (
          <button
            className="btn btn--primary"
            disabled={state.pendingRevoltSacrifice}
            title={state.pendingRevoltSacrifice ? 'Choose which building the Revolt destroys first.' : undefined}
            onClick={() => dispatch({ type: 'END_ROUND' })}
          >
            {state.round >= state.maxRounds ? 'Finish the game →' : 'End round →'}
          </button>
        )}
      </div>
    </div>
  )
}
