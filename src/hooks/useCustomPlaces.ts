import { useState, useCallback, useEffect } from 'react'
import type { CustomPlace } from '../types/custom-place'
import { safeSetItem } from '../utils/safeStorage'

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
      const parsed = stored ? (JSON.parse(stored) as unknown) : null
      return Array.isArray(parsed) ? (parsed as CustomPlace[]) : []
    } catch {
      return []
    }
  })

  const setGeoTags = useCallback((id: string, tags: { country: string | null; city: string | null }) => {
    setPlaces((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...tags, geoTried: true } : p))
      safeSetItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const markGeoTried = useCallback((id: string) => {
    setPlaces((prev) => {
      if (prev.find((p) => p.id === id)?.geoTried) return prev
      const next = prev.map((p) => (p.id === id ? { ...p, geoTried: true } : p))
      safeSetItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const addCustomPlace = useCallback(
    (data: { name: string; description: string; lat: number; lng: number; tags?: string[]; image_url?: string | null }) => {
      const newPlace: CustomPlace = {
        ...data,
        id: `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      }
      setPlaces((prev) => {
        const next = [...prev, newPlace]
        safeSetItem(KEY, JSON.stringify(next))
        return next
      })
      // Fire-and-forget: attach geo tags when the lookup completes
      void reverseGeocode(data.lng, data.lat).then((tags) => {
        if (tags.country || tags.city) setGeoTags(newPlace.id, tags)
        else markGeoTried(newPlace.id)
      })
      return newPlace
    },
    [setGeoTags, markGeoTried],
  )

  // Backfill geo tags for places saved before tags existed, skipping places
  // where a previous attempt already returned nothing (geoTried flag).
  useEffect(() => {
    if (!navigator.onLine) return
    const missing = places.filter((p) => p.country == null && p.city == null && !p.geoTried)
    for (const p of missing) {
      void reverseGeocode(p.lng, p.lat).then((tags) => {
        if (tags.country || tags.city) setGeoTags(p.id, tags)
        else markGeoTried(p.id)
      })
    }
    // Intentionally runs once on mount — not on every places change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateCustomPlace = useCallback(
    (id: string, data: { name: string; description: string; tags?: string[]; image_url?: string | null }) => {
      setPlaces((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...data } : p))
        safeSetItem(KEY, JSON.stringify(next))
        return next
      })
    },
    [],
  )

  const removeCustomPlace = useCallback((id: string) => {
    setPlaces((prev) => {
      const next = prev.filter((p) => p.id !== id)
      safeSetItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { customPlaces: places, addCustomPlace, updateCustomPlace, removeCustomPlace }
}
