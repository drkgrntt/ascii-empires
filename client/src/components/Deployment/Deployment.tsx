import { BUILDING_DEFS } from '../../engine/gameData'
import type { GameState } from '../../engine/types'
import type { Action } from '../../engine/reducer'
import styles from './Deployment.module.scss'

export function Deployment({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const totalArmies = Math.floor(state.militaryBoxes.filter(Boolean).length / 2)
  const available = totalArmies - state.deployedThisRound
  const active = state.phase === 'deployment'
  const canAttack = state.bankedAttackPower > 0 || available > 0
  const canDefend = state.bankedDefensePower > 0 || available > 0
  const sacrificeCandidates = state.buildings
    .map((b, i) => ({ b, i }))
    .filter((x) => x.b.staffed && x.b.type !== 'palace')

  return (
    <section className="panel" data-tutorial="deployment">
      <h3 className="panel__title">Deployment ({available} Army power free)</h3>
      {(state.bankedAttackPower > 0 || state.bankedDefensePower > 0) && (
        <p className="hint">
          Banked this round: {state.bankedAttackPower > 0 && `${state.bankedAttackPower} Attack`}
          {state.bankedAttackPower > 0 && state.bankedDefensePower > 0 && ', '}
          {state.bankedDefensePower > 0 && `${state.bankedDefensePower} Defense`} Power (Iron/Walls double each Army deployed).
        </p>
      )}
      <div className={styles.actions}>
        <button className="btn btn--small" disabled={!active || !canAttack || state.barbarianCamps <= 0} onClick={() => dispatch({ type: 'DEPLOY_BARBARIAN' })}>
          Attack a Barbarian camp ({state.barbarianCamps} left) → +3 Gold
        </button>
        {state.pendingRaidDefense && (
          <button className="btn btn--small btn--warn" disabled={!active || !canDefend} onClick={() => dispatch({ type: 'DEPLOY_DEFEND_RAID' })}>
            Repel this round's Raid
          </button>
        )}
        {state.pendingRevolt && (
          <button className="btn btn--small btn--warn" disabled={!active || !canDefend} onClick={() => dispatch({ type: 'DEPLOY_DEFEND_REVOLT' })}>
            Prevent Revolt (costs +1 Unhappiness)
          </button>
        )}
      </div>

      {/* "A building of your choice is destroyed" (rulebook p.10) — asked right at
          the moment the Revolt actually resolves (round's end, still unanswered),
          not pre-picked earlier while there was still a chance to prevent it. */}
      {state.pendingRevoltSacrifice && (
        <div className={styles.revoltChoice}>
          <p className="hint">The Revolt struck — choose which building to sacrifice:</p>
          <div className={styles.actions}>
            {sacrificeCandidates.map(({ b, i }) => (
              <button
                key={i}
                className="btn btn--small btn--warn"
                onClick={() => dispatch({ type: 'RESOLVE_REVOLT_SACRIFICE', index: i })}
              >
                {BUILDING_DEFS[b.type].name} (worth {BUILDING_DEFS[b.type].scorePerBuilding} pts)
              </button>
            ))}
            <button className="btn btn--small" onClick={() => dispatch({ type: 'RESOLVE_REVOLT_SACRIFICE', index: null })}>
              Auto (lowest-scoring)
            </button>
          </div>
        </div>
      )}

      {!state.pendingRaidDefense && !state.pendingRevolt && !state.pendingRevoltSacrifice && (
        <p className="hint">No pending threats this round.</p>
      )}
    </section>
  )
}
