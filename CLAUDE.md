# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two fully independent projects, each self-contained (own package manager, README, `.gitignore`) with nothing shared at the root:

- **`client/`** — React + TypeScript + SCSS solo prototype of the board game *ASCII Empires*. No backend needed; all state lives in memory for one browser session.
- **`server/`** — Go/Fiber/Postgres backend for networked multiplayer. Auth and lobby (room codes) are done; the rules engine is a full port of the client's engine but isn't wired into gameplay yet (no WebSocket sync loop).

Always `cd` into the relevant subdirectory before running commands — there is no root-level build/test.

Each app has its own `Dockerfile`/`docker-compose.yml` for independent deploy (`network_mode: host`, coexisting with other apps behind one shared nginx on the same box) — see `DEPLOY.md` at the repo root.

## `client/`

```bash
cd client
npm install
npm run dev         # vite dev server
npm run build       # tsc -b && vite build -> dist/
npm run preview     # preview a production build
npm run test        # vitest run — single run, CI-style
npm run test:watch  # vitest — watch mode
```

Run a single test file/case with vitest's own filtering, e.g. `npx vitest run src/engine/__tests__/reducer.test.ts` or `npx vitest run -t "some test name"`.

No lint script currently exists for the client. `tsc -b` (part of `npm run build`) is the type-check gate.

### Tests

Vitest (jsdom environment) is configured in `client/vitest.config.ts`, which merges `vite.config.ts` via `mergeConfig` so it shares the same React/plugin setup — no separate test runner config to keep in sync. `src/test/setup.ts` wires up `@testing-library/jest-dom` matchers globally.

