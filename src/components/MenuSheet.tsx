import { useState, useMemo, useId, useRef, useCallback } from 'react'
import { CategoryTree } from '../ds/CategoryTree'
import { type FilterState } from '../ds/filterMeta'
import { Badge } from '../ds/Badge'
import { haversineKm, formatDistance } from '../utils/distance'
import { useNominatim, formatNominatimName } from '../hooks/useNominatim'
import hpLocationsData from '../data/hp-locations.json'
import type { FeatureCollection, Point } from 'geojson'
import type { Position } from '../hooks/useGeolocation'
import type { HPLocation, LocationType, LocationCategory } from '../types/hp-location'
import type { CustomPlace } from '../types/custom-place'
import styles from './MenuSheet.module.css'

const hpLocations = hpLocationsData as unknown as FeatureCollection<Point>

type LocationWithDist = HPLocation & { km: number | null }

function featureToLocation(f: FeatureCollection<Point>['features'][number]): LocationWithDist {
  const p = f.properties!
  return {
    id: p.id as string,
    name: p.name as string,
    location_type: p.location_type as LocationType,
    categories: p.categories as LocationCategory[],
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

type MenuTab = 'steder' | 'naer' | 'mal' | 'favoritter' | 'innstillinger'

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
  customPlaces: CustomPlace[]
  onCustomPlaceClick: (id: string) => void
  activeFilter: FilterState | null
  onFilterChange: (f: FilterState) => void
}

export default function MenuSheet({
  position, active, error, onToggle, onLocationSelect, onSettingsClick,
  measureMode, onToggleMeasure, onAddressSelect,
  favouriteIds, customPlaces, onCustomPlaceClick,
  activeFilter, onFilterChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<MenuTab>('steder')
  const [query, setQuery] = useState('')
  const searchId = useId()

  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const dragging = useRef(false)

  const { results: geoResults, loading: geoLoading } = useNominatim(query)

  const q = normalize(query.trim())

  const searchResults = useMemo<LocationWithDist[]>(() => {
    if (!q) return []
    return ALL_LOCATIONS
      .filter((loc) => normalize(loc.name).includes(q) || normalize(loc.description).includes(q))
      .map((loc) => ({
        ...loc,
        km: position ? haversineKm(position.lat, position.lng, loc.lat, loc.lng) : null,
      }))
      .sort((a, b) => {
        if (a.km !== null && b.km !== null) return a.km - b.km
        return a.name.localeCompare(b.name, 'en')
      })
  }, [q, position])

  const favouriteLocations = useMemo<LocationWithDist[]>(() =>
    ALL_LOCATIONS
      .filter((loc) => favouriteIds.has(loc.id))
      .map((loc) => ({
        ...loc,
        km: position ? haversineKm(position.lat, position.lng, loc.lat, loc.lng) : null,
      }))
      .sort((a, b) => {
        if (a.km !== null && b.km !== null) return a.km - b.km
        return a.name.localeCompare(b.name, 'en')
      }),
    [favouriteIds, position],
  )

  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startY.current = e.clientY
    dragging.current = true
    const sheet = sheetRef.current
    if (sheet) sheet.style.transition = 'none'
  }, [])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !(e.buttons & 1)) return
    const dy = Math.max(0, e.clientY - startY.current)
    const sheet = sheetRef.current
    if (sheet) sheet.style.transform = `translateY(${dy}px)`
  }, [])

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    const dy = e.clientY - startY.current
    const sheet = sheetRef.current
    if (sheet) {
      sheet.style.transition = ''
      sheet.style.transform = ''
    }
    if (dy > 80) setIsOpen(false)
  }, [])

  function handleLocationSelect(loc: HPLocation) {
    onLocationSelect(loc)
    setIsOpen(false)
  }

  function handleFilterSelect(f: FilterState) {
    onFilterChange(f)
    setIsOpen(false)
  }

  function handleGeoClick(lng: number, lat: number, label: string) {
    onAddressSelect(lng, lat, label)
    setIsOpen(false)
    setQuery('')
  }

  function handleTabClick(tab: MenuTab) {
    if (tab === 'innstillinger') {
      onSettingsClick()
      return
    }
    setActiveTab(tab)
  }

  const customWithDist = customPlaces.map((p) => ({
    ...p,
    km: position ? haversineKm(position.lat, position.lng, p.lat, p.lng) : null,
  }))

  const hasCustom = customPlaces.length > 0
  const isSearching = q.length > 0

  return (
    <>
      {/* FAB — only visible when sheet is closed */}
      {!isOpen && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => setIsOpen(true)}
          aria-label="Åpne meny"
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M4 22l10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M13 4l1.6 3.2 3.2 1.6-3.2 1.6L13 13l-1.6-3.2L8.2 8.2l3.2-1.6L13 4Z"
              stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
              fill="currentColor" fillOpacity="0.4"/>
            <path d="M20 15l.9 1.8 1.8.9-1.8.9L20 20.5l-.9-1.9-1.9-.9 1.9-.9L20 15Z"
              stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
              fill="currentColor" fillOpacity="0.4"/>
          </svg>
        </button>
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${isOpen ? styles.sheetOpen : styles.sheetClosed}`}
        role="dialog"
        aria-modal={isOpen}
        aria-label="Meny"
      >
        {/* Drag zone */}
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

        {/* Content */}
        <div className={styles.content}>

          {/* Steder tab */}
          {activeTab === 'steder' && (
            <div className={styles.tabContent}>
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
                    placeholder={`Søk blant ${ALL_LOCATIONS.length} steder…`}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {query && (
                    <button type="button" className={styles.clearBtn} onClick={() => setQuery('')} aria-label="Tøm søk">
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.scrollArea}>
                {isSearching ? (
                  /* Search mode: flat results */
                  <>
                    {geoLoading && geoResults.length === 0 && (
                      <p className={styles.searchingText}>Søker…</p>
                    )}

                    {geoResults.length > 0 && (
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
                                  onClick={() => {
                                    const lng = parseFloat(r.lon)
                                    const lat = parseFloat(r.lat)
                                    if (!Number.isNaN(lng) && !Number.isNaN(lat)) handleGeoClick(lng, lat, name)
                                  }}
                                >
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

                    {searchResults.length > 0 && (
                      <div>
                        {geoResults.length > 0 && <p className={styles.sectionHeader}>Harry Potter-steder</p>}
                        <ul className={styles.list} role="list">
                          {searchResults.map((loc) => (
                            <li key={loc.id}>
                              <button type="button" className={styles.item} onClick={() => handleLocationSelect(loc)}>
                                <div className={styles.itemMain}>
                                  <span className={styles.itemName}>
                                    {favouriteIds.has(loc.id) && <span className={styles.favStar} aria-label="Favoritt">♥ </span>}
                                    {loc.name}
                                  </span>
                                  <div className={styles.itemBadges}>
                                    {loc.categories.slice(0, 2).map((cat) => (
                                      <Badge key={cat} category={cat} size="sm" />
                                    ))}
                                  </div>
                                </div>
                                {loc.km !== null && <span className={styles.itemDistance}>{formatDistance(loc.km)}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {searchResults.length === 0 && geoResults.length === 0 && !geoLoading && (
                      <p className={styles.empty}>Ingen treff for «{query}»</p>
                    )}
                  </>
                ) : (
                  /* Browse mode: category filter tree */
                  <>
                    <CategoryTree
                      value={activeFilter}
                      onChange={handleFilterSelect}
                    />

                    {hasCustom && (
                      <div>
                        <p className={styles.sectionHeader}>Mine steder</p>
                        <ul className={styles.list} role="list">
                          {customWithDist.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className={styles.item}
                                onClick={() => { onCustomPlaceClick(p.id); setIsOpen(false) }}
                              >
                                <div className={styles.itemMain}>
                                  <span className={styles.itemName}>{p.name}</span>
                                  {p.description && <span className={styles.itemSub}>{p.description}</span>}
                                </div>
                                {p.km !== null && <span className={styles.itemDistance}>{formatDistance(p.km)}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Nær meg tab */}
          {activeTab === 'naer' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2 className={styles.tabTitle}>Nær meg</h2>
              </div>
              <div className={styles.scrollArea}>
                <div className={styles.actionCard}>
                  <p className={styles.actionDesc}>
                    {active
                      ? 'GPS er aktiv — viser de nærmeste stedene.'
                      : 'Slå på GPS for å finne Harry Potter-steder i nærheten.'}
                  </p>
                  {error && <p className={styles.actionError}>{error}</p>}
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${active ? styles.actionBtnActive : ''}`}
                    onClick={onToggle}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M9 1v2M9 15v2M1 9h2M15 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {active ? 'Slå av GPS' : 'Slå på GPS'}
                  </button>
                </div>

                {active && position && (
                  <>
                    <p className={styles.sectionHeader}>Nærmeste steder</p>
                    <ul className={styles.list} role="list">
                      {ALL_LOCATIONS
                        .map((loc) => ({ ...loc, km: haversineKm(position.lat, position.lng, loc.lat, loc.lng) }))
                        .sort((a, b) => a.km - b.km)
                        .slice(0, 10)
                        .map((loc) => (
                          <li key={loc.id}>
                            <button type="button" className={styles.item} onClick={() => handleLocationSelect(loc)}>
                              <div className={styles.itemMain}>
                                <span className={styles.itemName}>{loc.name}</span>
                                <div className={styles.itemBadges}>
                                  {loc.categories.slice(0, 2).map((cat) => (
                                    <Badge key={cat} category={cat} size="sm" />
                                  ))}
                                </div>
                              </div>
                              <span className={styles.itemDistance}>{formatDistance(loc.km)}</span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mål tab */}
          {activeTab === 'mal' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2 className={styles.tabTitle}>Mål avstand</h2>
              </div>
              <div className={styles.scrollArea}>
                <div className={styles.actionCard}>
                  <p className={styles.actionDesc}>
                    {measureMode
                      ? 'Avstandsmåling er aktiv. Lukk menyen og trykk to punkter på kartet.'
                      : 'Mål avstanden mellom to punkter på kartet.'}
                  </p>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${measureMode ? styles.actionBtnActive : ''}`}
                    onClick={() => { onToggleMeasure(); if (!measureMode) setIsOpen(false) }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path d="M2.5 12.5L12.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M2.5 12.5L5.5 15.5L15.5 5.5L12.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M5.5 9.5L7 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M8 7L9.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    {measureMode ? 'Avslutt måling' : 'Start avstandsmåling'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Favoritter tab */}
          {activeTab === 'favoritter' && (
            <div className={styles.tabContent}>
              <div className={styles.tabHeader}>
                <h2 className={styles.tabTitle}>Favoritter</h2>
              </div>
              <div className={styles.scrollArea}>
                {favouriteIds.size === 0 ? (
                  <p className={styles.empty}>
                    Ingen favoritter ennå. Trykk ♥ på et sted for å lagre det.
                  </p>
                ) : (
                  <ul className={styles.list} role="list">
                    {favouriteLocations.map((loc) => (
                      <li key={loc.id}>
                        <button type="button" className={styles.item} onClick={() => handleLocationSelect(loc)}>
                          <div className={styles.itemMain}>
                            <span className={styles.itemName}>{loc.name}</span>
                            <div className={styles.itemBadges}>
                              {loc.categories.slice(0, 2).map((cat) => (
                                <Badge key={cat} category={cat} size="sm" />
                              ))}
                            </div>
                          </div>
                          {loc.km !== null && <span className={styles.itemDistance}>{formatDistance(loc.km)}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <nav className={styles.tabBar} aria-label="Menynavigasjon">
          <TabBtn active={activeTab === 'steder'} label="Steder" onClick={() => handleTabClick('steder')}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="11" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 3C7.69 3 5 5.69 5 9c0 4.5 6 11 6 11s6-6.5 6-11c0-3.31-2.69-6-6-6Z"
                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
                fill={activeTab === 'steder' ? 'currentColor' : 'none'} fillOpacity="0.15"/>
            </svg>
          </TabBtn>
          <TabBtn active={activeTab === 'naer'} label="Nær meg" onClick={() => handleTabClick('naer')}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.5"
                fill={activeTab === 'naer' ? 'currentColor' : 'none'} fillOpacity="0.15"/>
              <path d="M11 2.5v2.5M11 17v2.5M2.5 11H5M17 11h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </TabBtn>
          <TabBtn active={activeTab === 'mal'} label="Mål" onClick={() => handleTabClick('mal')}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M3.5 16.5L14 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M3.5 16.5L7 20L20 7L16.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8 12.5L9.5 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M11 9L12.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </TabBtn>
          <TabBtn active={activeTab === 'favoritter'} label="Favoritter" onClick={() => handleTabClick('favoritter')}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M11 18.5L4.5 12A4.5 4.5 0 0 1 4.5 5.7a4.5 4.5 0 0 1 6.3 0l.2.2.2-.2a4.5 4.5 0 0 1 6.3 0 4.5 4.5 0 0 1 0 6.3L11 18.5Z"
                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
                fill={activeTab === 'favoritter' ? 'currentColor' : 'none'} fillOpacity="0.15"/>
            </svg>
          </TabBtn>
          <TabBtn active={false} label="Innstillinger" onClick={() => handleTabClick('innstillinger')}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M9 2h4l.55 2.2a6 6 0 0 1 1.85 1.07l2.14-.67L19.5 8l-1.73 1.47c.07.34.1.7.1 1.03s-.03.7-.1 1.03L19.5 13l-1.96 3.4-2.14-.67a6 6 0 0 1-1.85 1.07L13 19H9l-.55-2.2A6 6 0 0 1 6.6 15.73l-2.14.67L2.5 13l1.73-1.47a6.5 6.5 0 0 1 0-2.06L2.5 8l1.96-3.4 2.14.67A6 6 0 0 1 8.45 4.2L9 2Z"
                stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
              <circle cx="11" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </TabBtn>
        </nav>
      </div>
    </>
  )
}

function TabBtn({ active, label, onClick, children }: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`${styles.tabBtn} ${active ? styles.tabBtnActive : ''}`}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      {children}
      <span className={styles.tabLabel}>{label}</span>
    </button>
  )
}
