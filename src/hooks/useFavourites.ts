import { useState, useCallback } from 'react'

const KEY = 'marauder-favourites'

export function useFavourites() {
  const [ids, setIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(KEY)
      return new Set(stored ? (JSON.parse(stored) as string[]) : [])
    } catch {
      return new Set()
    }
  })

  const toggleFavourite = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  return { favouriteIds: ids, toggleFavourite }
}
