import { useState } from 'react'
import { useGame } from './hooks/useGame'
import { useTutorial } from './hooks/useTutorial'
import { TutorialOverlay } from './components/TutorialOverlay/TutorialOverlay'
import { DiceTray } from './components/DiceTray/DiceTray'
import { PhaseBar } from './components/PhaseBar/PhaseBar'
import { EmpireTracks } from './components/EmpireTracks/EmpireTracks'
import { Buildings } from './components/Buildings/Buildings'
import { Map } from './components/Map/Map'
import { Trade } from './components/Trade/Trade'
import { Culture } from './components/Culture/Culture'
import { Deployment } from './components/Deployment/Deployment'
import { Disasters } from './components/Disasters/Disasters'
import { AnytimeActions } from './components/AnytimeActions/AnytimeActions'
import { Log } from './components/Log/Log'
import { Scoreboard } from './components/Scoreboard/Scoreboard'
import type { BuildingType } from './engine/types'
import styles from './App.module.scss'

export default function App() {
  const { state, dispatch } = useGame()
  const tutorial = useTutorial(state)
  const [selectedDieId, setSelectedDieId] = useState<string | null>(null)
  const [pendingBuild, setPendingBuild] = useState<BuildingType | null>(null)

  const selectedDie = state.dice.find((d) => d.id === selectedDieId) ?? null
  const clearSelection = () => setSelectedDieId(null)

  const handleCellClick = (x: number, y: number) => {
    if (!pendingBuild) return
    if (pendingBuild === 'colony') {
      dispatch({ type: 'BUILD_FREE_COLONY', cell: { x, y } })
    } else {
      dispatch({ type: 'COMPLETE_BUILDING', building: pendingBuild, cell: { x, y } })
    }
    setPendingBuild(null)
  }

  return (
    <div className={styles.app}>
      <header className={styles.header} data-tutorial="header">
        <h1>
          <span className={styles.titleAscii}>[####]</span> ASCII EMPIRES <span className={styles.titleSub}>— solo campaign</span>
        </h1>
        <div className={styles.headerRight}>
          <button className="btn btn--small" title="Replay the guided tutorial" onClick={tutorial.start}>
            ? Tutorial
          </button>
          <div className={styles.round}>
            Round {state.round} / {state.maxRounds}
          </div>
        </div>
      </header>

      <PhaseBar state={state} dispatch={dispatch} selectedDieId={selectedDieId} onClearSelection={clearSelection} />

      <div className={styles.diceRow}>
        <DiceTray
          dice={state.dice}
          diceUnlocked={state.diceUnlocked}
          selectedId={selectedDieId}
          onSelect={(id) => setSelectedDieId((cur) => (cur === id ? null : id))}
          selectable={state.phase === 'diplomacy' || state.phase === 'development'}
        />
        {selectedDie && state.phase === 'development' && (
          <div className={styles.selectedHint}>
            Selected: {selectedDie.color} die showing {selectedDie.value}. Choose where to spend it below.
            <span className={styles.dieModify}>
              <button
                className="btn btn--small"
                disabled={state.gold < 1}
                title="Spend 1 Gold to raise this die by 1 (may exceed 6)"
                onClick={() => dispatch({ type: 'MODIFY_DIE', id: selectedDie.id, delta: 1 })}
              >
                +1 (1 Gold)
              </button>
              <button
                className="btn btn--small"
                disabled={state.gold < 1 || selectedDie.value <= 2}
                title="Spend 1 Gold to lower this die by 1 (never below 2)"
                onClick={() => dispatch({ type: 'MODIFY_DIE', id: selectedDie.id, delta: -1 })}
              >
                -1 (1 Gold)
              </button>
            </span>
          </div>
        )}
      </div>

      <Map
        state={state}
        pendingBuild={pendingBuild}
        onCellClick={handleCellClick}
        onCancelPlacement={() => setPendingBuild(null)}
      />

      <main className={styles.grid}>
        <div className={styles.col}>
          <EmpireTracks state={state} />
          <AnytimeActions state={state} dispatch={dispatch} />
          <Disasters state={state} dispatch={dispatch} />
        </div>

        <div className={styles.col}>
          <Buildings
            state={state}
            dispatch={dispatch}
            selectedDie={selectedDie}
            onDieConsumed={clearSelection}
            pendingBuild={pendingBuild}
            onStartPlacement={setPendingBuild}
          />
          <Deployment state={state} dispatch={dispatch} />
        </div>

        <div className={styles.col}>
          <Trade state={state} dispatch={dispatch} selectedDie={selectedDie} onDieConsumed={clearSelection} />
          <Culture state={state} dispatch={dispatch} selectedDie={selectedDie} onDieConsumed={clearSelection} />
        </div>

        <div className={styles.col}>
          <Log entries={state.log} />
        </div>
      </main>

      {state.phase === 'gameover' && state.gameOverScore && (
        <Scoreboard score={state.gameOverScore} onRestart={() => window.location.reload()} />
      )}

      {tutorial.active && tutorial.step && (
        <TutorialOverlay
          step={tutorial.step}
          stepNumber={tutorial.stepNumber}
          totalSteps={tutorial.totalSteps}
          onNext={tutorial.next}
          onDismiss={tutorial.dismiss}
        />
      )}
    </div>
  )
}
