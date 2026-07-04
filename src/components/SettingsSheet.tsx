import type { OfflineStatus } from '../hooks/useOfflineTiles'
import { formatBytes } from '../offline/OfflineMapManager'
import { useSheetDrag } from '../hooks/useSheetDrag'
import styles from './SettingsSheet.module.css'

type Props = {
  open: boolean
  onClose: () => void
  showZoomControls: boolean
  onToggleZoomControls: (v: boolean) => void
  pmtilesEnabled: boolean
  offlineStatus: OfflineStatus
  downloaded: number
  total: number
  offlineError: string | null
  onDownload: () => void
  onCancel: () => void
  onDelete: () => void
  online: boolean
}

const OFFLINE_STATUS_LABEL: Record<OfflineStatus, string> = {
  none:        'Ikke lastet ned',
  checking:    'Sjekker…',
  downloading: 'Laster ned',
  ready:       'Kart lagret',
  error:       'Nedlastingsfeil',
}

function connectionType(): string {
  const conn = (navigator as unknown as { connection?: { type?: string; effectiveType?: string } }).connection
  if (!conn) return 'Ukjent'
  if (conn.type === 'wifi') return 'WiFi'
  if (conn.type === 'cellular') return `Mobil (${conn.effectiveType ?? ''})`
  if (conn.effectiveType) return conn.effectiveType.toUpperCase()
  return 'Ukjent'
}

export default function SettingsSheet({
  open, onClose,
  showZoomControls, onToggleZoomControls,
  pmtilesEnabled, offlineStatus, downloaded, total, offlineError,
  onDownload, onCancel, onDelete,
  online,
}: Props) {
  const { sheetRef, onDragStart, onDragMove, onDragEnd } = useSheetDrag(onClose)

  const progress = total > 0 ? downloaded / total : 0

  if (!open) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} role="presentation" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Innstillinger"
      >
        <div
          className={styles.dragZone}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          role="presentation"
        >
          <div className={styles.dragBar} aria-hidden="true" />
        </div>

        <div className={styles.scrollArea}>
          <h2 className={styles.title}>Innstillinger</h2>

          {/* ── Kart ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Kart</h3>
            <div className={styles.card}>
              <ToggleRow
                label="Zoom-knapper"
                description="Vis +/− på kartet"
                checked={showZoomControls}
                onChange={onToggleZoomControls}
              />
            </div>
          </section>

          {/* ── Tilkobling ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Tilkobling</h3>
            <div className={styles.card}>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Nettverk</span>
                <span className={`${styles.statusChip} ${online ? styles.chipOnline : styles.chipOffline}`}>
                  <span className={styles.chipDot} />
                  {online ? 'Online' : 'Offline'}
                </span>
              </div>
              {online && (
                <div className={`${styles.statusRow} ${styles.statusRowBorder}`}>
                  <span className={styles.statusLabel}>Type</span>
                  <span className={styles.infoValue}>{connectionType()}</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Offline kart ── */}
          {pmtilesEnabled && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Offline kart</h3>
              <div className={styles.card}>
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Storbritannia + Irland</span>
                  <span className={`${styles.statusChip} ${
                    offlineStatus === 'ready'       ? styles.chipReady :
                    offlineStatus === 'downloading' ? styles.chipDownloading :
                    offlineStatus === 'error'       ? styles.chipError : styles.chipNone
                  }`}>
                    <span className={styles.chipDot} />
                    {OFFLINE_STATUS_LABEL[offlineStatus]}
                  </span>
                </div>

                {offlineStatus === 'downloading' && (
                  <div className={styles.progressWrap}>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                    <span className={styles.progressLabel}>
                      {total > 0
                        ? `${formatBytes(downloaded)} av ${formatBytes(total)}`
                        : `${formatBytes(downloaded)} lastet ned`}
                    </span>
                  </div>
                )}

                {offlineError && offlineStatus === 'error' && (
                  <p className={styles.errorText}>{offlineError}</p>
                )}

                <div className={styles.actionRow}>
                  {offlineStatus === 'none' && (
                    <button className={styles.btnPrimary} type="button" onClick={onDownload}>
                      Last ned kart
                    </button>
                  )}
                  {offlineStatus === 'error' && (
                    <button className={styles.btnPrimary} type="button" onClick={onDownload}>
                      Prøv igjen
                    </button>
                  )}
                  {offlineStatus === 'downloading' && (
                    <button className={styles.btnSecondary} type="button" onClick={onCancel}>
                      Avbryt nedlasting
                    </button>
                  )}
                  {offlineStatus === 'ready' && (
                    <button className={styles.btnDanger} type="button" onClick={onDelete}>
                      Slett lagret kart
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Om ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Om Marauder</h3>
            <div className={styles.card}>
              <div className={styles.infoRow}>
                <span className={styles.statusLabel}>App</span>
                <span className={styles.infoValue}>Marauder</span>
              </div>
              <div className={`${styles.infoRow} ${styles.infoRowBorder}`}>
                <span className={styles.statusLabel}>Versjon</span>
                <span className={styles.infoValue}>1.0.0</span>
              </div>
              <p className={styles.omText}>
                En reiseguide for Harry Potter-steder i Storbritannia.
              </p>
            </div>
          </section>

          {/* ── Datakilder ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Datakilder</h3>
            <div className={styles.card}>
              <p className={styles.omText}>
                Kartdata © OpenStreetMap-bidragsytere (ODbL). Kartvisning: Protomaps. Adressesøk: Nominatim / OSM.{' '}
                <a
                  href="https://github.com/elzacka/marauder-pwa#datakilder"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.omLink}
                >
                  Full oversikt
                </a>
              </p>
            </div>
          </section>

          {/* ── Personvern ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Personvern</h3>
            <div className={styles.card}>
              <p className={styles.omText}>
                Appen samler ikke inn persondata. Posisjon, favoritter og egne steder lagres kun lokalt på enheten. Adressesøk sendes til Nominatim (OSM).{' '}
                <a
                  href="https://github.com/elzacka/marauder-pwa/blob/main/PERSONVERN.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.omLink}
                >
                  Les personvernerklæringen
                </a>
              </p>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleLabels}>
        <span className={styles.toggleLabel}>{label}</span>
        <span className={styles.toggleDesc}>{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        onClick={() => onChange(!checked)}
        aria-label={label}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  )
}