Engine tests live under `src/engine/__tests__/`; component tests colocate in their component's own directory (e.g. `src/components/PhaseBar/PhaseBar.test.tsx`), not a shared `__tests__/` directory.
- `src/engine/__tests__/testHelpers.ts` — shared helpers (`devPhase` to fast-forward through dice-roll/diplomacy into the development phase while neutralizing random disaster fallout, mirroring the Go suite's own `devPhase()`).
- `src/engine/__tests__/initialState.test.ts` — track-length/shape invariants of `createInitialState()` (35 population slots, 3 starting workers, 49 gold track max, 14 military boxes, starting dice/phase), plus `nextId`/`cloneState` behavior.
- `src/engine/__tests__/map.test.ts` — `BUILDING_SHAPES` perimeter-vs-`lineCost` checksums, `buildingFootprint` offset math, and `canPlaceBuilding` legality across terrain/occupancy/ore/ruin cases.
- `src/engine/__tests__/reducer.test.ts` — the core phase-by-phase flow (roll → diplomacy → assign/complete building → end development → deployment → end round/scoring), Great Person usage, Drought's real choice, and the paused Revolt-sacrifice flow.
- `src/engine/__tests__/reducer.science.test.ts` — full Science-tree branch progression and branch-locked-until-prereq behavior.
- `src/components/PhaseBar/PhaseBar.test.tsx` — a component-level smoke test with `@testing-library/react`.

Since `internal/engine/` on the server side is a hand-ported mirror of this engine (see below), a new client-side reducer test that pins down a specific rule is also a good candidate to port over to `server/internal/engine/reducer_test.go`.

### Architecture

Everything is driven by a single pure reducer over one `GameState` object — there is no other source of truth:

- `src/engine/types.ts` — the entire domain model (`GameState`, dice, buildings, science tree, culture grid, disasters, etc.). Read this first when touching game logic.
- `src/engine/gameData.ts` — static rule data (building costs, science branch layout, culture/trade rewards).
- `src/engine/initialState.ts` — `createInitialState()` plus `cloneState`/`nextId` helpers.
- `src/engine/map.ts` — map/terrain, `BUILDING_SHAPES` (each building type's fixed-orientation multi-cell footprint measured off the rulebook sheet), `buildingFootprint()`, and placement-legality checks (`canPlaceBuilding`, `terrainAt`).
- `src/engine/reducer.ts` — `gameReducer(state, action) -> state`. All game rules live here as a big discriminated-union `Action` switch (`ROLL_DICE`, `ASSIGN_DIE`, `COMPLETE_BUILDING`, `END_ROUND`, etc.). This is the file to read/edit for any rules change.
- `src/hooks/useGame.ts` — thin `useReducer(gameReducer, ...)` wrapper; `src/hooks/useTutorial.ts` — the guided-tour state machine.
- `src/components/` — one directory per UI panel (`ComponentName.tsx` + `ComponentName.module.scss`, plus a colocated `ComponentName.test.tsx` where a test exists): `DiceTray`, `PhaseBar`, `EmpireTracks`, `Buildings`, `Map`, `Trade`, `Culture`, `Deployment`, `Disasters`, `AnytimeActions`, `Log`, `Scoreboard`, `TutorialOverlay`.
- `src/tutorial/steps.ts` — content for the 18-step guided tour, which runs as a spotlight over the real live game (not a scripted fake playthrough) so it can't drift from the reducer.
- `src/App.tsx` — layout and transient UI state (selected die, pending building placement) that doesn't belong in `GameState`.

The round structure is five phases in a fixed order: `dice` → `diplomacy` → `disasters` → `development` → `deployment`, then back to `dice` (or `gameover` after `maxRounds`, fixed at 20 for solo). Buildings occupy multi-cell footprints (not single tiles) per `BUILDING_SHAPES` in `map.ts`; a `BuildingInstance` stores both its `anchor` (the clicked, labelled cell) and the full `cells` list.

### Component styles

Each `ComponentName.module.scss` uses short camelCase selectors accessed as `styles.xxx` — not the file's own name repeated as a prefix (`.step`, not `.phaseBarStep`). Drop a prefix that only restates the component/file's own name; keep one where it disambiguates a real reused sub-concept living in the same file (e.g. `EmpireTracks`' inner `Track` sub-component keeps its own `track`/`trackTitle`/`trackBox` classes, distinct from the outer `.empireTracks` wrapper — collapsing those would blur two different things into one namespace). Dynamic classNames are composed with `clsx`.

Truly shared classes — `.btn`/`.btn--primary`/`.btn--small`/`.btn--warn`, `.hint`, `.panel`/`.panel__title` — live in `src/styles/_shared.scss` as plain global (non-module, kebab-case) CSS, referenced as plain string classNames (`className="panel"`), not per-component modules; CSS Modules' per-file scoping would otherwise force duplicating them into every component. A component overriding one of these locally nests it with `:global(...)`, e.g. `.dieModify { :global(.btn) { ... } }`.

Design tokens (`src/styles/_tokens.scss`) are native CSS custom properties (`var(--paper)`, `var(--ink-rgb)` for alpha-blended colors), not Sass variables — nothing needs to `@use` the tokens file to reference them.

`client/README.md` documents in detail which rules are exact reads of the rulebook (`client/docs/*.pdf`) vs. deliberately simplified/resolved — check it before assuming an engine behavior is a bug rather than an intentional rules interpretation.

## `server/`

```bash
cd server
cp .env.example .env   # fill in DB_* and an RSA keypair — see the file's comments
make docker-run         # local Postgres via docker-compose.dev.yml
make migrate            # cmd/migrate/migrate.go
make run                # or `make watch` for live reload via air (installs air on first use if missing)
make test               # go test ./... -v
go test ./internal/engine/... -run TestName -v   # run a single test
```

### Architecture

Patterns here deliberately follow this codebase author's other Go services (`mental-health-journal`, `jellyfish/server`) — comments throughout point out where a file mirrors that shape:

- **Self-registering controllers**: each controller (`internal/controllers/*.go`) calls `registerController(&XController{})` from an `init()`, implements `Init(db, app)` + `RegisterApiRoutes()`, and `routes.go` just loops `controllers.GetControllers()`. Add a new controller by following this pattern, not by hand-wiring it into `routes.go`.
- **Self-registering models**: same pattern via `internal/models/registry.go` — each model calls `registerModel(&Type{})` in its own `init()`, so `database.AutoMigrate` picks up every model via `GetModels()` with no hand-maintained list.
- **Auth**: RS256 JWT in an HTTP-only cookie (`x-token`), issued by `AuthController`, checked by `middleware.DeserializeToken` (runs on every request, sets `currentUser` local if a valid cookie is present) and `middleware.RequireAuth` (rejects if not). `GameController` routes are gated with `RequireAuth`.
- **Data model**: `Game` holds shared match state (round/phase/dice — unused until gameplay sync exists); `GamePlayer` holds one seated player's per-player state as a `jsonb` blob (`EmpireState`) rather than normalizing the ~15 nested track/grid/building shapes into their own tables — the whole point is that the Go-ported reducer can read/rewrite it wholesale.
- **`internal/engine/`** is a from-scratch Go port of `client/src/engine/`: same `GameState` shape, same `GameReducer` function, with JSON field names matching the TS types exactly (verified by `json_test.go`'s round-trip test) — this is intentional, since that JSON is both the eventual WebSocket wire format and the `GamePlayer.EmpireState` jsonb column. `reducer_test.go` mirrors scenarios manually tested against the TS engine during development, so a rules fix generally needs to land in **both** `client/src/engine/reducer.ts` and `server/internal/engine/reducer.go` to keep them in parity — check both when changing game rules.
- Still unbuilt: `gofiber/contrib/websocket` isn't a dependency yet, so there's no per-game connection hub, no `EmpireState` seeding at game start, and no opponent-targeted-action rules.

## Cross-cutting notes

- `issues.md` at the repo root is a running log the user appends bug reports/requests to and expects fixes appended back to (not replaced) under a dated `## Fixes (YYYY-MM-DD)` heading — check it for open items and existing context before starting work, and follow its established format when closing something out.
- When changing any rule/mechanic, check `client/README.md`'s "What's exact vs. simplified" section first — many behaviors that look like bugs (e.g. Drought's forced fallback, Colony's single-plot footprint, exact culture/trade reward tables) are deliberate, sheet-accurate design decisions.
