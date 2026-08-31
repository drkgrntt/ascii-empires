import clsx from 'clsx'
import { TRADE_REWARDS, tradeRewardText } from '../../engine/gameData'
import type { Die, GameState } from '../../engine/types'
import type { Action } from '../../engine/reducer'
import styles from './Trade.module.scss'

interface Props {
  state: GameState
  dispatch: React.Dispatch<Action>
  selectedDie: Die | null
  onDieConsumed: () => void
}

export function Trade({ state, dispatch, selectedDie, onDieConsumed }: Props) {
  const inDev = state.phase === 'development'
  return (
    <section className="panel" data-tutorial="trade">
      <h3 className="panel__title">Trade Caravans</h3>
      <div>
        {state.tradeRows.map((row, ri) => (
          <div key={ri} className={clsx(styles.row, row.completed && styles.isComplete)}>
            {row.cells.map((cell, ci) => {
              const isNext = !cell.filled && row.cells.slice(0, ci).every((c) => c.filled)
              const canFill = inDev && selectedDie && !selectedDie.usedFor && isNext && selectedDie.value >= cell.threshold
              return (
                <button
                  key={ci}
                  className={clsx(styles.cell, cell.filled && styles.isFilled, isNext && styles.isNext)}
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
            <span className={styles.reward}>
              {row.completed ? 'Delivered — ' : '→ '}
              {tradeRewardText(TRADE_REWARDS[ri])}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
