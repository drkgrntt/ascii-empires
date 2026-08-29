import type { BuildingType, GameState, PopulationSlot, ScienceBranchId, ScienceTarget } from '../engine/types'
import {
  BUILDING_DEFS,
  HAPPINESS_TRACK,
  POPULATION_GROUPS,
  SCIENCE_BRANCHES,
  SCIENCE_BRANCH_ORDER,
  SCIENCE_TRUNK_LENGTH,
  SCIENCE_TRUNK_MILESTONES,
  UNHAPPINESS_TRACK,
} from '../engine/gameData'

// A branch is unlocked once whatever it `requires` (the trunk, or another branch)
// is fully marked — mirrors reducer.ts's isBranchUnlocked (kept UI-side to avoid
// exporting reducer internals).
function isTargetComplete(state: GameState, target: ScienceTarget): boolean {
  if (target === 'trunk') return state.scienceTrunkMarked >= SCIENCE_TRUNK_LENGTH
  return state.scienceBranchMarked[target] >= SCIENCE_BRANCHES[target].length
}
function isBranchUnlocked(state: GameState, id: ScienceBranchId): boolean {
  return isTargetComplete(state, SCIENCE_BRANCHES[id].requires)
}

function Track({
  title,
  boxes,
  className,
  hint,
}: {
  title: string
  boxes: { char: string; filled: boolean; highlight?: boolean; title?: string; groupEnd?: boolean }[]
  className?: string
  hint?: string
}) {
  return (
    <div className={['track', className].filter(Boolean).join(' ')}>
      <div className="track__title">{title}</div>
      <div className="track__boxes">
        {boxes.map((b, i) => (
          <span
            key={i}
            title={b.title}
            className={[
              'track__box',
              b.filled ? 'is-filled' : '',
              b.highlight ? 'is-highlight' : '',
              b.groupEnd ? 'is-group-end' : '',
            ].join(' ')}
          >
            {b.filled ? b.char : ''}
          </span>
        ))}
      </div>
      {hint && <div className="track__hint">{hint}</div>}
    </div>
  )
}

// A Worker becomes a Specialist the moment you use them to staff a newly built or
// activated building — not automatically at any particular population count. Group
// boundaries (sizes from POPULATION_GROUPS) are the thing that IS count-driven:
// filling every slot in one group produces a Great Person, regardless of how many
// of those slots are Workers vs. already-staffed Specialists.
function populationBoxes(population: PopulationSlot[]) {
  const boxes: { char: string; filled: boolean; title: string; groupEnd?: boolean }[] = []
  let offset = 0
  POPULATION_GROUPS.forEach((size, groupIndex) => {
    for (let i = 0; i < size; i++) {
      const slot = population[offset + i]
      const filled = slot.state !== 'empty'
      let title: string
      let char = ''
      if (slot.state === 'empty') {
        title = `Empty — group ${groupIndex + 1} of 7 (${size} slots). Filling every slot in a group produces a Great Person, whether they end up Workers or Specialists.`
      } else if (slot.state === 'worker') {
        char = '/'
        title = 'Worker — ready to staff a building (becoming a Specialist) or be Conscripted into a Soldier.'
      } else {
        const def = BUILDING_DEFS[slot.state as BuildingType]
        char = slot.state[0].toUpperCase()
        title = `Specialist — staffing your ${def.name}. Became one the moment they staffed it, not at any particular Population count.`
      }
      boxes.push({ char, filled, title, groupEnd: i === size - 1 })
    }
    offset += size
  })
  return boxes
}

export function EmpireTracks({ state }: { state: GameState }) {
  const workers = state.population.filter((p) => p.state === 'worker').length
  const specialists = state.population.filter((p) => p.state !== 'worker' && p.state !== 'empty').length

  return (
    <section className="empire-tracks" data-tutorial="empire-tracks">
      <Track
        title={`Population (${workers} Workers, ${specialists} Specialists)`}
        boxes={populationBoxes(state.population)}
        hint="A Worker becomes a Specialist the moment you use them to staff a building — hover a box for details. The gaps mark the 7 Great-Person groups (6/6/6/5/4/4/4); filling every slot in one — Workers or Specialists alike — produces a Great Person."
        className="track--population"
      />
      <Track
        title={`Gold (${state.gold} / ${state.goldTrackMax})`}
        boxes={Array.from({ length: state.goldTrackMax }, (_, i) => ({ char: 'O', filled: i < state.gold }))}
        className="track--gold"
      />
      <Track
        title={`Military (${Math.floor(state.militaryBoxes.filter(Boolean).length / 2)} Armies)`}
        boxes={state.militaryBoxes.map((b) => ({ char: 'X', filled: b }))}
        className="track--military"
      />
      <div className="track-group track--science-group">
        <Track
          title={`Science: Trunk (${state.scienceTrunkMarked} / ${SCIENCE_TRUNK_LENGTH})`}
          boxes={Array.from({ length: SCIENCE_TRUNK_LENGTH }, (_, i) => ({
            char: 'S',
            filled: i < state.scienceTrunkMarked,
            highlight: SCIENCE_TRUNK_MILESTONES.some((m) => m.index === i + 1),
          }))}
          className="track--science"
        />
        {SCIENCE_BRANCH_ORDER.map((id) => {
          const def = SCIENCE_BRANCHES[id]
          const unlocked = isBranchUnlocked(state, id)
          const marked = state.scienceBranchMarked[id]
          return unlocked ? (
            <Track
              key={id}
              title={`Science: ${def.label} (${marked} / ${def.length})`}
              boxes={Array.from({ length: def.length }, (_, i) => ({
                char: 'S',
                filled: i < marked,
                highlight: def.milestones.some((m) => m.index === i + 1),
              }))}
              className="track--science"
            />
          ) : (
            <div key={id} className="track track--science-locked">
              <div className="track__title">
                🔒 Science: {def.label} (requires {def.requires === 'trunk' ? 'the Trunk' : SCIENCE_BRANCHES[def.requires].label})
              </div>
            </div>
          )
        })}
      </div>
      <div className="track-pair">
        <Track
          title={`Happiness (${HAPPINESS_TRACK[state.happiness]})`}
          boxes={Array.from({ length: state.happinessMax }, (_, i) => ({ char: ':)', filled: i < state.happiness }))}
          className="track--happy"
        />
        <Track
          title={`Unhappiness (${UNHAPPINESS_TRACK[state.unhappiness]})`}
          boxes={Array.from({ length: state.unhappinessMax }, (_, i) => ({ char: ':(', filled: i < state.unhappiness }))}
          className="track--unhappy"
        />
      </div>
    </section>
  )
}
