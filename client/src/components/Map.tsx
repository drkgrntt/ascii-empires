import { useState } from 'react'
import { BUILDING_DEFS } from '../engine/gameData'
import { MAP_HEIGHT, MAP_WIDTH, buildingFootprint, canPlaceBuilding, isBorderlands, isOreCell, terrainAt } from '../engine/map'
import type { BuildingType, GameState } from '../engine/types'

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
    <section className="panel map" data-tutorial="map">
      <h3 className="panel__title">
        Map
        {pendingBuild && (
          <button className="btn btn--small map__cancel" onClick={onCancelPlacement}>
            Cancel
          </button>
        )}
      </h3>

      <div className="map__grid-wrap">
        <div className="map__grid" style={{ gridTemplateColumns: `repeat(${MAP_WIDTH}, 1fr)` }}>
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
                title = 'Mountains — costs 1 Gold to build'
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

              const classes = [
                'map__cell',
                `map__cell--${terrain}`,
                terrain === 'plains' && isBorderlands(x, y) && 'map__cell--borderlands',
                ore && 'map__cell--ore',
                camp && !camp.destroyed && 'map__cell--barbarian',
                camp?.destroyed && !building && 'map__cell--reclaimed',
                building && 'map__cell--building',
                building && !building.staffed && 'map__cell--unstaffed',
                clickable && 'map__cell--clickable',
                isPreview(x, y) && (previewOk ? 'map__cell--preview-ok' : 'map__cell--preview-bad'),
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  className={classes}
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

      <div className="map__legend">
        <span>
          <i className="map__swatch map__cell--water">~</i> Water
        </span>
        <span>
          <i className="map__swatch map__cell--plains">.</i> Plains
        </span>
        <span>
          <i className="map__swatch map__cell--mountains">^</i> Mountains (1 Gold to build)
        </span>
        <span>
          <i className="map__swatch map__cell--borderlands">.</i> Barbarian territory
        </span>
        <span>
          <i className="map__swatch map__cell--ore">*</i> Ore (Mines)
        </span>
        <span>
          <i className="map__swatch map__cell--barbarian">B</i> Barbarian camp
        </span>
        <span>
          <i className="map__swatch map__cell--reclaimed">o</i> Reclaimed (Colony)
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
