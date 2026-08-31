import clsx from 'clsx'
import type { Die } from '../../engine/types'
import styles from './DiceTray.module.scss'

const FACE: Record<number, string> = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅',
}

// Dynamic-key lookup, since a template-literal key into `styles[...]` doesn't
// camelCase itself.
const DIE_COLOR_CLASS: Record<Die['color'], string> = {
  white: styles.white,
  green: styles.green,
  black: styles.black,
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
    <div className={styles.diceTray} data-tutorial="dice-tray">
      {dice.map((d) => {
        const locked = (d.color === 'green' && !diceUnlocked.green) || (d.color === 'black' && !diceUnlocked.black)
        const used = !!d.usedFor
        return (
          <button
            key={d.id}
            className={clsx(
              styles.die,
              DIE_COLOR_CLASS[d.color],
              locked && styles.locked,
              used && styles.used,
              selectedId === d.id && styles.selected,
            )}
            disabled={!selectable || locked || used}
            onClick={() => onSelect(d.id)}
            title={locked ? `Locked (needs Science unlock)` : used ? 'Already assigned this round' : `Value ${d.value}`}
          >
            <span className={styles.dieFace}>{FACE[d.value]}</span>
            <span className={styles.dieValue}>{d.value}</span>
          </button>
        )
      })}
    </div>
  )
}
