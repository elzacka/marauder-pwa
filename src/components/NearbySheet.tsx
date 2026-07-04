import { useState, useDeferredValue, useId, useEffect } from 'react'
import { BottomSheet, type SnapPoint } from '../ds/BottomSheet'
import { CategoryFilter } from '../ds/CategoryFilter'
import { type FilterState, CATEGORY_META } from '../ds/filterMeta'
import { Badge } from '../ds/Badge'
import { haversineKm, formatDistance } from '../utils/distance'
import { useNominatim, formatNominatimName } from '../hooks/useNominatim'
import hpLocationsData from '../data/hp-locations.json'
import type { FeatureCollection, Point } from 'geojson'
import type { Position } from '../hooks/useGeolocation'
import type { HPLocation, LocationType, LocationCategory } from '../types/hp-location'
import type { CustomPlace } from '../types/custom-place'
import styles from './NearbySheet.module.css'

const hpLocations = hpLocationsData as unknown as FeatureCollection<Point>

type Props = {
  position: Position | null
  active: boolean
  error: string | null
  onToggle: () => void
  onLocationSelect: (loc: HPLocation) => void
  onSettingsClick: () => void
  measureMode: boolean
  onToggleMeasure: () => void
  onAddressSelect: (lng: number, lat: number, label: string) => void
  favouriteIds: Set<string>
  showOnlyFavourites: boolean
  onToggleFavourites: () => void
  customPlaces: CustomPlace[]
  onCustomPlaceClick: (id: string) => void
}

type LocationWithDist = HPLocation & { km: number | null }

function featureToLocation(f: FeatureCollection<Point>['features'][number]): LocationWithDist {
  const p = f.properties!
  return {
    id: p.id as string,
    name: p.name as string,
    location_type: p.location_type as LocationType,
    category: p.category as LocationCategory,
    hp_references: p.hp_references as string[],
    description: p.description as string,
    source: p.source as string,
    external_url: p.external_url as string | null,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    km: null,
  }
}

