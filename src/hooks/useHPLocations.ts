import { useState, useEffect } from 'react'
import type { FeatureCollection } from 'geojson'

type State = {
  data: FeatureCollection | null
  loading: boolean
}

export function useHPLocations(): State {
  const [state, setState] = useState<State>({ data: null, loading: true })

  useEffect(() => {
    const ac = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/hp-locations.json`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<FeatureCollection>
      })
      .then((data) => setState({ data, loading: false }))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== 'AbortError') setState({ data: null, loading: false })
      })
    return () => ac.abort()
  }, [])

  return state
}
