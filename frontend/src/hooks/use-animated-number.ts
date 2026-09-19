import { useEffect, useRef, useState } from "react"

/**
 * Tweens a displayed number toward `value` over `durationMs` instead of
 * snapping — Design System > Motion: "Counters... animate the number change,
 * don't just snap." Used by any number that updates on the 5s poll.
 */
export function useAnimatedNumber(value: number, durationMs = 400): number {
  const [displayed, setDisplayed] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return

    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1)
      const eased = 1 - (1 - progress) * (1 - progress)
      setDisplayed(from + (value - from) * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, durationMs])

  return displayed
}
