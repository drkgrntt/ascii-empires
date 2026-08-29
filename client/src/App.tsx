import { useState } from 'react'
import { useGame } from './hooks/useGame'
import { useTutorial } from './hooks/useTutorial'
import { TutorialOverlay } from './components/TutorialOverlay'
import { DiceTray } from './components/DiceTray'
import { PhaseBar } from './components/PhaseBar'
import { EmpireTracks } from './components/EmpireTracks'
import { Buildings } from './components/Buildings'
import { Map } from './components/Map'
import { Trade } from './components/Trade'
import { Culture } from './components/Culture'
import { Deployment } from './components/Deployment'
import { Disasters } from './components/Disasters'
import { AnytimeActions } from './components/AnytimeActions'
import { Log } from './components/Log'
import { Scoreboard } from './components/Scoreboard'
import type { BuildingType } from './engine/types'
import './App.scss'

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
    <div className="app">
      <header className="app__header" data-tutorial="header">
        <h1>
          <span className="app__title-ascii">[####]</span> ASCII EMPIRES <span className="app__title-sub">— solo campaign</span>
        </h1>
        <div className="app__header-right">
          <button className="btn btn--small" title="Replay the guided tutorial" onClick={tutorial.start}>
            ? Tutorial
          </button>
          <div className="app__round">
            Round {state.round} / {state.maxRounds}
          </div>
        </div>
      </header>

      <PhaseBar state={state} dispatch={dispatch} selectedDieId={selectedDieId} onClearSelection={clearSelection} />

      <div className="app__dice-row">
        <DiceTray
          dice={state.dice}
          diceUnlocked={state.diceUnlocked}
          selectedId={selectedDieId}
          onSelect={(id) => setSelectedDieId((cur) => (cur === id ? null : id))}
          selectable={state.phase === 'diplomacy' || state.phase === 'development'}
        />
        {selectedDie && state.phase === 'development' && (
          <div className="app__selected-hint">
            Selected: {selectedDie.color} die showing {selectedDie.value}. Choose where to spend it below.
            <span className="app__die-modify">
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

      <main className="app__grid">
        <div className="app__col">
          <EmpireTracks state={state} />
          <AnytimeActions state={state} dispatch={dispatch} />
          <Disasters state={state} dispatch={dispatch} />
        </div>

        <div className="app__col">
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

        <div className="app__col">
          <Trade state={state} dispatch={dispatch} selectedDie={selectedDie} onDieConsumed={clearSelection} />
          <Culture state={state} dispatch={dispatch} selectedDie={selectedDie} onDieConsumed={clearSelection} />
        </div>

        <div className="app__col">
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