const ALL_LOCATIONS = hpLocations.features.map(featureToLocation)

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export default function NearbySheet({
  position, active, error, onToggle, onLocationSelect, onSettingsClick,
  measureMode, onToggleMeasure, onAddressSelect,
  favouriteIds, showOnlyFavourites, onToggleFavourites,
  customPlaces, onCustomPlaceClick,
}: Props) {
  const [snap, setSnap] = useState<SnapPoint>('peek')
  const [filter, setFilter] = useState<FilterState>({ category: 'all', locationType: 'all' })
  const [query, setQuery] = useState('')
  const searchId = useId()

  const { results: geoResults, loading: geoLoading } = useNominatim(query)

  // Collapse to peek when measure mode activates
  useEffect(() => {
    if (measureMode) setSnap('peek')
  }, [measureMode])

  const q = normalize(query.trim())

  const rawFiltered: LocationWithDist[] = ALL_LOCATIONS
    .filter((loc) => {
      if (showOnlyFavourites && !favouriteIds.has(loc.id)) return false
      if (filter.category !== 'all' && loc.category !== filter.category) return false
      if (filter.locationType !== 'all' && loc.location_type !== filter.locationType) return false
      if (q && !normalize(loc.name).includes(q) && !normalize(loc.description).includes(q)) return false
      return true
    })
    .map((loc) => ({
      ...loc,
      km: position ? haversineKm(position.lat, position.lng, loc.lat, loc.lng) : null,
    }))
    .sort((a, b) => {
      if (a.km !== null && b.km !== null) return a.km - b.km
      return a.name.localeCompare(b.name, 'en')
    })

  const filtered = useDeferredValue(rawFiltered)

  const customWithDist = customPlaces.map((p) => ({
    ...p,
    km: position ? haversineKm(position.lat, position.lng, p.lat, p.lng) : null,
  }))

  const hasGeoResults = geoResults.length > 0
  const hasCustom = customPlaces.length > 0
  const showSectionHeaders = hasGeoResults || hasCustom

  const categoryLabel = CATEGORY_META.find((c) => c.key === filter.category)?.label ?? 'Alle'
  const placeholder = filter.category === 'all'
    ? `Søk blant ${ALL_LOCATIONS.length} steder…`
    : `Søk i ${categoryLabel}…`

  function handleFilterChange(f: FilterState) {
    setFilter(f)
    setSnap('mid')
  }

  function handleSearchFocus() {
    setSnap('mid')
  }

  function handleItemClick(loc: HPLocation) {
    onLocationSelect(loc)
    setSnap('peek')
  }

  function handleGeoClick(lng: number, lat: number, label: string) {
    onAddressSelect(lng, lat, label)
    setSnap('peek')
    setQuery('')
  }

  const header = (
    <>
      <div className={styles.searchRow}>
        <label htmlFor={searchId} className={styles.srOnly}>Søk etter sted</label>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            id={searchId}
            type="search"
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleSearchFocus}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setQuery('')}
              aria-label="Tøm søk"
            >×</button>
          )}
        </div>

        {/* GPS button */}
        <button
          type="button"
          className={`${styles.iconBtn} ${active ? styles.iconBtnActive : ''}`}
          onClick={() => { onToggle(); if (!active) setSnap('mid') }}
          aria-label={active ? 'Slå av GPS' : 'Vis steder i nærheten'}
          title={active ? 'GPS av' : 'I nærheten'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 1v2M9 15v2M1 9h2M15 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Measure tool button */}
        <button
          type="button"
          className={`${styles.iconBtn} ${measureMode ? styles.iconBtnActive : ''}`}
          onClick={onToggleMeasure}
          aria-label={measureMode ? 'Avslutt avstandsmåling' : 'Mål avstand'}
          title={measureMode ? 'Avslutt måling' : 'Mål avstand'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2.5 12.5L12.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M2.5 12.5L5.5 15.5L15.5 5.5L12.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M5.5 9.5L7 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M8 7L9.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Favourites toggle */}
        <button
          type="button"
          className={`${styles.iconBtn} ${showOnlyFavourites ? styles.iconBtnActive : ''}`}
          onClick={onToggleFavourites}
          aria-label={showOnlyFavourites ? 'Vis alle steder' : 'Vis kun favoritter'}
          title={showOnlyFavourites ? 'Vis alle' : 'Favoritter'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 14.5L3.5 9.2A3.35 3.35 0 0 1 3.5 4.5a3.35 3.35 0 0 1 4.7 0L9 5.3l.8-.8a3.35 3.35 0 0 1 4.7 0 3.35 3.35 0 0 1 0 4.7L9 14.5Z"
              stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
              fill={showOnlyFavourites ? 'currentColor' : 'none'}
            />
          </svg>
        </button>

        {/* Settings button */}
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onSettingsClick}
          aria-label="Innstillinger"
          title="Innstillinger"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M7.2 1.8h3.6l.45 1.8c.54.2 1.04.49 1.49.85l1.73-.54 1.8 3.12-1.4 1.2c.04.19.06.38.06.57s-.02.38-.06.57l1.4 1.2-1.8 3.12-1.73-.54c-.45.36-.95.65-1.49.85l-.45 1.8H7.2l-.45-1.8A5.1 5.1 0 0 1 5.26 13.2l-1.73.54-1.8-3.12 1.4-1.2A5.2 5.2 0 0 1 3.07 9c0-.19.02-.39.06-.57l-1.4-1.2 1.8-3.12 1.73.54c.45-.36.95-.65 1.49-.85L7.2 1.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
            <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </button>
      </div>

      <CategoryFilter value={filter} onChange={handleFilterChange} />

      {active && position && !error && (
        <p className={styles.gpsStatus}>
          <span className={styles.gpsDot} />
          GPS aktiv — {filtered.length} steder funnet
        </p>
      )}
    </>
  )

  return (
    <BottomSheet snap={snap} onSnapChange={setSnap} header={header}>
      {/* Geocode results */}
      {hasGeoResults && (
        <div>
          <p className={styles.sectionHeader}>Adresser og steder</p>
          <ul className={styles.list} role="list">
            {geoResults.map((r) => {
              const { name, detail } = formatNominatimName(r)
              return (
                <li key={r.place_id}>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => handleGeoClick(parseFloat(r.lon), parseFloat(r.lat), name)}
                  >
                    <span className={styles.geoPin} aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M7 2C4.79 2 3 3.79 3 6c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <div className={styles.itemMain}>
                      <span className={styles.itemName}>{name}</span>
                      <span className={styles.itemSub}>{detail}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {geoLoading && query.trim().length >= 2 && geoResults.length === 0 && (
        <p className={styles.searchingText}>Søker…</p>
      )}

      {/* HP Locations */}
      <div>
        {showSectionHeaders && (
          <p className={styles.sectionHeader}>Harry Potter-steder</p>
        )}
        {filtered.length === 0 ? (
          <p className={styles.empty}>
            {showOnlyFavourites && favouriteIds.size === 0
              ? 'Ingen favoritter ennå. Trykk ♥ på et sted for å lagre det.'
              : q ? `Ingen treff for «${query}»` : 'Ingen steder for dette filteret.'}
          </p>
        ) : (
          <ul className={styles.list} role="list">
            {filtered.map((loc) => (
              <li key={loc.id}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => handleItemClick(loc)}
                >
                  <div className={styles.itemMain}>
                    <span className={styles.itemName}>
                      {favouriteIds.has(loc.id) && (
                        <span className={styles.favStar} aria-label="Favoritt">♥ </span>
                      )}
                      {loc.name}
                    </span>
                    <div className={styles.itemBadges}>
                      <Badge type={loc.location_type} size="sm" />
                      <Badge category={loc.category} size="sm" />
                    </div>
                  </div>
                  {loc.km !== null && (
                    <span className={styles.itemDistance}>{formatDistance(loc.km)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Custom places */}
      {hasCustom && (
        <div>
          <p className={styles.sectionHeader}>Mine steder</p>
          <ul className={styles.list} role="list">
            {customWithDist.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => onCustomPlaceClick(p.id)}
                >
                  <span className={styles.customDot} aria-hidden="true" />
                  <div className={styles.itemMain}>
                    <span className={styles.itemName}>{p.name}</span>
                    {p.description && (
                      <span className={styles.itemSub}>{p.description}</span>
                    )}
                  </div>
                  {p.km !== null && (
                    <span className={styles.itemDistance}>{formatDistance(p.km)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BottomSheet>
  )
}
