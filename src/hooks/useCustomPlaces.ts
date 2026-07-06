import { useState, useCallback, useEffect } from 'react'
import type { CustomPlace } from '../types/custom-place'

const KEY = 'marauder-custom-places'

/** Reverse-geocode a point to geo tags (Photon, English names). Uses the
 *  GB nation (Scotland/England/Wales) as "country", matching the HP data. */
async function reverseGeocode(lng: number, lat: number): Promise<{ country: string | null; city: string | null }> {
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=en`)
    if (!r.ok) return { country: null, city: null }
    const d = (await r.json()) as { features?: Array<{ properties?: Record<string, string> }> }
    const p = d.features?.[0]?.properties ?? {}
    const country = p.country === 'United Kingdom' ? (p.state ?? 'United Kingdom') : (p.country ?? null)
    const city = p.city ?? p.town ?? p.village ?? p.county ?? null
    return { country, city }
  } catch {
    return { country: null, city: null }
  }
}

export function useCustomPlaces() {
  const [places, setPlaces] = useState<CustomPlace[]>(() => {
    try {
      const stored = localStorage.getItem(KEY)
      return stored ? (JSON.parse(stored) as CustomPlace[]) : []
    } catch {
      return []
    }
  })

  const setGeoTags = useCallback((id: string, tags: { country: string | null; city: string | null }) => {
    setPlaces((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...tags } : p))
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const addCustomPlace = useCallback(
    (data: { name: string; description: string; lat: number; lng: number; tags?: string[] }) => {
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
      // Fire-and-forget: attach geo tags when the lookup completes
      void reverseGeocode(data.lng, data.lat).then((tags) => {
        if (tags.country || tags.city) setGeoTags(newPlace.id, tags)
      })
      return newPlace
    },
    [setGeoTags],
  )

  // Backfill geo tags for places saved before tags existed (one attempt per load)
  useEffect(() => {
    if (!navigator.onLine) return
    const missing = places.filter((p) => p.country == null && p.city == null)
    for (const p of missing) {
      void reverseGeocode(p.lng, p.lat).then((tags) => {
        if (tags.country || tags.city) setGeoTags(p.id, tags)
      })
    }
    // Intentionally runs once on mount — not on every places change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateCustomPlace = useCallback(
    (id: string, data: { name: string; description: string; tags?: string[] }) => {
      setPlaces((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...data } : p))
        localStorage.setItem(KEY, JSON.stringify(next))
        return next
      })
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

  return { customPlaces: places, addCustomPlace, updateCustomPlace, removeCustomPlace }
}
