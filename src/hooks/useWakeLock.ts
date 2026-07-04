import { useEffect } from 'react'

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let released = false
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock.request('screen').then((l) => {
      if (released) l.release().catch(() => {})
      else lock = l
    }).catch(() => {})
    return () => {
      released = true
      lock?.release().catch(() => {})
    }
  }, [active])
}
