import { useEffect } from 'react'
import { Badge } from '../ds/Badge'
import { formatHpRef } from '../types/hp-location'
import type { HPLocation } from '../types/hp-location'
import { useSheetDrag } from '../hooks/useSheetDrag'
import styles from './POIDetailSheet.module.css'

type Props = {
  location: HPLocation | null
  onClose: () => void
  isFavourite?: boolean
  onToggleFavourite?: (id: string) => void
  isCustomPlace?: boolean
  onDeleteCustomPlace?: (id: string) => void
}

export default function POIDetailSheet({
  location, onClose,
  isFavourite = false, onToggleFavourite,
  isCustomPlace = false, onDeleteCustomPlace,
}: Props) {
  const { sheetRef, onDragStart, onDragMove, onDragEnd } = useSheetDrag(onClose)

  useEffect(() => {
    if (!location) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [location, onClose])

  if (!location) return null

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={location.name}
      >
        <div
          className={styles.handle}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          role="presentation"
        >
          <div className={styles.dragBar} aria-hidden="true" />
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.topRow}>
            <div className={styles.badges}>
              {!isCustomPlace && (
                <>
                  <Badge type={location.location_type} />
                  <Badge category={location.category} />
                </>
              )}
              {isCustomPlace && (
                <span className={styles.customBadge}>Eget sted</span>
              )}
            </div>

            {/* Favourite button (only for HP locations) */}
            {!isCustomPlace && onToggleFavourite && (
              <button
                type="button"
                className={`${styles.favBtn} ${isFavourite ? styles.favBtnActive : ''}`}
                onClick={() => onToggleFavourite(location.id)}
                aria-label={isFavourite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                aria-pressed={isFavourite}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M10 16.5L4 10.7A4 4 0 0 1 4 4.8a4 4 0 0 1 5.6 0L10 5.4l.4-.6a4 4 0 0 1 5.6 0 4 4 0 0 1 0 5.9L10 16.5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    fill={isFavourite ? 'currentColor' : 'none'}
                  />
                </svg>
              </button>
            )}

            {/* Delete button for custom places */}
            {isCustomPlace && onDeleteCustomPlace && (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => { onDeleteCustomPlace(location.id); onClose() }}
                aria-label="Slett sted"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M3 5h12M7 5V3.5h4V5M6 5v9.5h6V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>

          <h2 className={styles.name}>{location.name}</h2>

          {location.description && (
            <p className={styles.description}>{location.description}</p>
          )}

          {location.hp_references.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Bøker</h3>
              <div className={styles.refList}>
                {location.hp_references.map((ref) => (
                  <span key={ref} className={styles.refPill}>{formatHpRef(ref)}</span>
                ))}
              </div>
            </div>
          )}

          {location.external_url && (
            <a
              href={location.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.externalLink}
            >
              Les mer
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 9.5L9.5 2.5M9.5 2.5H5M9.5 2.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
