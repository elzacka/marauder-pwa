import { useState, useCallback } from 'react'
import type { CustomPlace } from '../types/custom-place'

const KEY = 'marauder-custom-places'

export function useCustomPlaces() {
  const [places, setPlaces] = useState<CustomPlace[]>(() => {
    try {
      const stored = localStorage.getItem(KEY)
      return stored ? (JSON.parse(stored) as CustomPlace[]) : []
    } catch {
      return []
    }
  })

  const addCustomPlace = useCallback(
    (data: { name: string; description: string; lat: number; lng: number }) => {
      const newPlace: CustomPlace = {
        ...data,
        id: `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      }
      setPlaces((prev) => {
        const next = [...prev, newPlace]
        localStorage.setItem(KEY, JSON.stringify(next))
        return next
      })
      return newPlace
    },
    [],
  )

  const removeCustomPlace = useCallback((id: string) => {
    setPlaces((prev) => {
      const next = prev.filter((p) => p.id !== id)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { customPlaces: places, addCustomPlace, removeCustomPlace }
}
