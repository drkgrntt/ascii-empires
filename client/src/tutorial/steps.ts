// Content for the guided tutorial (see useTutorial.ts for the state machine,
// TutorialOverlay.tsx for rendering). Walks a first-time player through their own
// real Round 1 rather than a scripted fake game — see README "Design notes" for
// why. `target` is a CSS selector to spotlight; `null` centers the callout
// instead. `waitFor` lets a step auto-advance once the real game state says the
// player did the thing (e.g. actually rolled the dice); steps without it only
// advance on Next, since many comprehensive-scope topics (a Science branch
// unlocking, a Culture column completing, Deployment) aren't reachable within a
// single Round 1 and are explained rather than performed.
import type { GameState, Phase } from '../engine/types'

export interface TutorialStep {
  id: string
  target: string | null
  title: string
  body: string
  waitFor?: (state: GameState) => boolean
}

// Round-phase order, for "has the player progressed past phase X yet" checks.
// A naive `state.phase !== 'diplomacy'` is trivially true before the player ever
// reaches Diplomacy too (e.g. they skipped the Dice step via Next without
// rolling) — that would auto-advance a later step the instant it mounts, before
// the player could ever read it. Comparing indices instead means a step's
// waitFor is only satisfied once genuinely past it, not just "not there right now".
const PHASE_ORDER: Phase[] = ['dice', 'diplomacy', 'disasters', 'development', 'deployment', 'gameover']
function isPast(state: GameState, phase: Phase): boolean {
  return PHASE_ORDER.indexOf(state.phase) > PHASE_ORDER.indexOf(phase)
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to ASCII Empires',
    body: "This is a solo prototype of Storm Glass Studio's roll-and-write board game — you'll lead an Empire through 20 rounds of dice, building, and diplomacy. This tour walks through everything using your actual first round, not a staged demo. It's long — Skip tutorial works at any point, and you can reopen it later from the ? button in the header.",
  },
  {
    id: 'header',
    target: '[data-tutorial="header"]',
    title: 'Your Empire, 20 rounds',
    body: 'The round counter tracks where you are in the game. Solo play runs a fixed 20 rounds, then the game scores itself automatically — no fixed end otherwise, so there\'s no rush on any single round.',
  },
  {
    id: 'phase-bar',
    target: '[data-tutorial="phase-bar"]',
    title: 'Five phases per round',
    body: 'Every round moves through Dice → Diplomacy → Disasters → Development → Deployment, always in this order. The highlighted phase is where you are now; the button on the right always drives the current phase forward.',
  },
  {
    id: 'roll-dice',
    target: '[data-tutorial="phase-bar"]',
    title: 'Phase 1: Dice',
    body: 'Click "Roll the five dice" to start the round. You always roll 3 white dice; green and black are locked until you research Philosophy and Engineering on the Science track — they still get rolled (for Disasters), you just can\'t spend them yet.',
    waitFor: (s) => isPast(s, 'dice'),
  },
  {
    id: 'dice-tray',
    target: '[data-tutorial="dice-tray"]',
    title: 'Reading the dice',
    body: "Here's your roll. Locked dice (dimmed) still count for Disasters below, but can't be spent until unlocked. Later, in Development, you'll click a die here to select it before spending it.",
  },
  {
    id: 'diplomacy',
    target: '[data-tutorial="phase-bar"]',
    title: 'Phase 2: Diplomacy',
    body: 'You may reroll a selected die for 1 Gold (the solo-mode cost — normally it\'s Gold equal to the number of players). Purely optional: click "Proceed to Disasters" whenever you\'re ready, rerolled or not.',
    waitFor: (s) => isPast(s, 'diplomacy'),
  },
  {
    id: 'disasters',
    target: '[data-tutorial="disasters"]',
    title: 'Phase 3: Disasters (automatic)',
    body: "This resolves itself — any 1s reroll (marking the Drought row each time first), then all five final values mark this grid. Filling a row's third box triggers that disaster: Drought (lose 2 Workers or gain Unhappiness — your choice), Barbarian Raid (defend with an Army or take losses), and Revolt (only if Unhappiness exceeds Happiness). You'll see any pending choice appear right here or in Deployment.",
  },
  {
    id: 'development-intro',
    target: '[data-tutorial="phase-bar"]',
    title: 'Phase 4: Development',
    body: "The heart of the game. Select a die above, then spend it on exactly one of: Construction, activating a staffed building, advancing a Trade caravan, or filling a Culture cell. Each die can only be spent once per round, but you can spend dice in any order, and Taxation/Conscription (below, in the sidebar) are available anytime regardless of phase.",
  },
  {
    id: 'buildings',
    target: '[data-tutorial="buildings"]',
    title: 'Buildings & Construction',
    body: "Assign dice to Construction to bank lines (the sum of the dice values you commit); spend enough lines to Build a building outright. There are 6 types in 3 levels — Level II needs a staffed Farm and Mine first, Level III needs a staffed School and Garrison. Once built, a staffed building can be Activated with a single die at or above its threshold shown in the table.",
  },
  {
    id: 'map',
    target: '[data-tutorial="map"]',
    title: 'Placing a building',
    body: "Clicking Build enters placement mode — legal plots light up on the map. Water blocks building outright; Mountains (the salmon-tinted southern band) cost 1 Gold rather than blocking you; Mines must be built on an Ore deposit (the gold stars); and no building may touch another, even diagonally.",
  },
  {
    id: 'empire-tracks',
    target: '[data-tutorial="empire-tracks"]',
    title: 'Your Empire at a glance',
    body: "Population, Gold, Military, Science, and Happiness/Unhappiness all live here, rendered as literal fillable boxes like the physical Empire sheet. Farms add Workers to Population; filling one of its 7 groups (sizes 6/6/6/5/4/4/4) produces a Great Person token, spendable later on +4 construction lines, +2 Science, or a free Culture mark.",
  },
  {
    id: 'gold',
    target: '[data-tutorial="empire-tracks"]',
    title: 'Gold has five uses',
    body: 'Mines produce it, and it spends on: rerolling in Diplomacy, hiring a Worker, marking a Science/Culture/Military box (3 Gold), gaining Happiness (5 Gold), or — easy to miss — nudging any one die ±1 for 1 Gold each time, using the +1/-1 buttons that appear next to a selected die.',
  },
  {
    id: 'science',
    target: '[data-tutorial="science-group"]',
    title: 'Science actually branches',
    body: "This isn't a single track — a 4-box trunk (researching Irrigation at the end) forks into a Philosophy branch (unlocks the Green die) and an Engineering-approach branch, which itself forks again into Engineering (Black die) and Walls & Iron (military bonuses). Each School activation lets you choose which unlocked branch to advance.",
  },
  {
    id: 'trade',
    target: '[data-tutorial="trade"]',
    title: 'Trade caravans',
    body: "Assign a die directly here instead of Construction — no building required. Each caravan's boxes fill left to right with a high-enough die; completing one pays Happiness, Gold, and Science or Culture, read straight off the sheet.",
  },
  {
    id: 'culture',
    target: '[data-tutorial="culture"]',
    title: 'The Culture grid',
    body: 'Cells here may be marked in any order (unlike Trade). Completing a full row scores points at game end; completing a column — shared across every row that reaches it — pays an immediate one-time reward.',
  },
  {
    id: 'anytime',
    target: '[data-tutorial="anytime"]',
    title: 'Taxation & Conscription',
    body: "These work in any phase, no building required: Taxation trades 1 Unhappiness for 2 Gold; Conscription trades 1 Unhappiness for converting up to 2 Workers into Soldiers (filling Military boxes — every 2 boxes makes an Army).",
  },
  {
    id: 'deployment',
    target: '[data-tutorial="deployment"]',
    title: 'Phase 5: Deployment',
    body: "Spend Army Power here: destroy a Barbarian camp for Gold, repel a pending Raid, or defend a pending Revolt. Deploying an Army grants 1 Power, or 2 if you've researched Iron (attacking) or Walls (defending) — that Power can cover multiple actions in the same phase. An unresolved Revolt pauses End Round to ask which building to sacrifice, right when it actually happens.",
  },
  {
    id: 'wrap-up',
    target: null,
    title: "You've got the loop",
    body: "That's the whole game — everything else is depth, not new rules. Mastery bonuses (21 points each) come from filling any track completely; final scoring adds up your buildings, Gold, Armies, Culture, and Happiness minus Unhappiness. 19 rounds to go — good luck. Replay this any time from the ? button.",
  },
]
