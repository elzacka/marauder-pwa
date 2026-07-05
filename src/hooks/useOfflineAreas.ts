import { useState, useCallback, useRef } from 'react'
import {
  getAreas,
  downloadArea,
  deleteArea,
  type OfflineArea,
  type LngLatBounds,
} from '../offline/OfflineAreaManager'

export type OfflineAreaStatus = 'idle' | 'downloading' | 'error'

export function useOfflineAreas() {
  const [areas, setAreas] = useState<OfflineArea[]>(getAreas)
  const [status, setStatus] = useState<OfflineAreaStatus>('idle')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const download = useCallback(async (name: string, bounds: LngLatBounds) => {
    setStatus('downloading')
    setDone(0)
    setTotal(0)
    setError(null)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await downloadArea(name, bounds, (d, t) => { setDone(d); setTotal(t) }, ctrl.signal)
      setAreas(getAreas())
      setStatus('idle')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('idle')
      } else {
        setError((err as Error).message)
        setStatus('error')
      }
    } finally {
      abortRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteArea(id)
    setAreas(getAreas())
  }, [])

  return { areas, status, done, total, error, download, cancel, remove }
}
