import type { LogEntry } from '../../engine/types'
import styles from './Log.module.scss'

export function Log({ entries }: { entries: LogEntry[] }) {
  const recent = [...entries].slice(-40).reverse()
  return (
    <section className="panel">
      <h3 className="panel__title">Chronicle</h3>
      <ul className={styles.list}>
        {recent.map((e, i) => (
          <li key={i} className={styles.entry}>
            <span className={styles.round}>R{e.round}</span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
