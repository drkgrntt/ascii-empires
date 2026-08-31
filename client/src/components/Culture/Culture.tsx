import clsx from 'clsx'
import type { Die, GameState } from '../../engine/types'
import type { Action } from '../../engine/reducer'
import { useState } from 'react'
import { CULTURE_COLUMN_REWARDS, cultureRewardGlyphs, cultureRewardText } from '../../engine/gameData'
import styles from './Culture.module.scss'

interface Props {
  state: GameState
  dispatch: React.Dispatch<Action>
  selectedDie: Die | null
  onDieConsumed: () => void
}

export function Culture({ state, dispatch, selectedDie, onDieConsumed }: Props) {
  const inDev = state.phase === 'development'
  const [spendingToken, setSpendingToken] = useState(false)
  const maxCols = Math.max(...state.cultureRows.map((r) => r.cells.length))
  // Every row (and the marker/reward rows below the grid) shares this exact column
  // template, so a cell's `gridColumn` always lines up with the same real column
  // across all of them — no separate alignment math needed per row.
  const gridTemplate = { gridTemplateColumns: `repeat(${maxCols}, 26px) auto` }

  return (
    <section className="panel" data-tutorial="culture">
      <h3 className="panel__title">Culture</h3>
      {state.greatPersonTokens > 0 && (
        <button className={clsx('btn btn--small', spendingToken && 'is-active')} onClick={() => setSpendingToken((v) => !v)}>
          {spendingToken ? 'Cancel Great Person spend' : `Spend a banked token on a cell (${state.greatPersonTokens} banked)`}
        </button>
      )}
      <div>
        {state.cultureRows.map((row, ri) => {
          // Rows are right-aligned to the sheet's 7-column grid (shorter rows start
          // further right), so the rightmost column is shared by every row (hardest
          // to complete) and the leftmost only by the longest rows (easiest).
          const offset = maxCols - row.cells.length
          return (
            <div key={ri} className={clsx(styles.row, row.completed && styles.isComplete)} style={gridTemplate}>
              {row.cells.map((cell, ci) => {
                const col = offset + ci
                const canFillWithDie = inDev && selectedDie && !selectedDie.usedFor && !cell.filled && selectedDie.value >= cell.threshold
                const canFillWithToken = spendingToken && !cell.filled
                const clickable = canFillWithDie || canFillWithToken
                return (
                  <button
                    key={ci}
                    className={clsx(styles.cell, cell.filled && styles.isFilled)}
                    style={{ gridColumn: col + 1 }}
                    disabled={!clickable}
                    title={`Needs ${cell.threshold}+`}
                    onClick={() => {
                      if (canFillWithToken) {
                        dispatch({ type: 'USE_GREAT_PERSON', choice: 'culture', cultureTarget: { row: ri, col: ci } })
                        setSpendingToken(false)
                      } else if (selectedDie) {
                        dispatch({ type: 'ASSIGN_DIE', id: selectedDie.id, use: { kind: 'culture', row: ri, col: ci } })
                        onDieConsumed()
                      }
                    }}
                  >
                    {cell.filled ? '✓' : cell.threshold}
                  </button>
                )
              })}
              <span
                className={clsx(styles.rowScore, row.completed && styles.isComplete)}
                style={{ gridColumn: maxCols + 1 }}
                title={`Row reward: +${row.score} pts — scored at game end${row.completed ? ' (row complete)' : ', once every cell in this row is filled'}`}
              >
                +{row.score} pts
              </span>
            </div>
          )
        })}

        <div className={clsx(styles.row, styles.columns)} style={gridTemplate}>
          {Array.from({ length: maxCols }, (_, ci) => (
            <span
              key={ci}
              className={clsx(styles.colMarker, state.cultureColumns[ci] && styles.isComplete)}
              style={{ gridColumn: ci + 1 }}
              title={`Column ${ci + 1}${state.cultureColumns[ci] ? ' — complete' : ''}`}
            >
              {state.cultureColumns[ci] ? '✓' : ci + 1}
            </span>
          ))}
        </div>

        <div className={clsx(styles.row, styles.rewards)} style={gridTemplate}>
          {Array.from({ length: maxCols }, (_, ci) => {
            const reward = CULTURE_COLUMN_REWARDS[ci]
            const complete = state.cultureColumns[ci]
            return (
              <span
                key={ci}
                className={clsx(styles.rewardCell, complete && styles.isComplete)}
                style={{ gridColumn: ci + 1 }}
                title={`Column ${ci + 1} reward: ${cultureRewardText(reward)}${complete ? ' — claimed' : ' — one-time, on completion'}`}
              >
                {cultureRewardGlyphs(reward).map((glyph, gi) => (
                  <span key={gi} className={styles.rewardGlyph}>
                    {glyph}
                  </span>
                ))}
              </span>
            )
          })}
        </div>
      </div>
      <p className="hint">
        Row rewards (right of each row) score points at game end. Column rewards (hover a column below for details)
        pay out immediately — Worker, Gold, Science, or Happiness — the moment every row spanning that column is
        filled; right columns need more rows, so they're the hardest.
      </p>
    </section>
  )
}
