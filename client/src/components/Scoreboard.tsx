import type { ScoreBreakdown } from '../engine/types'

const ROWS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'farms', label: 'Farms' },
  { key: 'mines', label: 'Mines' },
  { key: 'schools', label: 'Schools' },
  { key: 'garrisons', label: 'Garrisons' },
  { key: 'colonies', label: 'Colonies' },
  { key: 'palace', label: 'Palace' },
  { key: 'gold', label: 'Unspent Gold' },
  { key: 'armies', label: 'Armies' },
  { key: 'mastery', label: 'Mastery bonuses' },
  { key: 'culture', label: 'Culture' },
  { key: 'happinessNet', label: 'Happiness − Unhappiness' },
]

export function Scoreboard({ score, onRestart }: { score: ScoreBreakdown; onRestart: () => void }) {
  return (
    <div className="scoreboard-overlay">
      <div className="scoreboard">
        <h2>Your Empire's Final Score</h2>
        <table>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{score[r.key]}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{score.total}</td>
            </tr>
          </tfoot>
        </table>
        <button className="btn btn--primary" onClick={onRestart}>
          Found a new Empire
        </button>
      </div>
    </div>
  )
}
