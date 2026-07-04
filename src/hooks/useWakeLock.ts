import { useEffect } from 'react'

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock.request('screen').then((l) => { lock = l }).catch(() => {})
    return () => { lock?.release().catch(() => {}) }
  }, [active])
}
