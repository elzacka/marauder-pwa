import { useState, useEffect } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import type { HPLocation } from '../types/hp-location'
import { featureToLocation } from '../utils/featureToLocation'

type State = {
  data: FeatureCollection | null
  locations: HPLocation[] | null
  loading: boolean
  /** Human-readable load error — failures must be visible, never silent (K5) */
  error: string | null
}

export function useHPLocations(): State {
  const [state, setState] = useState<State>({ data: null, locations: null, loading: true, error: null })

  useEffect(() => {
    const ac = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/hp-locations.json`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<FeatureCollection<Point>>
      })
      .then((data) => setState({
        data,
        locations: data.features.map(featureToLocation),
        loading: false,
        error: null,
      }))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== 'AbortError') {
          setState({
            data: null,
            locations: null,
            loading: false,
            error: 'Kunne ikke laste Harry Potter-stedene. Sjekk tilkoblingen og last siden på nytt.',
          })
        }
      })
    return () => ac.abort()
  }, [])

  return state
}
