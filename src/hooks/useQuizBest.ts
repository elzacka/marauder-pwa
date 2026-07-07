import { useState, useCallback } from 'react'

const KEY = 'marauder-quiz-best'

/** Best (highest) score per quiz key, persisted in localStorage — works offline.
 *  Keys are book keys ('general', 'hp1'…'hp7') plus 'newt' for the full exam. */
export function useQuizBest() {
  const [best, setBest] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as Record<string, number>) : {}
    } catch {
      return {}
    }
  })

  const record = useCallback((key: string, score: number) => {
    setBest((prev) => {
      if ((prev[key] ?? -1) >= score) return prev
      const next = { ...prev, [key]: score }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { best, record }
}
