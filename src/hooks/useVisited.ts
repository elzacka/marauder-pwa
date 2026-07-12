import { useState, useCallback } from 'react'
import { safeSetItem } from '../utils/safeStorage'

const KEY = 'marauder-visited'

/** The Marauder pass: which POIs have been visited (stamped). localStorage,
 *  works offline — same pattern as favourites. */
export function useVisited() {
  const [visitedIds, setVisitedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      const parsed = raw ? (JSON.parse(raw) as unknown) : null
      return new Set(Array.isArray(parsed) ? (parsed as string[]) : [])
    } catch {
      return new Set()
    }
  })

  const persist = (next: Set<string>) => {
    safeSetItem(KEY, JSON.stringify([...next]))
    return next
  }

  const toggleVisited = useCallback((id: string) => {
    setVisitedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return persist(next)
    })
  }, [])

  const markVisited = useCallback((id: string) => {
    setVisitedIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return persist(next)
    })
  }, [])

  return { visitedIds, toggleVisited, markVisited }
}
