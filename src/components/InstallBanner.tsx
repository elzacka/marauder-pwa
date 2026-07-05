import { useState, useEffect } from 'react'
import styles from './InstallBanner.module.css'

const STORAGE_KEY = 'install-banner-dismissed'

function isIOSSafariWithoutPWA(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isStandalone =
    'standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true
  return isIOS && !isStandalone
}

export default function InstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isIOSSafariWithoutPWA() && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        Installer som app: Trykk på ..., Del
        og velg <strong>«Legg til på Hjem-skjerm»</strong>
      </span>
      <button className={styles.dismiss} onClick={dismiss} type="button" aria-label="Lukk banner">
        ×
      </button>
    </div>
  )
}
