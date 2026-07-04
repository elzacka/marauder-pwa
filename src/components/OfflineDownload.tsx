import { useState } from 'react'
import type { OfflineStatus } from '../hooks/useOfflineTiles'
import { formatBytes } from '../offline/OfflineMapManager'
import styles from './OfflineDownload.module.css'

type Props = {
  status: OfflineStatus
  downloaded: number
  total: number
  error: string | null
  onDownload: () => void
  onCancel: () => void
  onDelete: () => void
}

function statusLabel(status: OfflineStatus): string {
  switch (status) {
    case 'ready':       return 'Kart lagret'
    case 'downloading': return 'Laster ned…'
    case 'error':       return 'Nedlastingsfeil'
    case 'checking':    return 'Sjekker…'
    default:            return 'Last ned kart'
  }
}

export default function OfflineDownload({
  status,
  downloaded,
  total,
  error,
  onDownload,
  onCancel,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)

  const progress = total > 0 ? downloaded / total : 0

  return (
    <div className={styles.root}>
      {/* Always-visible pill trigger */}
      <button
        className={styles.pill}
        onClick={() => setOpen(o => !o)}
        type="button"
        aria-expanded={open}
        aria-label="Offline-kart innstillinger"
      >
        <span className={styles.dot} data-status={status} />
        <span className={styles.pillLabel}>{statusLabel(status)}</span>
      </button>

      {/* Expandable panel — only when open */}
      {open && (
        <div className={styles.panel} role="region" aria-label="Offline kart">
          <div className={styles.header}>
            <span className={styles.title}>Offline kart over Storbritannia</span>
            <button
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              type="button"
              aria-label="Lukk"
            >
              ×
            </button>
          </div>

          {status === 'checking' && (
            <p className={styles.info}>Sjekker lagret kart…</p>
          )}

          {status === 'none' && (
            <>
              <p className={styles.info}>Last ned kartet for bruk uten nett på togreisen.</p>
              <button className={styles.btn} onClick={onDownload} type="button">
                Last ned
              </button>
            </>
          )}

          {status === 'downloading' && (
            <>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className={styles.info}>
                {total > 0
                  ? `${formatBytes(downloaded)} av ${formatBytes(total)}`
                  : `${formatBytes(downloaded)} lastet ned…`}
              </p>
              <button className={styles.btnSecondary} onClick={onCancel} type="button">
                Avbryt
              </button>
            </>
          )}

          {status === 'ready' && (
            <>
              <p className={styles.info}>Kartet er tilgjengelig uten nettilkobling.</p>
              <button className={styles.btnDanger} onClick={onDelete} type="button">
                Slett lagret kart
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <p className={styles.errorText}>{error}</p>
              <button className={styles.btn} onClick={onDownload} type="button">
                Prøv igjen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
