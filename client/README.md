# ASCII Empires — Solo (prototype)

A single-player, browser-based prototype of *ASCII Empires* (Storm Glass Studio,
rulebook v1.1), built with React + TypeScript + SCSS. Solo mode needs no backend —
all state lives in memory for one session. (The sibling `../server/` directory is
a separate Go service for multiplayer, run independently — see its own README.)

## Running it

All commands below run from this directory (`client/`):

```bash
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a static `dist/` you can
host anywhere.

## How to play

First visit opens a guided tutorial automatically — an 18-step tour that walks
your actual Round 1 (not a staged demo), spotlighting each panel as it becomes
relevant and explaining every system: the five phases, buildings and the map,
Population/Great Person, Gold's five uses, the Science tree, Trade, Culture,
and Deployment. Skip it anytime, or reopen it later from the **? Tutorial**
button in the header — it picks up wherever your real game currently is.

Each round runs through five phases, shown in the bar at the top:

1. **Dice** — roll the five dice (3 white, 1 green, 1 black). Green/black start
   locked; they unlock as you research Philosophy / Engineering on the Science track.
2. **Diplomacy** — optionally select a die and reroll it for Gold, then proceed.
3. **Disasters** — resolved automatically: any 1s reroll (marking the Drought row
   each time first), then the five final values mark the Disaster Grid. A triggered
   Drought (without Irrigation) pauses for your choice — 2 Workers or +1 Unhappiness.
4. **Development** — select a die, then click where to spend it: add it to
   Construction, activate a staffed building, advance a Trade caravan, or fill a
   Culture cell. Taxation and Conscription are available any time.
5. **Deployment** — spend Army power to hit Barbarian camps, repel a Raid, or stop
   a Revolt from destroying a building.

The game runs a fixed 20 rounds (the official solo-mode length), then shows the
final score using the rulebook's own scoring table.

## What's exact vs. simplified

Built directly from the rulebook/sheet text:

- The five-phase round structure, the dice-unlock order (Philosophy → Green,
  Engineering → Black), and construction-line math (lines = sum of dice values
  committed, + a Great Person's +4).
- All six building types, their exact line costs, activation-die thresholds, and
  the Level I → II → III prerequisite chain.
- Gold's five spending uses (including ±1 die modification, spendable repeatedly,
  floor of 2, no ceiling — easy to miss since it's not on the building/activation
  table), Taxation, Conscription.
- Track lengths measured off the sheet, not guessed: Gold track 49 boxes (7×7),
  Military track 14 boxes (7 Armies), and Population's 35 slots split into 7
  Great-Person groups of sizes 6/6/6/5/4/4/4 (not a uniform "every 4").
- **The Science track actually branches** — a shared 4-box trunk (Irrigation)
  forking into a 16-box Philosophy branch (upper, humanities) and a 10-box
  "approach" branch (Sailing, Gold bonuses) that itself forks — once complete —
  into a 7-box Engineering branch and an 11-box Walls & Iron branch (middle/lower,
  natural sciences). Each of the 3 terminal branches ends in its own Mastery box,
  so up to 3 separate Science Masteries are achievable in one game, not just 1.
  Every School activation (and the Great Person's Science option) lets you pick
  which unlocked branch to advance. Every box is read exactly off the sheet,
  including the Gold-bonus spacing inside the 3 post-trunk branches — the initial
  pass approximated that spacing, but a closer look (per-cell darkness sampling
  across all 4 branches, including a needed sign flip for the one branch whose
  bonus boxes render as bright text on a grey background) found it exactly, along
  with a mistaken Iron position (index 7, not 6) the same pass corrected.
- Deploying an Army grants 1 point of Power, or 2 if you've researched the
  matching upgrade — Iron while attacking, Walls while defending — banked and
  spendable across multiple 1pt actions in the same Deployment phase.
- Trade caravan rewards read exactly off the sheet: 1 Happiness + 3 Gold always,
  plus Science (caravans 1–2) or Culture (caravans 3–5) marks — not a flat
  +1 Happiness/+1 Gold for every caravan.
- The Disaster Grid mechanic (1s rerolled and logged first, then final values fill
  rows 2–6) and Drought / Raid / Revolt effects. Drought is the player's real
  choice — cross off 2 Workers *or* gain 1 Unhappiness — not forced by whether you
  happen to have 2 Workers; left unresolved by round's end it falls back to that
  old forced behavior, same pattern as an unrepelled Raid/Revolt.
- A building a Revolt destroys leaves a ruin: "no new buildings may be built in the
  same space," and — like any standing building — nothing may be built touching it
  either, even after it's gone from the sheet.
- The Culture grid's four rows, read cell-by-cell from the sheet, with their real
  15/20/30/35-point row rewards, right-aligned to the sheet's 7-column grid (so the
  rightmost column is shared by every row and hardest to complete, the leftmost only
  by the two longest rows and easiest), and the exact per-column Worker/Gold/
  Science/Happiness rewards read off the sheet's two symbol rows under the grid.
- The official end-game scoring table (Farms ×2, Mines ×2, Schools ×4,
  Garrisons ×4, Colonies ×7, Palace ×36, Gold ×1, Armies ×3, Mastery ×21 each,
  Culture total, Happiness − Unhappiness).
- Solo-mode rules: fixed 20-round length, and the free Colony once all Barbarian
  camps are destroyed.

Also built from the rulebook/sheet's own MAP LEGEND:

- **A literal map**, measured directly off `docs/ASCII_Empires_Player_Sheet_Color.pdf`'s
  colored zones. A 27×23 dot-grid Empire map sized to match the scanned sheet — sea
  along the north edge, a one-column strait splitting the two coasts (straight,
  with a single jog partway down, not a winding river), a one-column Plains
  corridor hugging each side of the strait, Mountains dominating the northern
  two-thirds of the map (the corridor is the only *free* land up there — Mountains
  don't block building, they cost 1 Gold, per the sheet's "Ø to build" — Ø is the
  Gold-cost symbol, easy to misread as "forbidden"), a tinted southern "Barbarian
  territory" band that's cosmetic — fully buildable, just marked as raid-prone — 8
  Ore deposits a Mine must be built on (2 of them sit in the Mountains band itself,
  so a Mine there still costs the 1 Gold), and the 5 Barbarian camps as fixed map
  sites. Buildings occupy their real fixed-shape footprint from the sheet's
  BUILDINGS section (measured off `docs/ASCII_Empires_Player_Sheet_Color.pdf`), not
  a single plot: Farm and Mine are 8-line shapes (an L-tromino and a solid 2x2
  square), School and Garrison are 12-line shapes (mirror-image crenellations —
  an open archway vs. two towers), and the Palace is a 24-line, 5-wide crenellated
  keep. None of them can be rotated, matching the rulebook ("in the orientation
  shown on the Empire sheet"). Clicking Build (or the free Colony) enters a
  placement mode; hovering previews every plot the building would cover from that
  point, and the Map panel only allows a click where the whole shape is legal —
  unoccupied, not touching another building, on the right terrain, affordable if
  any part touches Mountains, and (for Mines) over an Ore deposit somewhere in the
  footprint. The clicked plot is always the building's labelled cell ("F"/"M"/"S"/
  "G", or the Palace's centered "@"), so it's never surprising which cell you
  anchored on. Destroying a Barbarian camp reclaims its (single) plot for the free
  Colony — the sheet only shows a Colony template for tracking on an opponent's
  sheet, not a shape to draw, so it stays one plot here too. Simplified from the
  physical game: no Colony-on-an-opponent's-board (moot in solo play, no opponent
  territory to contest).

Two places the rulebook says "your choice" without saying exactly when that
choice happens — resolved as follows:

- **Colony's special activation** ("treat one building type as if you had 2 more
  of it") is chosen right at the moment you activate the Colony — a dropdown
  next to its Activate button, resolved the instant you spend the die. There's
  no later moment for this one to happen at; activation is immediate.
- **Revolt's building loss** ("a building of your choice is destroyed") is
  chosen at the moment the Revolt actually strikes, not pre-picked earlier
  while there was still a chance to prevent it. An unresolved Revolt now
  genuinely pauses the round at End Round — Deployment's "Prevent Revolt"
  button still works as before, but if it goes unanswered, End Round prompts
  you to pick which staffed building to sacrifice (or auto-pick the
  lowest-scoring one) before the round actually advances.

Both are exact reads of the rulebook's own wording, just resolved for a detail
the rulebook itself leaves as flavor rather than a rule: exactly when "your
choice" gets made.

## Design notes

Visual direction leans into what the physical artifact already is: a paper ledger
crossed with the game's own ASCII-art rulebook. Background is a faint graph-paper
grid on aged parchment (not the cream/terracotta combo that's become an AI-design
cliché); headers use Cinzel (inscriptional capitals, nodding to antiquity) over
Open Sans body text and Courier Prime for all data — the same two fonts the real
rulebook credits, plus the display face. Tracks render as literal fillable glyph
boxes (`/`, `O`, `X`, `S`, `:)`) instead of progress bars, mirroring the physical
Empire sheet rather than looking like a generic dashboard.

The tutorial (`src/tutorial/`, `src/hooks/useTutorial.ts`,
`src/components/TutorialOverlay.tsx`) is a spotlight tour over the real,
live game rather than a scripted fake playthrough — deliberately, so it
can't drift from the actual rules engine this project spends so much effort
keeping accurate, and so it teaches the exact UI a player uses for the
remaining 19 rounds. The tradeoff is that dice are genuinely random, so step
text stays conceptual ("assign any die to Construction") rather than literal,
and steps for mechanics that may not be reachable within Round 1 (a Science
branch unlocking, a Culture column completing, Deployment) are explained
rather than gated on the player actually doing them.

## Project layout

```
src/
  engine/       state shape, static game data, and the pure reducer
  hooks/        useGame() — wires the reducer into React; useTutorial() — tour state machine
  components/   one file per UI panel, plus TutorialOverlay.tsx
  tutorial/      steps.ts — the guided tour's content
  styles/       SCSS tokens + global styles
  App.tsx       layout, dice-selection state
```
