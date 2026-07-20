import { useEffect } from 'react'
import { Heart, Pencil, Trash2, ArrowUpRight } from 'lucide-react'
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
  onEditCustomPlace?: (id: string) => void
  /** Marauder pass: visited stamp */
  isVisited?: boolean
  onToggleVisited?: (id: string) => void
  online?: boolean
}

export default function POIDetailSheet({
  location, onClose,
  isFavourite = false, onToggleFavourite,
  isCustomPlace = false, onDeleteCustomPlace, onEditCustomPlace,
  isVisited = false, onToggleVisited,
  online = true,
}: Props) {
  const { sheetRef, size, onDragStart, onDragMove, onDragEnd, onDragCancel } = useSheetDrag(onClose)

  useEffect(() => {
    if (!location) return
    sheetRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [location, onClose, sheetRef])

  if (!location) return null

  // Non-modal sheet (Lene, 2026-07-05): no backdrop — the map stays pannable
  // while the detail sheet is open, and the selected marker stays put.
  // Close via drag-down or Escape; tapping another POI switches selection.
  return (
    <>
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${size === 'expanded' ? styles.sheetExpanded : ''} ${size === 'full' ? styles.sheetFull : ''}`}
        role="dialog"
        aria-label={location.name}
        tabIndex={-1}
      >
        <div
          className={styles.handle}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragCancel}
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
                  {location.categories.map((cat) => (
                    <Badge key={cat} category={cat} />
                  ))}
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
                <Heart size={20} strokeWidth={1.6} fill={isFavourite ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
            )}

            {/* Edit button for custom places */}
            {isCustomPlace && onEditCustomPlace && (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => onEditCustomPlace(location.id)}
                aria-label="Rediger sted"
              >
                <Pencil size={18} strokeWidth={1.6} aria-hidden="true" />
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
                <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>

          <h2 className={styles.name}>{location.name}</h2>

          {location.image_url && (
            <img
              src={location.image_url}
              alt={location.name}
              loading="lazy"
              className={styles.heroImage}
              onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
            />
          )}

          {/* Marauder pass stamp (HP places only) */}
          {!isCustomPlace && onToggleVisited && (
            <button
              type="button"
              className={`${styles.stamp} ${isVisited ? styles.stampOn : ''}`}
              onClick={() => onToggleVisited(location.id)}
              aria-pressed={isVisited}
            >
              {isVisited ? 'Besøkt' : 'Merk som besøkt'}
            </button>
          )}

          {location.description && (
            <p className={styles.description}>{location.description}</p>
          )}

          {location.opening_hours && (
            <div className={styles.openingHours}>
              <span className={styles.openingHoursTitle}>Opening hours</span>
              <p className={styles.openingHoursText}>{location.opening_hours}</p>
            </div>
          )}

          {location.fun_fact && (
            <div className={styles.funFact}>
              <span className={styles.funFactTitle}>Did you know?</span>
              <p className={styles.funFactText}>{location.fun_fact}</p>
            </div>
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
            online ? (
              <a
                href={location.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLink}
              >
                Les mer
                <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />
              </a>
            ) : (
              <span className={styles.externalLinkOffline} aria-disabled="true">
                Les mer
                <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />
                <span className={styles.offlineNote}>Krever internett</span>
              </span>
            )
          )}
        </div>
      </div>
    </>
  )
}
