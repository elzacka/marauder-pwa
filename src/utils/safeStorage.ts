/** localStorage.setItem wrapper that swallows QuotaExceededError and similar
 *  storage exceptions — a throw inside a React state updater causes a white screen. */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage quota exceeded or unavailable (e.g. Safari private mode)
  }
}
