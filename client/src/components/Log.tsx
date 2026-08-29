import type { LogEntry } from '../engine/types'

export function Log({ entries }: { entries: LogEntry[] }) {
  const recent = [...entries].slice(-40).reverse()
  return (
    <section className="panel log">
      <h3 className="panel__title">Chronicle</h3>
      <ul className="log__list">
        {recent.map((e, i) => (
          <li key={i} className="log__entry">
            <span className="log__round">R{e.round}</span>
            <span className="log__text">{e.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
