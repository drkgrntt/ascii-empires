import type { GameState } from '../engine/types'
import type { Action } from '../engine/reducer'

export function AnytimeActions({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const disabled = state.phase === 'gameover' || state.phase === 'dice'
  return (
    <section className="panel anytime" data-tutorial="anytime">
      <h3 className="panel__title">Anytime</h3>
      <div className="anytime__actions">
        <button className="btn btn--small" disabled={disabled} onClick={() => dispatch({ type: 'TAXATION' })}>
          Taxation: +2 Gold, +1 :(
        </button>
        <button className="btn btn--small" disabled={disabled} onClick={() => dispatch({ type: 'CONSCRIPTION' })}>
          Conscription: up to 2 Workers → Soldiers, +1 :(
        </button>
      </div>
    </section>
  )
}
