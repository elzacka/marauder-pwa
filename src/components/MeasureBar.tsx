import { haversineKm, formatDistance } from '../utils/distance'
import styles from './MeasureBar.module.css'

type Props = {
  points: Array<[number, number]>
  onClear: () => void
  onClose: () => void
}

export default function MeasureBar({ points, onClear, onClose }: Props) {
  const distance =
    points.length === 2
      ? haversineKm(points[0][1], points[0][0], points[1][1], points[1][0])
      : null

  const hint =
    points.length === 0 ? 'Klikk på kartet for å velge punkt 1' :
    points.length === 1 ? 'Klikk på kartet for å velge punkt 2' :
    null

  return (
    <div className={styles.bar} role="status" aria-live="polite">
      <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 10.5L10.5 2M10.5 2H7M10.5 2V5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4.5 12.5L12.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.4"/>
      </svg>

      {distance !== null ? (
        <span className={styles.distance}>{formatDistance(distance)}</span>
      ) : (
        <span className={styles.hint}>{hint}</span>
      )}

      <div className={styles.actions}>
        {points.length > 0 && (
          <button type="button" className={styles.btnSecondary} onClick={onClear}>
            Nullstill
          </button>
        )}
        <button type="button" className={styles.btnPrimary} onClick={onClose}>
          Ferdig
        </button>
      </div>
    </div>
  )
}
