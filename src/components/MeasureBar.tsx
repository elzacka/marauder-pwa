import { Ruler } from 'lucide-react'
import { haversineKm, formatDistance } from '../utils/distance'
import styles from './MeasureBar.module.css'

type Props = {
  points: Array<[number, number]>
  onClear: () => void
  onUndo: () => void
  onClose: () => void
}

export default function MeasureBar({ points, onClear, onUndo, onClose }: Props) {
  const totalDistance = points.length >= 2
    ? points.slice(1).reduce((sum, pt, i) =>
        sum + haversineKm(points[i][1], points[i][0], pt[1], pt[0]), 0)
    : null

  const hint =
    points.length === 0 ? 'Klikk på kartet for å starte' :
    points.length === 1 ? 'Klikk for å legge til neste punkt' :
    null

  return (
    <div className={styles.bar} role="status" aria-live="polite">
      <Ruler className={styles.icon} size={16} strokeWidth={1.5} aria-hidden="true" />

      {totalDistance !== null ? (
        <span className={styles.distance}>{formatDistance(totalDistance)}</span>
      ) : (
        <span className={styles.hint}>{hint}</span>
      )}

      <div className={styles.actions}>
        {points.length > 0 && (
          <button type="button" className={styles.btnSecondary} onClick={onUndo} aria-label="Angre siste punkt">
            Angre
          </button>
        )}
        {points.length > 1 && (
          <button type="button" className={styles.btnSecondary} onClick={onClear} aria-label="Nullstill alle punkter">
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
