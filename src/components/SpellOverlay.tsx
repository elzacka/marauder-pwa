import { useEffect, useState } from 'react'
import styles from './SpellOverlay.module.css'

/**
 * Short spell/ritual messages over the map ("I solemnly swear…",
 * "Mischief managed", place discoveries). One message at a time,
 * fades in and out on its own.
 */
export default function SpellOverlay({ message, onDone }: {
  message: string | null
  onDone: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const hide = setTimeout(() => setVisible(false), 2200)
    const done = setTimeout(onDone, 2800)
    return () => { clearTimeout(hide); clearTimeout(done) }
  }, [message, onDone])

  if (!message) return null

  return (
    <div className={`${styles.overlay} ${visible ? styles.visible : ''}`} role="status" aria-live="polite">
      <span className={styles.text}>{message}</span>
    </div>
  )
}
