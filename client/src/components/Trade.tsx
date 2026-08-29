import { TRADE_REWARDS, tradeRewardText } from '../engine/gameData'
import type { Die, GameState } from '../engine/types'
import type { Action } from '../engine/reducer'

interface Props {
  state: GameState
  dispatch: React.Dispatch<Action>
  selectedDie: Die | null
  onDieConsumed: () => void
}

export function Trade({ state, dispatch, selectedDie, onDieConsumed }: Props) {
  const inDev = state.phase === 'development'
  return (
    <section className="panel trade" data-tutorial="trade">
      <h3 className="panel__title">Trade Caravans</h3>
      <div className="trade__rows">
        {state.tradeRows.map((row, ri) => (
          <div key={ri} className={['trade__row', row.completed ? 'is-complete' : ''].join(' ')}>
            {row.cells.map((cell, ci) => {
              const isNext = !cell.filled && row.cells.slice(0, ci).every((c) => c.filled)
              const canFill = inDev && selectedDie && !selectedDie.usedFor && isNext && selectedDie.value >= cell.threshold
              return (
                <button
                  key={ci}
                  className={['trade__cell', cell.filled ? 'is-filled' : '', isNext ? 'is-next' : ''].join(' ')}
                  disabled={!canFill}
                  title={`Needs ${cell.threshold}+`}
                  onClick={() => {
                    if (selectedDie) {
                      dispatch({ type: 'ASSIGN_DIE', id: selectedDie.id, use: { kind: 'trade', row: ri } })
                      onDieConsumed()
                    }
                  }}
                >
                  {cell.filled ? '✓' : cell.threshold}
                </button>
              )
            })}
            <span className="trade__reward">
              {row.completed ? 'Delivered — ' : '→ '}
              {tradeRewardText(TRADE_REWARDS[ri])}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
