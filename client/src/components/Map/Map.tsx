import { useState } from 'react'
import clsx from 'clsx'
import { BUILDING_DEFS } from '../../engine/gameData'
import { MAP_HEIGHT, MAP_WIDTH, buildingFootprint, canPlaceBuilding, isOreCell, terrainAt } from '../../engine/map'
import type { BuildingType, GameState, Terrain } from '../../engine/types'
import styles from './Map.module.scss'

interface Props {
  state: GameState
  pendingBuild: BuildingType | null
  onCellClick: (x: number, y: number) => void
  onCancelPlacement: () => void
}

const BUILDING_GLYPH: Record<BuildingType, string> = {
  farm: 'F',
  mine: 'M',
  school: 'S',
  garrison: 'G',
  colony: 'C',
  palace: 'P',
}

// 'plains' has no dedicated tint (the base .cell background covers it), so it
// maps to undefined here — clsx drops falsy entries, same effect as the old
// dead `map__cell--plains` className this replaces.
const TERRAIN_CLASS: Record<Terrain, string | undefined> = {
  water: styles.water,
  plains: undefined,
  mountains: styles.mountains,
}

const ROWS = Array.from({ length: MAP_HEIGHT }, (_, y) => y)
const COLS = Array.from({ length: MAP_WIDTH }, (_, x) => x)

export function Map({ state, pendingBuild, onCellClick, onCancelPlacement }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const buildingAt = (x: number, y: number) => state.buildings.find((b) => b.cells.some((c) => c.x === x && c.y === y))
  const barbarianAt = (x: number, y: number) => state.barbarianCells.find((c) => c.x === x && c.y === y)

  // While placing, preview every plot the pending building would actually cover
  // from the hovered anchor — its shape is fixed (rulebook p.5: "cannot rotate
  // them"), so it's easy to click expecting a single square and get more.
  const previewCells = pendingBuild && hover ? buildingFootprint(pendingBuild, hover.x, hover.y) : []
  const previewOk = pendingBuild && hover ? canPlaceBuilding(state, pendingBuild, hover.x, hover.y).ok : false
  const isPreview = (x: number, y: number) => previewCells.some((c) => c.x === x && c.y === y)

  return (
    <section className={clsx('panel', styles.map)} data-tutorial="map">
      <h3 className="panel__title">
        Map
        {pendingBuild && (
          <button className={clsx('btn btn--small', styles.cancel)} onClick={onCancelPlacement}>
            Cancel
          </button>
        )}
      </h3>

      <div className={styles.gridWrap}>
        <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${MAP_WIDTH}, 1fr)` }}>
          {ROWS.map((y) =>
            COLS.map((x) => {
              const terrain = terrainAt(x, y)
              const ore = isOreCell(x, y)
              const building = buildingAt(x, y)
              const camp = barbarianAt(x, y)
              const clickable = !!pendingBuild && canPlaceBuilding(state, pendingBuild, x, y).ok

              let glyph = '.'
              let title = 'Plains'
              if (terrain === 'water') {
                glyph = '~'
                title = 'Water — cannot build'
              }
              if (terrain === 'mountains') {
                glyph = '^'
                title = 'Mountains (Barbarian territory) — costs 1 Gold to build'
              }
              if (ore) {
                glyph = '*'
                title = 'Ore deposit — needed for Mines'
              }
              if (camp && !camp.destroyed) {
                glyph = 'B'
                title = 'Barbarian camp'
              }
              if (camp?.destroyed && !building) {
                glyph = 'o'
                title = 'Reclaimed land — Colony site'
              }
              if (building) {
                glyph = BUILDING_GLYPH[building.type]
                title = `${BUILDING_DEFS[building.type].name}${building.staffed ? '' : ' (unstaffed)'}`
              }

              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  className={clsx(
                    styles.cell,
                    TERRAIN_CLASS[terrain],
                    ore && styles.ore,
                    camp && !camp.destroyed && styles.barbarian,
                    camp?.destroyed && !building && styles.reclaimed,
                    building && styles.building,
                    building && !building.staffed && styles.unstaffed,
                    clickable && styles.clickable,
                    isPreview(x, y) && (previewOk ? styles.previewOk : styles.previewBad),
                  )}
                  title={title}
                  disabled={!clickable}
                  onMouseEnter={() => pendingBuild && setHover({ x, y })}
                  onFocus={() => pendingBuild && setHover({ x, y })}
                  onClick={() => onCellClick(x, y)}
                >
                  {glyph}
                </button>
              )
            }),
          )}
        </div>
      </div>

      <div className={styles.legend}>
        <span>
          <i className={clsx(styles.swatch, styles.water)}>~</i> Water
        </span>
        <span>
          <i className={styles.swatch}>.</i> Plains
        </span>
        <span>
          <i className={clsx(styles.swatch, styles.mountains)}>^</i> Mountains / Barbarian territory (1 Gold to build)
        </span>
        <span>
          <i className={clsx(styles.swatch, styles.ore)}>*</i> Ore (Mines)
        </span>
        <span>
          <i className={clsx(styles.swatch, styles.barbarian)}>B</i> Barbarian camp
        </span>
        <span>
          <i className={clsx(styles.swatch, styles.reclaimed)}>o</i> Reclaimed (Colony)
        </span>
      </div>

      {pendingBuild && (
        <p className="hint">
          {pendingBuild === 'colony' ? (
            <>Click a highlighted plot to place your Colony.</>
          ) : (
            <>
              Hover to preview, then click a highlighted plot to place your {BUILDING_DEFS[pendingBuild].name} — it
              covers more than one square, in the fixed shape shown on the sheet (can't be rotated).
            </>
          )}
        </p>
      )}
    </section>
  )
}
