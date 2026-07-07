import { useEffect, useState } from 'react'
import styles from './OathSplash.module.css'
import splashImg from '../assets/splash-oath.png'

/**
 * Launch splash — the hand-drawn Marauder's oath, shown once per app launch
 * as a full-bleed image over a matching parchment field. Fades in, holds,
 * fades out; tap to skip. The artwork is authored at iPhone portrait ratio.
 */
export default function OathSplash({ open, onDone }: {
  open: boolean
  onDone: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!open) return
    const show = requestAnimationFrame(() => setVisible(true))
    const hide = setTimeout(() => setVisible(false), 3200)
    const done = setTimeout(onDone, 3900)
    return () => {
      cancelAnimationFrame(show)
      clearTimeout(hide)
      clearTimeout(done)
    }
  }, [open, onDone])

  if (!open) return null

  const dismiss = () => {
    setVisible(false)
    setTimeout(onDone, 500)
  }

  return (
    <div
      className={`${styles.splash} ${visible ? styles.visible : ''}`}
      role="dialog"
      aria-label="I solemnly swear that I am up to no good"
      onClick={dismiss}
    >
      <img className={styles.image} src={splashImg} alt="" draggable={false} />
    </div>
  )
}
