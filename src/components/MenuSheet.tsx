import { useState, useMemo, useId, useRef, useCallback, useEffect } from 'react'
import marauderIcon from '../assets/marauder-icon.png'
import { CategoryTree } from '../ds/CategoryTree'
import { type FilterState, CATEGORY_META } from '../ds/filterMeta'
import { haversineKm, formatDistance } from '../utils/distance'
import { useNominatim, formatNominatimName } from '../hooks/useNominatim'
import { formatBytes } from '../offline/OfflineMapManager'
import { Badge } from '../ds/Badge'
import type { HPLocation, LocationCategory } from '../types/hp-location'
import type { OfflineStatus } from '../hooks/useOfflineTiles'
import type { Position } from '../hooks/useGeolocation'
import type { CustomPlace } from '../types/custom-place'
import styles from './MenuSheet.module.css'

type HPLocationWithDist = HPLocation & { km: number | null }

function withDistAndSort(locs: HPLocation[], position: Position | null): HPLocationWithDist[] {
  return locs
    .map((loc) => ({
      ...loc,
      km: position ? haversineKm(position.lat, position.lng, loc.lat, loc.lng) : null,
    }))
    .sort((a, b) => a.km !== null && b.km !== null ? a.km - b.km : a.name.localeCompare(b.name, 'en'))
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function FavHeart() {
  return (
    <svg width="11" height="10" viewBox="0 0 11 10" fill="currentColor" style={{ display: 'inline', verticalAlign: '-0.1em' }} aria-hidden="true">
      <path d="M5.5 9C5.5 9 1 6.1 1 3.2a2.5 2.5 0 0 1 4.5-1.5A2.5 2.5 0 0 1 10 3.2C10 6.1 5.5 9 5.5 9Z" />
    </svg>
  )
}

const SEARCH_PLACEHOLDERS = [
  'Søk på adresser...',
  'Søk på steder...',
  'Søk etter Hogwarts…',
  "Søk etter King's Cross…",
  'Søk etter The Leaky Cauldron…',
]

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

type MenuTab = 'home' | 'tools' | 'settings'

type Props = {
  position: Position | null
  active: boolean
  error: string | null
  onToggle: () => void
  measureMode: boolean
  onToggleMeasure: () => void
  onAddressSelect: (lng: number, lat: number) => void
  onLocationSelect: (loc: HPLocation) => void
  favouriteIds: Set<string>
  hpLocations: HPLocation[]
  customPlaces: CustomPlace[]
  onCustomPlaceClick: (id: string) => void
  activeFilter: FilterState | null
  onFilterChange: (f: FilterState | null) => void
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

export default function MenuSheet({
  position, active, error, onToggle,
  measureMode, onToggleMeasure, onAddressSelect, onLocationSelect,
  favouriteIds, hpLocations, customPlaces, onCustomPlaceClick,
  activeFilter, onFilterChange,
  showZoomControls, onToggleZoomControls,
  pmtilesEnabled, offlineStatus, downloaded, total, offlineError,
  onDownload, onCancel, onDelete,
  online,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<MenuTab>('home')
  const [filter, setFilter] = useState<FilterState>({ category: 'all', locationType: 'all' })
  const [query, setQuery] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const searchId = useId()

  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const dragging = useRef(false)

  const { results: geoResults, loading: geoLoading } = useNominatim(query)

  const q = normalize(query.trim())

  // Sync filter reset when parent clears activeFilter (e.g. future map-level "clear all")
  useEffect(() => {
    if (activeFilter === null) setFilter({ category: 'all', locationType: 'all' })
  }, [activeFilter])

  const filteredHP = useMemo<HPLocationWithDist[]>(() => {
    if (!q && filter.category === 'all') return []
    return withDistAndSort(
      hpLocations.filter((loc) => {
        if (filter.category !== 'all' && !loc.categories.includes(filter.category as LocationCategory)) return false
        if (filter.category === 'locations' && filter.locationType !== 'all' && loc.location_type !== filter.locationType) return false
        if (q && !normalize(loc.name).includes(q) && !normalize(loc.description ?? '').includes(q)) return false
        return true
      }),
      position,
    )
  }, [q, filter, position, hpLocations])

  const favouriteLocations = useMemo<HPLocationWithDist[]>(() => {
    if (q || filter.category !== 'all') return []
    return withDistAndSort(hpLocations.filter((loc) => favouriteIds.has(loc.id)), position)
  }, [q, filter.category, favouriteIds, position, hpLocations])

  useEffect(() => {
    if (q || filter.category !== 'all') return
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % SEARCH_PLACEHOLDERS.length)
    }, 3000)
    return () => clearInterval(id)
  }, [q, filter.category])

  const placeholder = q
    ? ''
    : filter.category !== 'all'
      ? `Søk i ${CATEGORY_META.find((c) => c.key === filter.category)?.label ?? 'steder'}…`
      : SEARCH_PLACEHOLDERS[placeholderIdx]

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

  function handleGeoClick(lng: number, lat: number) {
    onAddressSelect(lng, lat)
    setIsOpen(false)
    setQuery('')
  }

  function handleHPClick(loc: HPLocation) {
    onLocationSelect(loc)
    setIsOpen(false)
    setQuery('')
  }

  function handleFilterChange(f: FilterState) {
    setFilter(f)
    onFilterChange(f)
  }

  const customWithDist = customPlaces.map((p) => ({
    ...p,
    km: position ? haversineKm(position.lat, position.lng, p.lat, p.lng) : null,
  }))

  const hasGeoResults = geoResults.length > 0
  const hasCustom = customPlaces.length > 0
  const progress = total > 0 ? downloaded / total : 0

  return (
    <>
      {/* Backdrop — closes sheet when clicking outside */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* FAB — visible when sheet is closed */}
      {!isOpen && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => setIsOpen(true)}
          aria-label="Åpne meny"
        >
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              width: 28,
              height: 28,
              backgroundColor: 'currentColor',
              maskImage: `url(${marauderIcon})`,
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: `url(${marauderIcon})`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
            }}
          />
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

          {/* Home tab */}
          {activeTab === 'home' && (
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
                    placeholder={placeholder}
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

              <CategoryTree value={filter} onChange={handleFilterChange} />

              <div className={styles.scrollArea}>
                {/* HP location search results — shown when query or category filter active */}
                {(q || filter.category !== 'all') && (
                  <div>
                    <p className={styles.sectionHeader}>Harry Potter-steder</p>
                    {filteredHP.length === 0 ? (
                      <p className={styles.empty}>
                        {q ? `Ingen treff for «${query}»` : 'Ingen steder for dette filteret.'}
                      </p>
                    ) : (
                      <ul className={styles.list} role="list">
                        {filteredHP.map((loc) => (
                          <li key={loc.id}>
                            <button
                              type="button"
                              className={styles.item}
                              onClick={() => handleHPClick(loc)}
                            >
                              <div className={styles.itemMain}>
                                <span className={styles.itemName}>
                                  {favouriteIds.has(loc.id) && (
                                    <span className={styles.favStar} aria-label="Favoritt"><FavHeart /> </span>
                                  )}
                                  {loc.name}
                                </span>
                                <div className={styles.itemBadges}>
                                  {loc.categories.slice(0, 2).map((cat) => (
                                    <Badge key={cat} category={cat} size="sm" />
                                  ))}
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
                )}

                {/* Geo results — shown when nominatim returns results for the query */}
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
                              onClick={() => {
                                const lng = parseFloat(r.lon)
                                const lat = parseFloat(r.lat)
                                if (!Number.isNaN(lng) && !Number.isNaN(lat)) handleGeoClick(lng, lat)
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

                {geoLoading && query.trim().length >= 2 && geoResults.length === 0 && (
                  <p className={styles.searchingText}>Søker…</p>
                )}

                {/* Favourites — shown when not searching and no category filter */}
                {!q && filter.category === 'all' && (
                  <div>
                    <p className={styles.sectionHeader}>Favoritter</p>
                    {favouriteLocations.length === 0 ? (
                      <p className={styles.empty}>
                        Ingen favoritter ennå. Trykk hjerteikonet på et sted for å lagre det.
                      </p>
                    ) : (
                      <ul className={styles.list} role="list">
                        {favouriteLocations.map((loc) => (
                          <li key={loc.id}>
                            <button
                              type="button"
                              className={styles.item}
                              onClick={() => handleHPClick(loc)}
                            >
                              <div className={styles.itemMain}>
                                <span className={styles.itemName}>
                                  <span className={styles.favStar} aria-hidden="true"><FavHeart /> </span>
                                  {loc.name}
                                </span>
                                <div className={styles.itemBadges}>
                                  {loc.categories.slice(0, 2).map((cat) => (
                                    <Badge key={cat} category={cat} size="sm" />
                                  ))}
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
                )}

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
              </div>
            </div>
          )}

          {/* Tools tab */}
          {activeTab === 'tools' && (
            <div className={styles.tabContent}>
              <div className={styles.scrollAreaPadded}>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Avstandsmåling</p>
                  <div className={styles.card}>
                    <p className={styles.actionDesc} style={{ padding: '10px 14px 4px' }}>
                      {measureMode
                        ? 'Aktiv. Lukk menyen og klikk på kartet for å legge til punkter.'
                        : 'Mål avstand langs en rute med ubegrenset antall punkter.'}
                    </p>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={measureMode ? styles.btnSecondary : styles.btnPrimary}
                        onClick={() => { onToggleMeasure(); if (!measureMode) setIsOpen(false) }}
                      >
                        {measureMode ? 'Avslutt måling' : 'Start avstandsmåling'}
                      </button>
                    </div>
                  </div>
                </div>

                {pmtilesEnabled && (
                  <div className={styles.section}>
                    <p className={styles.sectionTitle}>Offline kart</p>
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
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Settings tab */}
          {activeTab === 'settings' && (
            <div className={styles.tabContent}>
              <div className={styles.scrollAreaPadded}>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Tilkobling</p>
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
                </div>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Kart</p>
                  <div className={styles.card}>
                    <ToggleRow
                      label="Zoom-knapper"
                      description="Vis +/− på kartet"
                      checked={showZoomControls}
                      onChange={onToggleZoomControls}
                    />
                  </div>
                </div>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>GPS</p>
                  <div className={styles.card}>
                    <div className={styles.statusRow}>
                      <span className={styles.statusLabel}>Posisjon</span>
                      <span className={`${styles.statusChip} ${active ? styles.chipOnline : styles.chipNone}`}>
                        <span className={styles.chipDot} />
                        {active ? 'Aktiv' : 'Av'}
                      </span>
                    </div>
                    {error && (
                      <div className={`${styles.statusRow} ${styles.statusRowBorder}`}>
                        <span className={styles.statusLabel}>Feil</span>
                        <span className={styles.infoValue}>{error}</span>
                      </div>
                    )}
                    {active && position && position.accuracy != null && (
                      <div className={`${styles.statusRow} ${styles.statusRowBorder}`}>
                        <span className={styles.statusLabel}>Nøyaktighet</span>
                        <span className={styles.infoValue}>±{Math.round(position.accuracy)} m</span>
                      </div>
                    )}
                    <div className={`${styles.statusRow} ${styles.statusRowBorder}`}>
                      <span className={styles.statusLabel}>{active ? 'Slå av GPS' : 'Slå på GPS'}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        className={`${styles.toggle} ${active ? styles.toggleOn : ''}`}
                        onClick={onToggle}
                        aria-label="GPS"
                      >
                        <span className={styles.toggleThumb} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Kildekode og dokumentasjon</p>
                  <div className={styles.card}>
                    <div className={styles.infoRow}>
                      <a
                        href="https://github.com/elzacka/marauder-pwa"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.omLink}
                      >
                        GitHub
                      </a>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <nav className={styles.tabBar} aria-label="Menynavigasjon">
          <TabBtn active={activeTab === 'home'} label="Hjem" onClick={() => setActiveTab('home')}>
            {/* House */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path
                d="M3 11L11 4L19 11V19H14V14H8V19H3V11Z"
                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
                fill={activeTab === 'home' ? 'currentColor' : 'none'} fillOpacity="0.15"
              />
            </svg>
          </TabBtn>
          <TabBtn active={activeTab === 'tools'} label="Verktøy" onClick={() => setActiveTab('tools')}>
            {/* Wrench */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path
                d="M14.5 4.5a4.5 4.5 0 0 0-4 6.5L4 17.5A1.5 1.5 0 0 0 6.5 20l6.5-6.5a4.5 4.5 0 0 0 6-5.5l-2.5 2.5-2-2 2.5-2.5A4.5 4.5 0 0 0 14.5 4.5Z"
                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
              />
            </svg>
          </TabBtn>
          <TabBtn active={activeTab === 'settings'} label="Innstillinger" onClick={() => setActiveTab('settings')}>
            {/* Gear */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M9 2h4l.55 2.2a6 6 0 0 1 1.85 1.07l2.14-.67L19.5 8l-1.73 1.47c.07.34.1.7.1 1.03s-.03.7-.1 1.03L19.5 13l-1.96 3.4-2.14-.67a6 6 0 0 1-1.85 1.07L13 19H9l-.55-2.2A6 6 0 0 1 6.6 15.73l-2.14.67L2.5 13l1.73-1.47a6.5 6.5 0 0 1 0-2.06L2.5 8l1.96-3.4 2.14.67A6 6 0 0 1 8.45 4.2L9 2Z"
                stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"
                fill={activeTab === 'settings' ? 'currentColor' : 'none'} fillOpacity="0.15"
              />
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
    </button>
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
