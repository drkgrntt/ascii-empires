import { useEffect, useState } from 'react'
import type { TutorialStep } from '../../tutorial/steps'
import styles from './TutorialOverlay.module.scss'

interface Props {
  step: TutorialStep
  stepNumber: number
  totalSteps: number
  onNext: () => void
  onDismiss: () => void
}

// A no-dependency "coach mark" spotlight: a dimmed backdrop with a rectangular
// cutout (via a giant box-shadow — see TutorialOverlay.module.scss `.spotlight`) over the
// step's target element, plus a fixed callout card with the step's text. The
// callout stays in one place (bottom of the viewport) rather than following the
// target around — simpler and more robust across the app's 1-4 column responsive
// layout than a dynamically-positioned tooltip, at the cost of the two sometimes
// being visually far apart on tall/short viewports.
export function TutorialOverlay({ step, stepNumber, totalSteps, onNext, onDismiss }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!step.target) {
      setRect(null)
      return
    }

    const measure = () => {
      const el = document.querySelector(step.target!)
      setRect(el ? el.getBoundingClientRect() : null)
    }

    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    // Panels can reflow independently of resize/scroll (a pending-choice button
    // appearing, a die getting selected) — a short poll catches those cheaply
    // without wiring every component's state into this one.
    const interval = window.setInterval(measure, 400)

    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      window.clearInterval(interval)
    }
  }, [step.target])

  return (
    <div className={styles.tutorial}>
      <div className={styles.backdrop} />
      {rect && (
        <div
          className={styles.spotlight}
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      <div className={styles.callout}>
        <div className={styles.progress}>
          Step {stepNumber} / {totalSteps}
        </div>
        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.body}>{step.body}</p>
        <div className={styles.actions}>
          <button className="btn btn--small" onClick={onDismiss}>
            Skip tutorial
          </button>
          <button className="btn btn--primary btn--small" onClick={onNext}>
            {stepNumber >= totalSteps ? 'Done' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
