import styles from './GeocodeCard.module.css'

type Props = {
  name: string
  detail: string
  onSave: () => void
  onRemove: () => void
  onClose: () => void
}

/**
 * Result card for the geocode (address search) pin. The pin drops alone on
 * selection; this card opens when the user taps the pin (Lene, 2026-07-05).
 * X closes only the card — the pin stays. "Fjern nål" removes both.
 * No auto-timeout (Google/Apple Maps pattern).
 */
export default function GeocodeCard({ name, detail, onSave, onRemove, onClose }: Props) {
  return (
    <div className={styles.card} role="status">
      <div className={styles.text}>
        <span className={styles.name}>{name}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
      </div>
      <button type="button" className={styles.saveBtn} onClick={onSave}>
        Lagre sted
      </button>
      <button type="button" className={styles.removeBtn} onClick={onRemove}>
        Fjern nål
      </button>
      <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Lukk kortet">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
