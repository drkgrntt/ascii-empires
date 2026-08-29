import type { GameState } from '../engine/types'
import type { Action } from '../engine/reducer'

// What actually happens when each row's 3rd box fills — rulebook p.10. Rows 2/4/6
// have no named disaster, but every row 3-6 still grants a free Culture mark
// ("Hardship breeds creativity") regardless of whether its named effect applies.
const DISASTER_EFFECTS: Record<number, string> = {
  1: "Drought (only if you haven't researched Irrigation): your choice — cross off 2 Workers, or gain 1 Unhappiness.",
  2: 'No named disaster on this row — just a die-value tally toward the grid.',
  3: "Barbarian Raid (only if camps remain and you haven't researched Walls): deploy an Army in Deployment to repel it, or lose 3 Gold and gain 1 Unhappiness.",
  4: 'No named disaster on this row — just a die-value tally toward the grid.',
  5: 'Revolt (only if Unhappiness exceeds Happiness): deploy an Army to defend it (+1 Unhappiness), or a staffed building of your choice is destroyed once the round ends.',
  6: 'No named disaster on this row — just a die-value tally toward the grid.',
}

export function Disasters({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const workerCount = state.population.filter((p) => p.state === 'worker').length
  return (
    <section className="panel disasters" data-tutorial="disasters">
      <h3 className="panel__title">Disaster Grid</h3>
      {state.pendingDrought && (
        <div className="disasters__drought-choice">
          <p className="hint">Drought: choose one.</p>
          <button
            className="btn btn--small btn--warn"
            disabled={workerCount < 2}
            onClick={() => dispatch({ type: 'RESOLVE_DROUGHT', choice: 'workers' })}
          >
            Cross off 2 Workers
          </button>
          <button className="btn btn--small btn--warn" onClick={() => dispatch({ type: 'RESOLVE_DROUGHT', choice: 'unhappiness' })}>
            Gain 1 Unhappiness
          </button>
        </div>
      )}
      <div className="disasters__rows">
        {state.disasterRows.map((row) => {
          const effect = DISASTER_EFFECTS[row.dieValue]
          const tooltip = row.hasCultureBonus
            ? `${effect} Filling this row's 3rd box also grants a free Culture-grid mark either way, per "Hardship breeds creativity."`
            : effect
          return (
            <div
              key={row.dieValue}
              className={['disasters__row', row.triggered ? 'is-triggered' : ''].join(' ')}
              title={tooltip}
            >
              <span className="disasters__die">{row.dieValue}</span>
              <span className="disasters__boxes">
                {row.boxes.map((b, i) => (
                  <span key={i} className={['disasters__box', b ? 'is-filled' : ''].join(' ')} />
                ))}
              </span>
              <span className="disasters__name">
                {row.name ?? '—'}
                {row.hasCultureBonus && <span className="disasters__culture-flag"> +C</span>}
              </span>
            </div>
          )
        })}
      </div>
      <p className="hint">Hover a row for what its disaster actually does.</p>
    </section>
  )
}
