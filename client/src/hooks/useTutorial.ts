import { useCallback, useEffect, useState } from 'react'
import type { GameState } from '../engine/types'
import { TUTORIAL_STEPS } from '../tutorial/steps'

const DISMISSED_KEY = 'ascii-empires-tutorial-dismissed'

// localStorage can throw (private browsing, storage disabled) or simply not
// persist between visits — either way, fail open into "show the tutorial" rather
// than let a storage quirk crash the app.
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // ignore — nothing to fall back to; worst case it re-shows next visit
  }
}

// Drives the guided tour: which step is current, and auto-advancing a step once
// its `waitFor` condition is true of the real, live GameState (see tutorial/steps.ts
// for why this walks the actual game instead of a scripted one).
export function useTutorial(state: GameState) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // Auto-start once per browser, on first mount only.
  useEffect(() => {
    if (!readDismissed()) {
      setActive(true)
      setStepIndex(0)
    }
  }, [])

  const dismiss = useCallback(() => {
    setActive(false)
    writeDismissed()
  }, [])

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= TUTORIAL_STEPS.length) {
        writeDismissed()
        setActive(false)
        return i
      }
      return i + 1
    })
  }, [])

  const start = useCallback(() => {
    setStepIndex(0)
    setActive(true)
  }, [])

  // Auto-advance whenever the current step's real-game condition is satisfied.
  useEffect(() => {
    if (!active) return
    const current = TUTORIAL_STEPS[stepIndex]
    if (current?.waitFor?.(state)) next()
  }, [state, active, stepIndex, next])

  return {
    active,
    step: active ? TUTORIAL_STEPS[stepIndex] : null,
    stepNumber: stepIndex + 1,
    totalSteps: TUTORIAL_STEPS.length,
    start,
    next,
    dismiss,
  }
}
