import { useState, useMemo, useId, useRef, useCallback, useEffect } from 'react'
import type { CSSProperties } from 'react'
import marauderIcon from '../assets/marauder-icon.png'
import { Home, WandSparkles, Wrench, Settings as SettingsIcon, Search, ChevronDown, X, Check, Trash2, Heart, UserRound } from 'lucide-react'
import { CategoryTree } from '../ds/CategoryTree'
import { type FilterState, CATEGORY_META, LOCATION_TYPES, locationMatchesFilter } from '../ds/filterMeta'
import { haversineKm, formatDistance } from '../utils/distance'
import { useGeocoder } from '../hooks/useGeocoder'
import { useSheetDrag } from '../hooks/useSheetDrag'
import { formatBytes, estimateBytes, type OfflineArea } from '../offline/OfflineAreaManager'
import type { HPLocation } from '../types/hp-location'
import type { OfflineAreaStatus } from '../hooks/useOfflineAreas'
import type { Position } from '../hooks/useGeolocation'
import type { CustomPlace } from '../types/custom-place'
import HouseSigil from './HouseSigil'
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

/**
 * Token-based prefix matching: every query token must prefix-match a word in
 * the haystack (name, description, city, country). "king cro" finds
 * "King's Cross", "edin" finds every Edinburgh place.
 */
function matchesTokens(loc: HPLocation, tokens: string[]): boolean {
  const haystack = normalize(
    [loc.name, loc.description ?? '', loc.city ?? '', loc.country ?? ''].join(' '),
  )
  const words = haystack.split(/[^a-z0-9]+/)
  return tokens.every((t) => words.some((w) => w.startsWith(t)) || haystack.includes(t))
}

function FavHeart() {
  return (
    <Heart size={11} fill="currentColor" strokeWidth={0} style={{ display: 'inline', verticalAlign: '-0.1em' }} aria-hidden="true" />
  )
}

/** Clickable category chip — toggles the category in the multi-select map
 *  filter, exactly like the checkbox in the category tree */
function CategoryChip({ catKey, selected, onToggle }: {
  catKey: string
  selected: boolean
  onToggle: () => void
}) {
  const meta = CATEGORY_META.find((c) => c.key === catKey)
  if (!meta) return null
  return (
    <button
      type="button"
      className={`${styles.geoChip} ${selected ? styles.geoChipActive : ''}`}
      style={{ '--chip-color': meta.color } as CSSProperties}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className={styles.chipColorDot} aria-hidden="true" />
      {meta.label}
    </button>
  )
}

