import { useState } from 'react'
import { BUILDING_DEFS, BUILDING_ORDER, SCIENCE_BRANCHES, SCIENCE_BRANCH_ORDER, SCIENCE_TRUNK_LENGTH } from '../engine/gameData'
import type { BuildingType, Die, GameState, ScienceBranchId, ScienceTarget } from '../engine/types'
import type { Action } from '../engine/reducer'

interface Props {
  state: GameState
  dispatch: React.Dispatch<Action>
  selectedDie: Die | null
  onDieConsumed: () => void
  pendingBuild: BuildingType | null
  onStartPlacement: (type: BuildingType) => void
}

const COLONY_BOOST_TARGETS: BuildingType[] = ['farm', 'mine', 'school', 'garrison']

function isTargetComplete(state: GameState, target: ScienceTarget): boolean {
  if (target === 'trunk') return state.scienceTrunkMarked >= SCIENCE_TRUNK_LENGTH
  return state.scienceBranchMarked[target] >= SCIENCE_BRANCHES[target].length
}
function isBranchUnlocked(state: GameState, id: ScienceBranchId): boolean {
  return isTargetComplete(state, SCIENCE_BRANCHES[id].requires)
}
// Every currently-markable Science target — the trunk (if not yet full) plus any
// unlocked, not-yet-full branch. Used to populate the branch picker and to keep it
// pointed at something valid as the game progresses.
function availableScienceTargets(state: GameState): ScienceTarget[] {
  const targets: ScienceTarget[] = []
  if (!isTargetComplete(state, 'trunk')) targets.push('trunk')
  for (const id of SCIENCE_BRANCH_ORDER) {
    if (isBranchUnlocked(state, id) && !isTargetComplete(state, id)) targets.push(id)
  }
  return targets
}
function scienceTargetLabel(target: ScienceTarget): string {
  return target === 'trunk' ? 'Trunk' : SCIENCE_BRANCHES[target].label
}

