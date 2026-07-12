import { useState, useCallback, useRef, useEffect } from 'react'
import {
  getAreas,
  downloadArea,
  deleteArea,
  areaHasTiles,
  renameArea,
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

  // On startup, sample a few cached tile URLs per stored area. If tiles are
  // gone (iOS storage pressure eviction), mark the area incomplete so the UI
  // can tell the user to re-download.
  useEffect(() => {
    if (areas.length === 0) return
    void (async () => {
      const checked = await Promise.all(
        areas.map(async (area) => {
          if (area.incomplete) return area
          const ok = await areaHasTiles(area)
          return ok ? area : { ...area, incomplete: true }
        }),
      )
      if (checked.some((a, i) => a.incomplete !== areas[i].incomplete)) {
        setAreas(checked)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const download = useCallback(async (name: string, bounds: LngLatBounds): Promise<string | null> => {
    setStatus('downloading')
    setDone(0)
    setTotal(0)
    setError(null)
    const ctrl = new AbortController()
    abortRef.current = ctrl

    // Throttle progress updates to ~200 ms to avoid per-tile React re-renders
    let lastFlush = 0
    let pendingDone = 0
    let pendingTotal = 0
    const onProgress = (d: number, t: number) => {
      pendingDone = d
      pendingTotal = t
      const now = Date.now()
      if (now - lastFlush >= 200) {
        lastFlush = now
        setDone(d)
        setTotal(t)
      }
    }

    try {
      const area = await downloadArea(name, bounds, onProgress, ctrl.signal)
      setDone(pendingDone)
      setTotal(pendingTotal)
      setAreas(getAreas())
      setStatus('idle')
      return area.id
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('idle')
      } else {
        setError((err as Error).message)
        setStatus('error')
      }
      return null
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

  const rename = useCallback((id: string, name: string) => {
    renameArea(id, name)
    setAreas(getAreas())
  }, [])

  return { areas, status, done, total, error, download, cancel, remove, rename }
}