/** Clickable country/city (+ user tag) chips — tapping one filters on that tag */
function GeoChips({ city, country, userTags = [], activeTag, onTag }: {
  city: string | null
  country: string | null
  userTags?: string[]
  activeTag: string | null
  onTag: (tag: string) => void
}) {
  const tags = [city, country, ...userTags].filter((t): t is string => !!t)
  if (tags.length === 0) return null
  return (
    <div className={styles.geoChips}>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className={`${styles.geoChip} ${activeTag === tag ? styles.geoChipActive : ''}`}
          onClick={() => onTag(tag)}
          aria-pressed={activeTag === tag}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}

const SEARCH_PLACEHOLDERS = [
  'Søk på ekte adresser...',
  'Søk på ekte steder...',
  'Søk på Hogwarts…',
  "Søk på King's Cross…",
  'Søk på Diagon Alley…',
]

function connectionType(): string {
  const conn = (navigator as unknown as { connection?: { type?: string; effectiveType?: string } }).connection
  if (!conn) return 'Ukjent'
  if (conn.type === 'wifi') return 'WiFi'
  if (conn.type === 'cellular') return `Mobil (${conn.effectiveType ?? ''})`
  if (conn.effectiveType) return conn.effectiveType.toUpperCase()
  return 'Ukjent'
}

type MenuTab = 'home' | 'wizarding' | 'tools' | 'settings'

type Props = {
  position: Position | null
  active: boolean
  error: string | null
  onToggle: () => void
  measureMode: boolean
  onToggleMeasure: () => void
  onAddressSelect: (lng: number, lat: number, name: string, detail: string) => void
  onLocationSelect: (loc: HPLocation) => void
  favouriteIds: Set<string>
  hpLocations: HPLocation[]
  customPlaces: CustomPlace[]
  onCustomPlaceClick: (id: string) => void
  activeFilter: FilterState
  onFilterChange: (f: FilterState) => void
  /** Per-favourite map visibility (heart markers) */
  shownFavouriteIds: Set<string>
  onToggleFavouriteVisible: (id: string) => void
  onToggleAllFavouritesVisible: () => void
  /** Long-press on the FAB: hide/show the map button group */
  onFabLongPress: () => void
  /** Per-place map visibility for Mine steder (shown-set, opt-in) */
  shownCustomIds: Set<string>
  onToggleCustomVisible: (id: string) => void
  onToggleAllCustomVisible: () => void
  showZoomControls: boolean
  onToggleZoomControls: (v: boolean) => void
  showLocateBtn: boolean
  onToggleLocateBtn: (v: boolean) => void
  baseLayer: 'standard' | 'satellite'
  onBaseLayerChange: (layer: 'standard' | 'satellite') => void
  /** Marauder pass progress */
  visitedCount: number
  /** Which HP places are visited — for the expandable score list */
  visitedIds: Set<string>
  totalPlaces: number
  /** House choice (theming accent) */
  house: 'none' | 'gryffindor' | 'hufflepuff' | 'ravenclaw' | 'slytherin'
  onHouseChange: (h: 'none' | 'gryffindor' | 'hufflepuff' | 'ravenclaw' | 'slytherin') => void
  onOpenQuiz: () => void
  onOpenFunFacts: () => void
  offlineAreas: OfflineArea[]
  offlineStatus: OfflineAreaStatus
  offlineDone: number
  offlineTotal: number
  offlineError: string | null
  onDownloadVisibleArea: () => void
  onCancelDownload: () => void
  onDeleteArea: (id: string) => void
  /** Returns a size estimate for the current map view, or null when the area
   *  exceeds the cap or bounds are unavailable. */
  getAreaEstimate: () => { count: number; sizeStr: string } | null
  online: boolean
  /** Data load error from useHPLocations — shown instead of silent emptiness (K5) */
  dataError?: string | null
  /** Increment to open the sheet on Hjem with categories expanded (P2 hint chip) */
  openToCategoriesSignal?: number
}

export default function MenuSheet({
  position, active, error, onToggle,
  measureMode, onToggleMeasure, onAddressSelect, onLocationSelect,
  favouriteIds, hpLocations, customPlaces, onCustomPlaceClick,
  activeFilter, onFilterChange,
  shownFavouriteIds, onToggleFavouriteVisible, onToggleAllFavouritesVisible, onFabLongPress,
  shownCustomIds, onToggleCustomVisible, onToggleAllCustomVisible,
  showZoomControls, onToggleZoomControls,
  showLocateBtn, onToggleLocateBtn,
  baseLayer, onBaseLayerChange,
  visitedCount, visitedIds, totalPlaces, house, onHouseChange, onOpenQuiz, onOpenFunFacts,
  offlineAreas, offlineStatus, offlineDone, offlineTotal, offlineError,
  onDownloadVisibleArea, onCancelDownload, onDeleteArea,
  getAreaEstimate,
  online, dataError = null,
  openToCategoriesSignal = 0,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<MenuTab>('home')
  const [query, setQuery] = useState('')
  // Kategorier starts expanded when no categories are selected (empty map state
  // on first launch), so the user lands directly on the filter controls.
  const [showCategories, setShowCategories] = useState(() => activeFilter.categories.length === 0)
  const [toolsAreaEstimate, setToolsAreaEstimate] = useState<{ count: number; sizeStr: string } | null>(null)
  const [showFavouritesList, setShowFavouritesList] = useState(false)
  const [showCustomList, setShowCustomList] = useState(false)
  // Geo tag filter (Lene, 2026-07-05): tapping a country/city chip shows every
  // place carrying that tag. Cleared by ×, or when a search starts.
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [searchHPOpen, setSearchHPOpen] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const searchId = useId()

  const closeSheet = useCallback(() => setIsOpen(false), [])
  const { sheetRef, size, setSize, onDragStart, onDragMove, onDragEnd, onDragCancel } =
    useSheetDrag(closeSheet)

  useEffect(() => {
    if (isOpen) sheetRef.current?.focus()
  }, [isOpen, sheetRef])

  useEffect(() => {
    if (openToCategoriesSignal === 0) return
    setIsOpen(true)
    setActiveTab('home')
    setShowCategories(true)
  }, [openToCategoriesSignal])

  useEffect(() => {
    if (activeTab === 'tools') setToolsAreaEstimate(getAreaEstimate())
  }, [activeTab, getAreaEstimate])

  // FAB long-press (600 ms): toggle map button visibility. The click that
  // follows the release must not open the menu.
  const fabLpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fabLpFired = useRef(false)

  const onFabPointerDown = useCallback(() => {
    fabLpFired.current = false
    fabLpTimer.current = setTimeout(() => {
      fabLpTimer.current = null
      fabLpFired.current = true
      onFabLongPress()
    }, 600)
  }, [onFabLongPress])

  const cancelFabLp = useCallback(() => {
    if (fabLpTimer.current) {
      clearTimeout(fabLpTimer.current)
      fabLpTimer.current = null
    }
  }, [])

  const onFabClick = useCallback(() => {
    if (fabLpFired.current) {
      fabLpFired.current = false
      return
    }
    setIsOpen(true)
  }, [])

  const { results: geoResults, loading: geoLoading } = useGeocoder(query)

  // Keep HP matches folded by default on each new query so ordinary address /
  // place results stay visible; expand the HP group by tapping its header.
  useEffect(() => { setSearchHPOpen(false) }, [query])

  const q = normalize(query.trim())

  // List results are search-driven only. Category checkboxes filter the map
  // markers (via activeFilter in App) and must NOT render a list in the menu.
  // Search scope: selected categories if any are checked, otherwise everything.
  const filteredHP = useMemo<HPLocationWithDist[]>(() => {
    if (!q) return []
    const tokens = q.split(/\s+/).filter(Boolean)
    return withDistAndSort(
      hpLocations.filter((loc) => {
        if (!locationMatchesFilter(loc.categories, loc.location_type, activeFilter)) return false
        return matchesTokens(loc, tokens)
      }),
      position,
    )
  }, [q, activeFilter, position, hpLocations])

  // Favourites are always listed regardless of category filter (Lene, 2026-07-05);
  // they yield only to active search, like everything else below the search field.
  const favouriteLocations = useMemo<HPLocationWithDist[]>(() => {
    if (q) return []
    return withDistAndSort(hpLocations.filter((loc) => favouriteIds.has(loc.id)), position)
  }, [q, favouriteIds, position, hpLocations])

  // Places already stamped onto the pass — the expandable Hunt Score list
  const visitedLocations = useMemo<HPLocationWithDist[]>(
    () => withDistAndSort(hpLocations.filter((loc) => visitedIds.has(loc.id)), position),
    [visitedIds, position, hpLocations],
  )

  const allFavouritesShown =
    favouriteIds.size > 0 && shownFavouriteIds.size === favouriteIds.size

  const allCustomShown =
    customPlaces.length > 0 && shownCustomIds.size === customPlaces.length

  const singleCategory = activeFilter.categories.length === 1 ? activeFilter.categories[0] : null

  useEffect(() => {
    if (q || singleCategory) return
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % SEARCH_PLACEHOLDERS.length)
    }, 3000)
    return () => clearInterval(id)
  }, [q, singleCategory])

  const placeholder = q
    ? ''
    : singleCategory
      ? `Søk i ${CATEGORY_META.find((c) => c.key === singleCategory)?.label ?? 'steder'}…`
      : SEARCH_PLACEHOLDERS[placeholderIdx]

  // Searching needs room for results: auto-expand the sheet while a query is
  // active — at default 33svh height the address results sat below the fold
  // and looked "broken" (diagnosed live 2026-07-05).
  useEffect(() => {
    if (q) {
      setSize('expanded')
      setActiveTag(null)
    }
  }, [q, setSize])

  // Chips toggle (Lene, 2026-07-05): tapping the active chip clears the filter
  const toggleTag = useCallback((tag: string) => {
    setActiveTag((cur) => (cur === tag ? null : tag))
  }, [])

  // Chip tapped in SEARCH results: leave search and open the tag view
  const tagFromSearch = useCallback((tag: string) => {
    setQuery('')
    setActiveTag(tag)
  }, [])

  // Category chip: toggle the category in the multi-select filter — same
  // effect as ticking its checkbox in the category tree
  const toggleCategoryFilter = useCallback((key: string) => {
    const selected = new Set(activeFilter.categories)
    let types = [...activeFilter.locationTypes]
    if (selected.has(key)) {
      selected.delete(key)
      if (key === 'locations') types = []
    } else {
      selected.add(key)
      if (key === 'locations') types = [...LOCATION_TYPES]
    }
    onFilterChange({ categories: [...selected], locationTypes: types })
  }, [activeFilter, onFilterChange])

  const taggedLocations = useMemo<HPLocationWithDist[]>(() => {
    if (!activeTag) return []
    // Custom places participate in tag filtering too (they get geo tags
    // automatically via reverse geocoding)
    const customAsLoc: HPLocation[] = customPlaces.map((p) => ({
      id: p.id,
      name: p.name,
      location_type: 'interpreted',
      categories: [],
      hp_references: [],
      description: p.description,
      source: 'custom',
      external_url: null,
      country: p.country ?? null,
      city: p.city ?? null,
      tags: p.tags,
      lat: p.lat,
      lng: p.lng,
    }))
    return withDistAndSort(
      [...hpLocations, ...customAsLoc].filter(
        (loc) =>
          loc.city === activeTag ||
          loc.country === activeTag ||
          (loc.tags ?? []).includes(activeTag),
      ),
      position,
    )
  }, [activeTag, hpLocations, customPlaces, position])

  function handleGeoClick(lng: number, lat: number, name: string, detail: string) {
    onAddressSelect(lng, lat, name, detail)
    setIsOpen(false)
    setQuery('')
  }

  function handleHPClick(loc: HPLocation) {
    onLocationSelect(loc)
    setIsOpen(false)
    setQuery('')
  }


  const customWithDist = customPlaces.map((p) => ({
    ...p,
    km: position ? haversineKm(position.lat, position.lng, p.lat, p.lng) : null,
  }))

  const hasGeoResults = geoResults.length > 0
  const hasCustom = customPlaces.length > 0
  const progress = offlineTotal > 0 ? offlineDone / offlineTotal : 0

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
          onClick={onFabClick}
          onPointerDown={onFabPointerDown}
          onPointerUp={cancelFabLp}
          onPointerLeave={cancelFabLp}
          onPointerCancel={cancelFabLp}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Åpne meny (hold inne for å skjule kartknappene)"
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
        className={`${styles.sheet} ${size === 'expanded' ? styles.sheetExpanded : ''} ${size === 'full' ? styles.sheetFull : ''} ${isOpen ? styles.sheetOpen : styles.sheetClosed}`}
        role="dialog"
        aria-modal={isOpen}
        aria-label="Meny"
        inert={!isOpen}
        tabIndex={-1}
      >
        {/* Drag zone */}
        <div
          className={styles.dragZone}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragCancel}
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
                  <Search className={styles.searchIcon} size={16} strokeWidth={1.7} aria-hidden="true" />
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
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.scrollArea}>
                {dataError && (
                  <p className={styles.errorText} role="alert">{dataError}</p>
                )}

                {/* HP location search results — folded by default so address
                    results stay visible; tap the header to expand (Lene, 2026-07-07) */}
                {q && filteredHP.length > 0 && (
                  <div>
                    <button
                      type="button"
                      className={styles.sectionToggle}
                      onClick={() => setSearchHPOpen((v) => !v)}
                      aria-expanded={searchHPOpen}
                    >
                      Harry Potter-steder ({filteredHP.length})
                      <ChevronDown
                        className={`${styles.sectionChevron} ${searchHPOpen ? styles.sectionChevronOpen : ''}`}
                        size={16} aria-hidden="true"
                      />
                    </button>
                    {searchHPOpen && (
                      <ul className={styles.list} role="list">
                        {filteredHP.map((loc) => (
                          <li key={loc.id} className={styles.itemBlock}>
                            <button
                              type="button"
                              className={styles.itemMainBtn}
                              onClick={() => handleHPClick(loc)}
                            >
                              <span className={styles.itemName}>
                                {favouriteIds.has(loc.id) && (
                                  <span className={styles.favStar} aria-label="Favoritt"><FavHeart /> </span>
                                )}
                                {loc.name}
                              </span>
                              {loc.km !== null && (
                                <span className={styles.itemDistance}>{formatDistance(loc.km)}</span>
                              )}
                            </button>
                            <div className={styles.chipsRow}>
                              {loc.categories.slice(0, 1).map((cat) => (
                                <CategoryChip
                                  key={cat}
                                  catKey={cat}
                                  selected={activeFilter.categories.includes(cat)}
                                  onToggle={() => toggleCategoryFilter(cat)}
                                />
                              ))}
                              <GeoChips city={loc.city} country={loc.country} activeTag={activeTag} onTag={tagFromSearch} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Geo results — search-as-you-type via Photon */}
                {hasGeoResults && (
                  <div>
                    <p className={styles.sectionHeader}>Adresser og steder</p>
                    <ul className={styles.list} role="list">
                      {geoResults.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            className={styles.item}
                            onClick={() => handleGeoClick(r.lng, r.lat, r.name, r.detail)}
                          >
                            <div className={styles.itemMain}>
                              <span className={styles.itemName}>{r.name}</span>
                              {r.detail && <span className={styles.itemSub}>{r.detail}</span>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {geoLoading && query.trim().length >= 2 && geoResults.length === 0 && (
                  <p className={styles.searchingText}>Søker…</p>
                )}

                {/* Offline: say WHY there are no address hits (D3) */}
                {q && !online && (
                  <p className={styles.empty}>
                    Adressesøk krever internett. Harry Potter-steder kan du fortsatt søke i.
                  </p>
                )}

                {/* Combined empty state — nothing matched in either source */}
                {q && online && filteredHP.length === 0 && !hasGeoResults && !geoLoading && (
                  <p className={styles.empty}>{`Ingen treff for «${query}»`}</p>
                )}

                {/* Marauder pass progress — tap to reveal which places are stamped */}
                {!q && !activeTag && totalPlaces > 0 && (
                  <div className={styles.passRow}>
                    <button
                      type="button"
                      className={styles.passHeaderBtn}
                      onClick={() => setScoreOpen((v) => !v)}
                      aria-expanded={scoreOpen}
                      aria-label={scoreOpen ? 'Skjul oppdagede steder' : 'Vis oppdagede steder'}
                    >
                      <span className={styles.passTitle}>Marauder's Hunt Score</span>
                      <span className={styles.passCount}>
                        {visitedCount} av {totalPlaces}
                        <ChevronDown
                          className={`${styles.passChevron} ${scoreOpen ? styles.passChevronOpen : ''}`}
                          size={14} aria-hidden="true"
                        />
                      </span>
                    </button>
                    <div className={styles.passBar}>
                      <div
                        className={styles.passFill}
                        style={{ width: `${Math.round((visitedCount / totalPlaces) * 100)}%` }}
                      />
                    </div>
                    {scoreOpen && (
                      <div className={styles.passList}>
                        {visitedLocations.length === 0 ? (
                          <p className={styles.passEmpty}>Ingen steder oppdaget ennå. Kom deg ut på jakt!</p>
                        ) : (
                          <ul className={styles.list} role="list">
                            {visitedLocations.map((loc) => (
                              <li key={loc.id} className={styles.itemBlock}>
                                <button
                                  type="button"
                                  className={styles.itemMainBtn}
                                  onClick={() => handleHPClick(loc)}
                                >
                                  <span className={styles.itemName}>{loc.name}</span>
                                  {loc.km !== null && (
                                    <span className={styles.itemDistance}>{formatDistance(loc.km)}</span>
                                  )}
                                </button>
                                <div className={styles.chipsRow}>
                                  {loc.categories.slice(0, 1).map((cat) => (
                                    <CategoryChip
                                      key={cat}
                                      catKey={cat}
                                      selected={activeFilter.categories.includes(cat)}
                                      onToggle={() => toggleCategoryFilter(cat)}
                                    />
                                  ))}
                                  <GeoChips city={loc.city} country={loc.country} activeTag={activeTag} onTag={toggleTag} />
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Geo tag view — tapping a country/city chip filters here */}
                {!q && activeTag && (
                  <div>
                    <div className={styles.tagHeader}>
                      <span className={styles.tagTitle}>Merket med {activeTag}</span>
                      <button
                        type="button"
                        className={styles.tagClear}
                        onClick={() => setActiveTag(null)}
                        aria-label="Fjern stedsfilter"
                      >
                        <X size={16} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </div>
                    <ul className={styles.list} role="list">
                      {taggedLocations.map((loc) => (
                        <li key={loc.id} className={styles.itemBlock}>
                          <button
                            type="button"
                            className={styles.itemMainBtn}
                            onClick={() => {
                              if (loc.source === 'custom') {
                                onCustomPlaceClick(loc.id)
                                setIsOpen(false)
                              } else {
                                handleHPClick(loc)
                              }
                            }}
                          >
                            <span className={styles.itemName}>
                              {favouriteIds.has(loc.id) && (
                                <span className={styles.favStar} aria-hidden="true"><FavHeart /> </span>
                              )}
                              {loc.name}
                            </span>
                            {loc.km !== null && (
                              <span className={styles.itemDistance}>{formatDistance(loc.km)}</span>
                            )}
                          </button>
                          <GeoChips city={loc.city} country={loc.country} userTags={loc.tags} activeTag={activeTag} onTag={toggleTag} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Collapsible sections — yield to search results while typing
                    (Tråkke pattern) and to an active tag filter: one job at a time */}
                {!q && !activeTag && (
                  <div>
                    <button
                      type="button"
                      className={styles.sectionToggle}
                      onClick={() => setShowCategories((v) => !v)}
                      aria-expanded={showCategories}
                    >
                      Kategorier
                      <ChevronDown
                        className={`${styles.sectionChevron} ${showCategories ? styles.sectionChevronOpen : ''}`}
                        size={16} aria-hidden="true"
                      />
                    </button>
                    {showCategories && <CategoryTree value={activeFilter} onChange={onFilterChange} />}

                    <button
                      type="button"
                      className={styles.sectionToggle}
                      onClick={() => setShowFavouritesList((v) => !v)}
                      aria-expanded={showFavouritesList}
                    >
                      Favoritter
                      <ChevronDown
                        className={`${styles.sectionChevron} ${showFavouritesList ? styles.sectionChevronOpen : ''}`}
                        size={16} aria-hidden="true"
                      />
                    </button>
                    {showFavouritesList && (favouriteLocations.length === 0 ? (
                      <p className={styles.empty}>
                        Ingen favoritter ennå. Trykk hjerte på et sted for å lagre.
                      </p>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`${styles.favAllRow} ${allFavouritesShown ? styles.favAllRowActive : ''}`}
                          onClick={onToggleAllFavouritesVisible}
                          aria-pressed={allFavouritesShown}
                        >
                          <span className={`${styles.toggleBox} ${allFavouritesShown ? styles.toggleBoxOn : ''}`} aria-hidden="true">
                            {allFavouritesShown && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                          </span>
                          Alle
                        </button>
                      <ul className={styles.list} role="list">
                        {favouriteLocations.map((loc) => {
                          const shown = shownFavouriteIds.has(loc.id)
                          return (
                            <li key={loc.id} className={styles.itemBlock}>
                              <div className={styles.itemRowFlex}>
                                <button
                                  type="button"
                                  className={styles.itemCheckBtn}
                                  onClick={() => onToggleFavouriteVisible(loc.id)}
                                  aria-pressed={shown}
                                  aria-label={shown ? `Skjul ${loc.name} på kartet` : `Vis ${loc.name} på kartet`}
                                >
                                  <span className={`${styles.toggleBox} ${shown ? styles.toggleBoxOn : ''}`} aria-hidden="true">
                                    {shown && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className={styles.itemMainBtn}
                                  onClick={() => handleHPClick(loc)}
                                >
                                  <span className={styles.itemName}>{loc.name}</span>
                                  {loc.km !== null && (
                                    <span className={styles.itemDistance}>{formatDistance(loc.km)}</span>
                                  )}
                                </button>
                              </div>
                              <div className={styles.chipsRow}>
                                {loc.categories.slice(0, 1).map((cat) => (
                                  <CategoryChip
                                    key={cat}
                                    catKey={cat}
                                    selected={activeFilter.categories.includes(cat)}
                                    onToggle={() => toggleCategoryFilter(cat)}
                                  />
                                ))}
                                <GeoChips city={loc.city} country={loc.country} activeTag={activeTag} onTag={toggleTag} />
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                      </>
                    ))}
                  </div>
                )}

                {!q && !activeTag && hasCustom && (
                  <div>
                    <button
                      type="button"
                      className={styles.sectionToggle}
                      onClick={() => setShowCustomList((v) => !v)}
                      aria-expanded={showCustomList}
                    >
                      Mine steder
                      <ChevronDown
                        className={`${styles.sectionChevron} ${showCustomList ? styles.sectionChevronOpen : ''}`}
                        size={16} aria-hidden="true"
                      />
                    </button>
                    {showCustomList && (<>
                    {/* "Alle": show/hide every custom place on the map */}
                    <button
                      type="button"
                      className={`${styles.favAllRow} ${allCustomShown ? styles.favAllRowActive : ''}`}
                      onClick={onToggleAllCustomVisible}
                      aria-pressed={allCustomShown}
                    >
                      <span className={`${styles.toggleBox} ${styles.toggleBoxGreen} ${allCustomShown ? styles.toggleBoxOn : ''}`} aria-hidden="true">
                        {allCustomShown && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                      </span>
                      Alle
                    </button>
                    <ul className={styles.list} role="list">
                      {customWithDist.map((p) => {
                        const visible = shownCustomIds.has(p.id)
                        return (
                          <li key={p.id} className={styles.itemBlock}>
                            <div className={styles.itemRowFlex}>
                              <button
                                type="button"
                                className={styles.itemCheckBtn}
                                onClick={() => onToggleCustomVisible(p.id)}
                                aria-pressed={visible}
                                aria-label={visible ? `Skjul ${p.name} på kartet` : `Vis ${p.name} på kartet`}
                              >
                                <span className={`${styles.toggleBox} ${styles.toggleBoxGreen} ${visible ? styles.toggleBoxOn : ''}`} aria-hidden="true">
                                  {visible && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                                </span>
                              </button>
                              <button
                                type="button"
                                className={styles.itemMainBtn}
                                onClick={() => { onCustomPlaceClick(p.id); setIsOpen(false) }}
                              >
                                <span className={styles.itemMain}>
                                  <span className={styles.itemName}>{p.name}</span>
                                  {p.description && <span className={styles.itemSub}>{p.description}</span>}
                                </span>
                                {p.km !== null && <span className={styles.itemDistance}>{formatDistance(p.km)}</span>}
                              </button>
                            </div>
                            <GeoChips city={p.city ?? null} country={p.country ?? null} userTags={p.tags} activeTag={activeTag} onTag={toggleTag} />
                          </li>
                        )
                      })}
                    </ul>
                    </>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tools tab */}
          {activeTab === 'wizarding' && (
            <div className={styles.tabContent}>
              <div className={styles.scrollAreaPadded}>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>OWLs and NEWT</p>
                  <div className={styles.card}>
                    <p className={styles.actionDesc}>
                      Du er blodfan sier du... 115 spørsmål. Griselda Marchbanks venter på deg, består du?
                    </p>
                    <div className={styles.actionRow}>
                      <button
                        className={styles.btnPrimary}
                        type="button"
                        onClick={() => { onOpenQuiz(); setIsOpen(false) }}
                      >
                        Bevis hva du kan
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Hogwarts Library's Restricted Section</p>
                  <div className={styles.card}>
                    <p className={styles.actionDesc}>
                      30 hemmelige opplysninger, strengt bevoktet av Madam Irma Pince. 
                    </p>
                    <div className={styles.actionRow}>
                      <button
                        className={styles.btnPrimary}
                        type="button"
                        onClick={() => { onOpenFunFacts(); setIsOpen(false) }}
                      >
                        Snik deg inn for å se
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Hus</p>
                  <div className={styles.card} role="radiogroup" aria-label="Velg hus">
                    {([
                      ['none', 'Muggle', ''],
                      ['gryffindor', 'Gryffindor', '#7F0909'],
                      ['hufflepuff', 'Hufflepuff', '#8C6B00'],
                      ['ravenclaw', 'Ravenclaw', '#222F5B'],
                      ['slytherin', 'Slytherin', '#1A472A'],
                    ] as const).map(([key, label, color]) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={house === key}
                        className={`${styles.favAllRow} ${house === key ? styles.favAllRowActive : ''}`}
                        onClick={() => onHouseChange(key)}
                        style={color ? ({ '--checkbox-color': color } as React.CSSProperties) : undefined}
                      >
                        <span className={`${styles.toggleBox} ${styles.roundBox} ${house === key ? styles.toggleBoxOn : ''}`} aria-hidden="true">
                          {house === key && <span className={styles.radioDot} />}
                        </span>
                        <span
                          className={styles.houseSigilSlot}
                          style={color ? ({ color } as CSSProperties) : undefined}
                          aria-hidden="true"
                        >
                          {key === 'none'
                            ? <UserRound size={24} strokeWidth={1.6} color="#1A0A00" aria-hidden="true" />
                            : <HouseSigil house={key} size={28} decorative />}
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div className={styles.tabContent}>
              <div className={styles.scrollAreaPadded}>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Avstandsmåling</p>
                  <div className={styles.card}>
                    <p className={styles.actionDesc}>
                      {measureMode
                        ? 'Aktiv. Lukk menyen og trykk på kartet for å legge til punkter.'
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

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Offline kart</p>
                  <div className={styles.card}>
                    <p className={styles.actionDesc}>
                      Naviger kartet til området du vil ha tilgang på uten nett/dekning, og last det ned her.
                      {connectionType().startsWith('Mobil') && ' Nå bruker du mobildata.'}
                    </p>

                    {offlineStatus === 'downloading' && (
                      <div className={styles.progressWrap}>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
                        </div>
                        <span className={styles.progressLabel}>
                          {offlineTotal > 0
                            ? `${offlineDone} av ${offlineTotal} kartfliser (ca. ${formatBytes(estimateBytes(offlineTotal))})`
                            : 'Forbereder…'}
                        </span>
                      </div>
                    )}

                    {offlineError && offlineStatus === 'error' && (
                      <p className={styles.errorText}>{offlineError}</p>
                    )}

                    <div className={styles.actionRow}>
                      {offlineStatus === 'downloading' ? (
                        <button className={styles.btnSecondary} type="button" onClick={onCancelDownload}>
                          Avbryt nedlasting
                        </button>
                      ) : (
                        <button className={styles.btnPrimary} type="button" onClick={onDownloadVisibleArea}>
                          Last ned gjeldende kartområde
                        </button>
                      )}
                    </div>
                    {offlineStatus !== 'downloading' && toolsAreaEstimate && (
                      <p className={styles.estimateNote}>
                        Synlig kartområde: Ca. {toolsAreaEstimate.count.toLocaleString('nb')} kartfliser ({toolsAreaEstimate.sizeStr})
                      </p>
                    )}
                  </div>

                  {offlineAreas.length > 0 && (
                    <div className={styles.card} style={{ marginTop: 12 }}>
                      {offlineAreas.map((area, i) => (
                        <div
                          key={area.id}
                          className={`${styles.statusRow} ${i > 0 ? styles.statusRowBorder : ''}`}
                        >
                          <span className={styles.statusLabel}>
                            {area.name}
                            {area.incomplete && (
                              <span className={styles.areaWarning}> — ikke lenger tilgjengelig, last ned på nytt</span>
                            )}
                          </span>
                          <span className={styles.infoValue}>{formatBytes(area.bytes)}</span>
                          <button
                            type="button"
                            className={styles.areaDeleteBtn}
                            onClick={() => onDeleteArea(area.id)}
                            aria-label={`Slett ${area.name}`}
                            disabled={offlineStatus === 'downloading'}
                          >
                            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Settings tab */}
          {activeTab === 'settings' && (
            <div className={styles.tabContent}>
              <div className={styles.scrollAreaPadded}>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Kartknapper</p>
                  <div className={styles.card}>
                    {/* Same order as the buttons appear on the map: locate on top */}
                    <ToggleRow
                      label="Min posisjon"
                      checked={showLocateBtn}
                      onChange={onToggleLocateBtn}
                    />
                    <div className={styles.statusRowBorder}>
                      <ToggleRow
                        label="Zoom"
                        checked={showZoomControls}
                        onChange={onToggleZoomControls}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Bakgrunnskart</p>
                  <div className={styles.card} role="radiogroup" aria-label="Bakgrunnskart">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={baseLayer === 'standard'}
                      className={`${styles.favAllRow} ${baseLayer === 'standard' ? styles.favAllRowActive : ''}`}
                      onClick={() => onBaseLayerChange('standard')}
                    >
                      <span className={`${styles.toggleBox} ${styles.roundBox} ${baseLayer === 'standard' ? styles.toggleBoxOn : ''}`} aria-hidden="true">
                        {baseLayer === 'standard' && <span className={styles.radioDot} />}
                      </span>
                      Standard
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={baseLayer === 'satellite'}
                      className={`${styles.favAllRow} ${baseLayer === 'satellite' ? styles.favAllRowActive : ''}`}
                      onClick={() => onBaseLayerChange('satellite')}
                    >
                      <span className={`${styles.toggleBox} ${styles.roundBox} ${baseLayer === 'satellite' ? styles.toggleBoxOn : ''}`} aria-hidden="true">
                        {baseLayer === 'satellite' && <span className={styles.radioDot} />}
                      </span>
                      Satellitt
                    </button>
                  </div>
                </div>

                <div className={styles.section}>
                  <p className={styles.sectionTitle}>GPS</p>
                  <div className={styles.card}>
                    <ToggleRow
                      label="Vis posisjonen min på kartet"
                      checked={active}
                      onChange={() => onToggle()}
                    />
                    {active && position && position.accuracy != null && (
                      <div className={`${styles.statusRow} ${styles.statusRowBorder}`}>
                        <span className={styles.statusLabel}>Nøyaktighet</span>
                        <span className={styles.infoValue}>±{Math.round(position.accuracy)} m</span>
                      </div>
                    )}
                    {error && <p className={styles.errorText}>{error}</p>}
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
            <Home size={22} strokeWidth={1.6} aria-hidden="true" />
          </TabBtn>
          <TabBtn active={activeTab === 'wizarding'} label="Magi" onClick={() => setActiveTab('wizarding')}>
            <WandSparkles size={22} strokeWidth={1.6} aria-hidden="true" />
          </TabBtn>
          <TabBtn active={activeTab === 'tools'} label="Verktøy" onClick={() => setActiveTab('tools')}>
            <Wrench size={22} strokeWidth={1.6} aria-hidden="true" />
          </TabBtn>
          <TabBtn active={activeTab === 'settings'} label="Innstillinger" onClick={() => setActiveTab('settings')}>
            <SettingsIcon size={22} strokeWidth={1.6} aria-hidden="true" />
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
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleLabels}>
        <span className={styles.toggleLabel}>{label}</span>
        {description && <span className={styles.toggleDesc}>{description}</span>}
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
