import { useState, useEffect, useRef } from 'react'

export type GeoResult = {
  id: string
  name: string
  detail: string
  lng: number
  lat: number
}

/** GB + Ireland — matches the map's world-mask area */
const BBOX = '-13.0,48.0,3.5,62.0'
const COUNTRY_CODES = new Set(['GB', 'IE', 'GG', 'JE', 'IM'])

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_id?: number
    osm_type?: string
    name?: string
    street?: string
    housenumber?: string
    city?: string
    county?: string
    state?: string
    countrycode?: string
    postcode?: string
  }
}

function toResult(f: PhotonFeature): GeoResult | null {
  const p = f.properties
  if (p.countrycode && !COUNTRY_CODES.has(p.countrycode.toUpperCase())) return null
  const [lng, lat] = f.geometry.coordinates
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const name = p.name ?? street
  if (!name) return null
  const detailParts = [
    p.name && street ? street : null,
    p.city,
    p.county ?? p.state,
  ].filter((s): s is string => !!s && s !== name)
  return {
    id: `${p.osm_type ?? 'x'}-${p.osm_id ?? `${lng},${lat}`}`,
    name,
    detail: [...new Set(detailParts)].slice(0, 2).join(', '),
    lng,
    lat,
  }
}

/**
 * Search-as-you-type geocoding via Photon (photon.komoot.io) — an open OSM
 * geocoder BUILT for incremental/fuzzy prefix search, unlike Nominatim which
 * requires near-complete queries (switched 2026-07-05: "26 King's Stab" now
 * finds King's Stables Road). Results limited to GB/IE.
 */
export function useGeocoder(query: string) {
  const [results, setResults] = useState<GeoResult[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      try {
        const url = new URL('https://photon.komoot.io/api/')
        url.searchParams.set('q', q)
        url.searchParams.set('limit', '6')
        url.searchParams.set('lang', 'en')
        url.searchParams.set('bbox', BBOX)
        const r = await fetch(url.toString(), { signal: ac.signal })
        if (!r.ok) throw new Error('geocoder error')
        const data = (await r.json()) as { features?: PhotonFeature[] }
        const mapped = (data.features ?? [])
          .map(toResult)
          .filter((x): x is GeoResult => x !== null)
        // De-duplicate identical name+detail rows (Photon may return several
        // OSM objects for the same street)
        const seen = new Set<string>()
        setResults(mapped.filter((m) => {
          const key = `${m.name}|${m.detail}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        }))
        setLoading(false)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setResults([])
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [query])

  return { results, loading }
}
