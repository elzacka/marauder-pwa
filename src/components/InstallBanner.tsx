import { useState, useEffect } from 'react'
import { Share, X } from 'lucide-react'
import marauderIcon from '../assets/marauder-icon.png'
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
    <div className={styles.card} role="status">
      <img className={styles.icon} src={marauderIcon} alt="" draggable={false} />
      <div className={styles.body}>
        <p className={styles.title}>Installer Marauder</p>
        <p className={styles.hint}>
          Trykk <Share className={styles.share} size={14} strokeWidth={2} aria-label="Del" /> og velg «Legg til på Hjem-skjerm»
        </p>
      </div>
      <button className={styles.dismiss} onClick={dismiss} type="button" aria-label="Lukk">
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
