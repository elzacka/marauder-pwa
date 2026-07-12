import { useState, useCallback } from 'react'
import { safeSetItem } from '../utils/safeStorage'

const KEY = 'marauder-favourites'

export function useFavourites() {
  const [ids, setIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(KEY)
      const parsed = stored ? (JSON.parse(stored) as unknown) : null
      return new Set(Array.isArray(parsed) ? (parsed as string[]) : [])
    } catch {
      return new Set()
    }
  })

  const toggleFavourite = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      safeSetItem(KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  return { favouriteIds: ids, toggleFavourite }
}