export function Buildings({ state, dispatch, selectedDie, onDieConsumed, pendingBuild, onStartPlacement }: Props) {
  const inDev = state.phase === 'development'
  const [boostTarget, setBoostTarget] = useState<BuildingType>('farm')
  const [scienceTarget, setScienceTarget] = useState<ScienceTarget>('trunk')
  const scienceTargets = availableScienceTargets(state)
  const activeScienceTarget = scienceTargets.includes(scienceTarget) ? scienceTarget : scienceTargets[0]

  const countOf = (t: BuildingType) => state.buildings.filter((b) => b.type === t).length
  const staffedOf = (t: BuildingType) => state.buildings.filter((b) => b.type === t && b.staffed).length

  return (
    <section className="panel buildings" data-tutorial="buildings">
      <h3 className="panel__title">Buildings</h3>

      <div className="buildings__construction">
        <span>
          Construction lines available: <strong>{state.constructionPoints}</strong>
        </span>
        <button
          className="btn btn--small"
          disabled={!inDev || !selectedDie}
          onClick={() => {
            if (selectedDie) {
              dispatch({ type: 'ASSIGN_DIE', id: selectedDie.id, use: { kind: 'construction' } })
              onDieConsumed()
            }
          }}
        >
          Add selected die to Construction
        </button>
        {state.greatPersonTokens > 0 && (
          <>
            <button className="btn btn--small" onClick={() => dispatch({ type: 'USE_GREAT_PERSON', choice: 'lines' })}>
              Spend Great Person → +4 lines ({state.greatPersonTokens} banked)
            </button>
            <button
              className="btn btn--small"
              disabled={!activeScienceTarget}
              onClick={() => dispatch({ type: 'USE_GREAT_PERSON', choice: 'science', scienceTarget: activeScienceTarget })}
            >
              Spend Great Person → +2 Science ({activeScienceTarget ? scienceTargetLabel(activeScienceTarget) : 'none available'})
            </button>
          </>
        )}
      </div>

      <div className="buildings__table-wrap">
        <table className="buildings__table">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '29%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Building</th>
              <th>Lv</th>
              <th>Cost</th>
              <th>Die</th>
              <th>Built</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {BUILDING_ORDER.filter((t) => t !== 'colony').map((t) => {
              const def = BUILDING_DEFS[t]
              const built = countOf(t)
              const staffed = staffedOf(t)
              const canActivate =
                inDev && selectedDie && !selectedDie.usedFor && selectedDie.value >= def.minActivationDie && staffed > 0 && def.minActivationDie > 0
              return (
                <tr key={t} className={pendingBuild === t ? 'is-placing' : undefined}>
                  <td>{def.name}</td>
                  <td>{def.level}</td>
                  <td>{def.lineCost || '—'}</td>
                  <td>{def.minActivationDie ? `${def.minActivationDie}+` : '—'}</td>
                  <td>
                    {built} ({staffed})
                  </td>
                  <td className="buildings__actions">
                    {def.lineCost > 0 && (
                      <button
                        className="btn btn--small"
                        disabled={!inDev || pendingBuild !== null}
                        onClick={() => onStartPlacement(t)}
                      >
                        {pendingBuild === t ? 'Placing…' : 'Build'}
                      </button>
                    )}
                    {t === 'school' && scienceTargets.length > 1 && (
                      <select
                        className="buildings__science-target"
                        value={activeScienceTarget}
                        onChange={(e) => setScienceTarget(e.target.value as ScienceTarget)}
                      >
                        {scienceTargets.map((target) => (
                          <option key={target} value={target}>
                            {scienceTargetLabel(target)}
                          </option>
                        ))}
                      </select>
                    )}
                    {def.minActivationDie > 0 && (
                      <button
                        className="btn btn--small"
                        disabled={!canActivate || (t === 'school' && !activeScienceTarget)}
                        onClick={() => {
                          if (selectedDie) {
                            dispatch({
                              type: 'ASSIGN_DIE',
                              id: selectedDie.id,
                              use: { kind: 'activate', building: t, scienceTarget: t === 'school' ? activeScienceTarget : undefined },
                            })
                            onDieConsumed()
                          }
                        }}
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {state.colonyAvailable && (
        <button
          className="btn btn--primary btn--small"
          disabled={pendingBuild !== null}
          onClick={() => onStartPlacement('colony')}
        >
          {pendingBuild === 'colony' ? 'Pick a reclaimed plot on the map…' : 'Claim free Colony on reclaimed Barbarian land'}
        </button>
      )}
      {countOf('colony') > 0 && <p className="hint">Colony built ({staffedOf('colony')} staffed).</p>}
      {staffedOf('colony') > 0 && (
        <div className="buildings__colony-activate">
          <label>
            Colony boost target:{' '}
            <select value={boostTarget} onChange={(e) => setBoostTarget(e.target.value as BuildingType)}>
              {COLONY_BOOST_TARGETS.map((t) => (
                <option key={t} value={t}>
                  {BUILDING_DEFS[t].name}
                </option>
              ))}
            </select>
          </label>
          {boostTarget === 'school' && scienceTargets.length > 1 && (
            <label>
              Science branch:{' '}
              <select value={activeScienceTarget} onChange={(e) => setScienceTarget(e.target.value as ScienceTarget)}>
                {scienceTargets.map((target) => (
                  <option key={target} value={target}>
                    {scienceTargetLabel(target)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="btn btn--small"
            disabled={
              !inDev ||
              !selectedDie ||
              !!selectedDie.usedFor ||
              selectedDie.value < BUILDING_DEFS.colony.minActivationDie ||
              (boostTarget === 'school' && !activeScienceTarget)
            }
            onClick={() => {
              if (selectedDie) {
                dispatch({
                  type: 'ASSIGN_DIE',
                  id: selectedDie.id,
                  use: {
                    kind: 'activate',
                    building: 'colony',
                    boostTarget,
                    scienceTarget: boostTarget === 'school' ? activeScienceTarget : undefined,
                  },
                })
                onDieConsumed()
              }
            }}
          >
            Activate Colony (die {BUILDING_DEFS.colony.minActivationDie}+): treat chosen type as +2
          </button>
        </div>
      )}
    </section>
  )
}
