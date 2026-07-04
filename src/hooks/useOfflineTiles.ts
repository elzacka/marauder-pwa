import { useState, useCallback, useRef, useEffect } from 'react'
import {
  hasOfflineTiles,
  downloadToOPFS,
  deleteOfflineTiles,
} from '../offline/OfflineMapManager'

export type OfflineStatus = 'checking' | 'none' | 'downloading' | 'ready' | 'error'

export function useOfflineTiles(downloadUrl: string) {
  const [status, setStatus] = useState<OfflineStatus>('checking')
  const [downloaded, setDownloaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    hasOfflineTiles()
      .then((has) => setStatus(has ? 'ready' : 'none'))
      .catch(() => setStatus('none'))
  }, [])

  const download = useCallback(async () => {
    setStatus('downloading')
    setDownloaded(0)
    setTotal(0)
    setError(null)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await downloadToOPFS(
        downloadUrl,
        (dl, tot) => {
          setDownloaded(dl)
          setTotal(tot)
        },
        ctrl.signal,
      )
      setStatus('ready')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('none')
      } else {
        setError((err as Error).message)
        setStatus('error')
      }
    } finally {
      abortRef.current = null
    }
  }, [downloadUrl])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const remove = useCallback(async () => {
    try {
      await deleteOfflineTiles()
      setStatus('none')
      setDownloaded(0)
      setTotal(0)
    } catch {
      // ignore
    }
  }, [])

  return { status, downloaded, total, error, download, cancel, remove }
}
