- Can we add some indication of when in the population flow you'd get a specialist?
- Can we add some sort of indication or tooltip of what happens with each disaster?
- Can we actually split client and server into 2 directories so they need to be run from each one? 
Similarly structured to how my store repo is set up.

Instead of telling me about the fixes in the chat, just put the fixes in here.
Please add to the file, don't replace the contents.

## Fixes (2026-08-24)

- **Specialist indication**: The Population track (`client/src/components/EmpireTracks.tsx`)
  now shows the 7 Great-Person group boundaries as visible gaps (sizes 6/6/6/5/4/4/4), and every
  box has a hover tooltip explaining its state. A Worker becomes a Specialist the moment you use
  them to staff a building — not at any particular population count — so that's called out
  explicitly in both the tooltips and a hint line under the track. Filling every slot in a group
  (Workers or Specialists alike) is what produces a Great Person.

- **Disaster tooltips**: Each row of the Disaster Grid (`client/src/components/Disasters.tsx`)
  now has a hover tooltip describing exactly what happens when that row triggers: Drought (row 1,
  only if Irrigation isn't researched), Barbarian Raid (row 3, only if camps remain and Walls
  isn't researched), Revolt (row 5, only if Unhappiness exceeds Happiness), and the fact that
  rows 3-6 also grant a free Culture-grid mark regardless ("Hardship breeds creativity") — shown
  with a `+C` badge. Rows 2/4/6 have no named disaster and say so.

- **Client/server split**: The repo root is now just `client/` and `server/`, each fully
  self-contained (own package.json/go.mod, README, .gitignore) with nothing shared at the root —
  same pattern as the `store` repo. Run the solo game from `client/` (`npm install && npm run
  dev`); run the multiplayer server from `server/` (see its README for `.env` setup and `make`
  targets). Both directories build/test clean after the move.

  Note: your editor may still show stale "module not found" errors from before the directory
  move — a window reload/restart should clear those. Terminal builds (`tsc -b`, `go build`) are
  clean.

## Fixes (2026-08-29)

- **Building shapes**: Every building placed on the map was previously just one grid square,
  regardless of type. The rulebook's BUILDINGS section (and the sheet's own diagrams,
  `client/docs/ASCII_Empires_Player_Sheet_Color.pdf`) actually draws each type as a specific
  multi-square outline in a fixed orientation you can't rotate — I measured each one directly
  off the sheet's dot-grid template and cross-checked the result against the "(N lines)" cost
  printed for each type (a shape's edge count has to equal that number exactly):
  - Farm (8 lines): an L-tromino — 2 squares in a row plus 1 more below the left one.
  - Mine (8 lines): a solid 2x2 square (the Ore deposit just needs to fall somewhere inside it).
  - School (12 lines): a solid 3-wide top row with the middle square underneath missing (an
    open archway).
  - Garrison (12 lines): the same shape mirrored — two towers on top, solid 3-wide bottom row.
  - Palace (24 lines): a 5-wide, 3-tall crenellated keep with an extra tower above the center
    and a notch cut out of the bottom-middle.
  - Colony stays a single square — the sheet only prints a Colony template for tracking on an
    *opponent's* sheet (multiplayer-only), not a shape for you to draw.

  `client/src/engine/map.ts` now has a `BUILDING_SHAPES` table (offsets from the building's
  labelled cell — "F"/"M"/"S"/"G", or the Palace's centered "@" — which is also the square you
  click to place it) and a `buildingFootprint()` helper; placement, touching/overlap, and the
  Mountain-gold-cost checks all now look at every square a building would cover, not just one.
  `BuildingInstance` changed from a single `cell` to `anchor` + `cells` accordingly. The Map
  panel now previews the full shape under your cursor while placing (green if legal, red if
  not) instead of only lighting up one square. Existing games aren't affected structurally —
  this only changes how newly-placed buildings occupy the grid.
