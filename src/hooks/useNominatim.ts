import { useState, useEffect, useRef } from 'react'

export type NominatimResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  class: string
  importance: number
}

export function useNominatim(query: string) {
  const [results, setResults] = useState<NominatimResult[]>([])
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
        const url = new URL('https://nominatim.openstreetmap.org/search')
        url.searchParams.set('format', 'json')
        url.searchParams.set('q', q)
        url.searchParams.set('countrycodes', 'gb,ie')
        url.searchParams.set('limit', '6')
        url.searchParams.set('addressdetails', '0')
        const r = await fetch(url.toString(), {
          signal: ac.signal,
          headers: { 'Accept-Language': 'en' },
        })
        if (!r.ok) throw new Error('nominatim error')
        setResults(await r.json() as NominatimResult[])
        setLoading(false)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setResults([])
          setLoading(false)
        }
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [query])

  return { results, loading }
}

export function formatNominatimName(r: NominatimResult): { name: string; detail: string } {
  const parts = r.display_name.split(', ')
  return {
    name: parts[0],
    detail: parts.slice(1, 3).join(', '),
  }
}
