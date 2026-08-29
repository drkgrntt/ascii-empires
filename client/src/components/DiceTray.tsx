import type { Die } from '../engine/types'

const FACE: Record<number, string> = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅',
}

interface Props {
  dice: Die[]
  diceUnlocked: { white: boolean; green: boolean; black: boolean }
  selectedId: string | null
  onSelect: (id: string) => void
  selectable: boolean
}

export function DiceTray({ dice, diceUnlocked, selectedId, onSelect, selectable }: Props) {
  return (
    <div className="dice-tray" data-tutorial="dice-tray">
      {dice.map((d) => {
        const locked = (d.color === 'green' && !diceUnlocked.green) || (d.color === 'black' && !diceUnlocked.black)
        const used = !!d.usedFor
        return (
          <button
            key={d.id}
            className={[
              'die',
              `die--${d.color}`,
              locked ? 'die--locked' : '',
              used ? 'die--used' : '',
              selectedId === d.id ? 'die--selected' : '',
            ].join(' ')}
            disabled={!selectable || locked || used}
            onClick={() => onSelect(d.id)}
            title={locked ? `Locked (needs Science unlock)` : used ? 'Already assigned this round' : `Value ${d.value}`}
          >
            <span className="die__face">{FACE[d.value]}</span>
            <span className="die__value">{d.value}</span>
          </button>
        )
      })}
    </div>
  )
}
