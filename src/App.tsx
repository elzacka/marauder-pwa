import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { safeSetItem } from './utils/safeStorage'
import { useGeolocation } from './hooks/useGeolocation'
import { useWakeLock } from './hooks/useWakeLock'
import { useOfflineAreas } from './hooks/useOfflineAreas'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useFavourites } from './hooks/useFavourites'
import { useCustomPlaces } from './hooks/useCustomPlaces'
import { useHPLocations } from './hooks/useHPLocations'
import MapView, { type MapHandle, type BaseLayer } from './map/MapView'
import MenuSheet from './components/MenuSheet'
import POIDetailSheet from './components/POIDetailSheet'
import MeasureBar from './components/MeasureBar'
import AddPlaceSheet from './components/AddPlaceSheet'
import InstallBanner from './components/InstallBanner'
import GeocodeCard from './components/GeocodeCard'
import AppHeader from './components/AppHeader'
import SpellOverlay from './components/SpellOverlay'
import OathSplash from './components/OathSplash'
import QuizSheet from './components/QuizSheet'
import FunFactsSheet from './components/FunFactsSheet'
import { useVisited } from './hooks/useVisited'
import { haversineKm } from './utils/distance'
import type { HPLocation } from './types/hp-location'
import type { CustomPlace } from './types/custom-place'
import { emptyFilter, type FilterState } from './ds/filterMeta'
import { estimateTileCount, estimateBytes, formatBytes, TILE_CAP } from './offline/OfflineAreaManager'

function getInitialZoomControls(): boolean {
  return localStorage.getItem('showZoomControls') !== 'false'
}

function getInitialLocateBtn(): boolean {
  return localStorage.getItem('showLocateBtn') !== 'false'
}

function getInitialBaseLayer(): BaseLayer {
  return localStorage.getItem('baseLayer') === 'satellite' ? 'satellite' : 'standard'
}

export type House = 'none' | 'gryffindor' | 'hufflepuff' | 'ravenclaw' | 'slytherin'

/** House accents chosen for contrast on the parchment palette */
export const HOUSE_COLORS: Record<Exclude<House, 'none'>, string> = {
  gryffindor: '#7F0909',
  hufflepuff: '#8C6B00',
  ravenclaw: '#222F5B',
  slytherin: '#1A472A',
}

function getInitialHouse(): House {
  const h = localStorage.getItem('house')
  return h === 'gryffindor' || h === 'hufflepuff' || h === 'ravenclaw' || h === 'slytherin' ? h : 'none'
}

/** Auto-stamp radius for the Marauder pass (km) */
const DISCOVERY_RADIUS_KM = 0.12

function customPlaceToHPLocation(p: CustomPlace): HPLocation {
  return {
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
    lat: p.lat,
    lng: p.lng,
  }
}

export default function App() {
  const { position, error, active, setActive } = useGeolocation()
  useWakeLock(active)
  const online = useNetworkStatus()

  const {
    areas: offlineAreas, status: offlineStatus, done: offlineDone,
    total: offlineTotal, error: offlineError,
    download: downloadOfflineArea, cancel: cancelOfflineDownload,
    remove: removeOfflineArea, rename: renameOfflineArea,
  } = useOfflineAreas()

  const { favouriteIds, toggleFavourite } = useFavourites()
  const { customPlaces, addCustomPlace, updateCustomPlace, removeCustomPlace } = useCustomPlaces()
  const { data: hpLocations, locations: hpLocationList, error: dataError } = useHPLocations()

  const [selectedLocation, setSelectedLocation] = useState<HPLocation | null>(null)
  const [selectedIsCustom, setSelectedIsCustom] = useState(false)
  // Marker and sheet are SEPARATE (Lene, 2026-07-06): closing the sheet by
  // tapping the map keeps the marker; a second tap on empty map clears it
  const [detailOpen, setDetailOpen] = useState(false)
  const [showZoomControls, setShowZoomControls] = useState(getInitialZoomControls)
  const [showLocateBtn, setShowLocateBtn] = useState(getInitialLocateBtn)
  // Long-press on the FAB temporarily hides/shows the map button group
  // (whatever is toggled on in Settings) — a quick declutter gesture
  const [mapButtonsHidden, setMapButtonsHidden] = useState(false)
  const [house, setHouse] = useState<House>(getInitialHouse)
  const [spell, setSpell] = useState<string | null>(null)
  const [showOath, setShowOath] = useState(true)
  const [quizOpen, setQuizOpen] = useState(false)
  const [funFactsOpen, setFunFactsOpen] = useState(false)
  const { visitedIds, toggleVisited, markVisited } = useVisited()

  // The oath — once per launch (the whole point of a Marauder's Map)
  useEffect(() => {
    setShowOath(true)
  }, [])

  // House accent as a CSS variable (spell text, pass progress, stamps)
  useEffect(() => {
    if (house === 'none') {
      document.documentElement.style.removeProperty('--house-accent')
    } else {
      document.documentElement.style.setProperty('--house-accent', HOUSE_COLORS[house])
    }
  }, [house])

  function handleHouseChange(h: House) {
    setHouse(h)
    safeSetItem('house', h)
  }
  const [baseLayer, setBaseLayer] = useState<BaseLayer>(getInitialBaseLayer)
  // Locate requested before the first GPS fix arrived — fly when it does
  const [pendingLocate, setPendingLocate] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<Array<[number, number]>>([])
  // Selected geocode result: pin + card stay until dismissed, replaced or saved
  // as a custom place — no auto-timeout (Google/Apple Maps pattern).
  const [geocodeMarker, setGeocodeMarker] = useState<{ lng: number; lat: number; name: string; detail: string } | null>(null)
  // Card is shown on pin tap only (Lene, 2026-07-05) — selection drops just the pin.
  const [showGeocodeCard, setShowGeocodeCard] = useState(false)
  const [pendingLongPress, setPendingLongPress] = useState<{ lng: number; lat: number; name?: string } | null>(null)
  const [editingPlace, setEditingPlace] = useState<CustomPlace | null>(null)
  // PRODUCT DECISION (Lene, 2026-07-05): the map starts EMPTY. POI markers
  // appear only for categories the user has CHECKED in the menu; unchecking
  // removes them. No checked categories = no markers. Do not change this.
  const [activeFilter, setActiveFilter] = useState<FilterState>(emptyFilter)
  // Hint chip: dismissed for this session (not persisted — returns next launch
  // until the user checks a category). Incrementing openToCategoriesSignal
  // causes MenuSheet to open itself on Hjem with categories expanded.
  const [hintDismissed, setHintDismissed] = useState(false)
  const [openToCategoriesSignal, setOpenToCategoriesSignal] = useState(0)
  // Per-favourite map visibility (shown-set: hearts are opt-in, map starts clean)
  const [shownFavouriteIds, setShownFavouriteIds] = useState<Set<string>>(new Set())
  // Per-place visibility for Mine steder (shown-set: nothing ticked by default,
  // Lene 2026-07-06 — but a freshly saved place is shown immediately)
  const [shownCustomIds, setShownCustomIds] = useState<Set<string>>(new Set())
  // Memoized on editingPlace?.id so a new object is not created on every
  // render while editing — the AddPlaceSheet effect resets the form on coords
  // identity change, and any App re-render (GPS tick, download progress…)
  // would otherwise wipe what the user has typed.
  const editingPlaceCoords = useMemo(
    () => editingPlace ? { lng: editingPlace.lng, lat: editingPlace.lat } : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingPlace?.id],
  )

  const mapRef = useRef<MapHandle>(null)

  // All user tags in use — offered as quick-add suggestions in the form
  const existingCustomTags = useMemo(() => {
    const set = new Set<string>()
    for (const p of customPlaces) for (const t of p.tags ?? []) set.add(t)
    return [...set].sort((a, b) => a.localeCompare(b, 'nb'))
  }, [customPlaces])

  const visibleCustomPlaces = useMemo(
    () => customPlaces.filter((p) => shownCustomIds.has(p.id)),
    [customPlaces, shownCustomIds],
  )

  const handleToggleCustomVisible = useCallback((id: string) => {
    setShownCustomIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleAllCustomVisible = useCallback(() => {
    setShownCustomIds((prev) =>
      customPlaces.length > 0 && customPlaces.every((p) => prev.has(p.id))
        ? new Set()
        : new Set(customPlaces.map((p) => p.id)),
    )
  }, [customPlaces])

  // Stable id list for the map's heart layer
  const favouriteMarkerIds = useMemo(() => [...shownFavouriteIds], [shownFavouriteIds])

  const handleToggleFavouriteVisible = useCallback((id: string) => {
    setShownFavouriteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleAllFavouritesVisible = useCallback(() => {
    setShownFavouriteIds((prev) =>
      favouriteIds.size > 0 && [...favouriteIds].every((id) => prev.has(id))
        ? new Set()
        : new Set(favouriteIds),
    )
  }, [favouriteIds])

  const getAreaEstimate = useCallback(() => {
    const bounds = mapRef.current?.getBounds()
    if (!bounds) return null
    const count = estimateTileCount(bounds)
    if (count > TILE_CAP) return null
    return { count, sizeStr: formatBytes(estimateBytes(count)) }
  }, [])

  function handleDownloadVisibleArea() {
    const bounds = mapRef.current?.getBounds()
    if (!bounds) return
    const count = estimateTileCount(bounds)
    if (count > TILE_CAP) {
      alert(
        `Området er for stort (ca. ${count.toLocaleString('nb')} kartfliser).\nZoom inn og prøv igjen.`,
      )
      return
    }
    const sizeStr = formatBytes(estimateBytes(count))
    if (!confirm(
      `Last ned ca. ${count.toLocaleString('nb')} kartfliser (${sizeStr}) for offline bruk?\nDette kan ta noen minutter.`,
    )) return
    const name = `Område ${offlineAreas.length + 1}`
    const centerLat = (bounds.south + bounds.north) / 2
    const centerLng = (bounds.west + bounds.east) / 2
    void downloadOfflineArea(name, bounds).then((areaId) => {
      if (!areaId) return
      void fetch(
        `https://photon.komoot.io/reverse?lat=${centerLat}&lon=${centerLng}&limit=1`,
      )
        .then((r) => r.json())
        .then((data: unknown) => {
          const props = (data as { features?: Array<{ properties?: Record<string, string> }> })
            ?.features?.[0]?.properties
          if (!props) return
          const geocodedName = props['city'] ?? props['county'] ?? props['state'] ?? props['name'] ?? null
          if (geocodedName) renameOfflineArea(areaId, geocodedName)
        })
        .catch(() => {})
    })
  }

  const handleLocationSelect = useCallback((loc: HPLocation) => {
    // Offset upwards so the marker sits in the visible upper part while the
    // detail sheet (33 % height) covers the bottom
    mapRef.current?.flyTo(loc.lng, loc.lat, 13, -Math.round(window.innerHeight * 0.16))
    setSelectedLocation(loc)
    setSelectedIsCustom(false)
    setDetailOpen(true)
  }, [])

  const handleCustomPlaceClick = useCallback((id: string) => {
    const p = customPlaces.find((cp) => cp.id === id)
    if (!p) return
    mapRef.current?.flyTo(p.lng, p.lat, 13, -Math.round(window.innerHeight * 0.16))
    setSelectedLocation(customPlaceToHPLocation(p))
    setSelectedIsCustom(true)
    setDetailOpen(true)
  }, [customPlaces])

  // Drag-down/Escape: close the sheet, keep the marker
  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false)
  }, [])

  // Tap on empty map: first close the sheet, then (next tap) clear the marker.
  // Reads detailOpen via ref to avoid a side-effecting setState updater.
  const detailOpenRef = useRef(false)
  useEffect(() => { detailOpenRef.current = detailOpen }, [detailOpen])

  const handleMapClick = useCallback(() => {
    if (detailOpenRef.current) {
      setDetailOpen(false)
    } else {
      setSelectedLocation(null)
      setSelectedIsCustom(false)
    }
  }, [])

  function handleToggleZoomControls(v: boolean) {
    setShowZoomControls(v)
    safeSetItem('showZoomControls', String(v))
  }

  function handleToggleLocateBtn(v: boolean) {
    setShowLocateBtn(v)
    safeSetItem('showLocateBtn', String(v))
  }

  function handleBaseLayerChange(layer: BaseLayer) {
    setBaseLayer(layer)
    safeSetItem('baseLayer', layer)
  }

  const handleBaseLayerFailed = useCallback((failedLayer: BaseLayer) => {
    const prev: BaseLayer = failedLayer === 'satellite' ? 'standard' : 'satellite'
    setBaseLayer(prev)
    safeSetItem('baseLayer', prev)
  }, [])

  const handleLocate = useCallback(() => {
    if (position) {
      mapRef.current?.flyTo(position.lng, position.lat, 14)
      return
    }
    // GPS off or no fix yet: switch it on and fly when the fix arrives
    setActive(true)
    setPendingLocate(true)
  }, [position, setActive])

  useEffect(() => {
    if (pendingLocate && position) {
      setPendingLocate(false)
      mapRef.current?.flyTo(position.lng, position.lat, 14)
    }
  }, [pendingLocate, position])

  // Marauder pass auto-discovery: walking within ~120 m of an unvisited HP
  // place stamps it and casts a small notice
  useEffect(() => {
    if (!position || !hpLocationList) return
    for (const loc of hpLocationList) {
      if (visitedIds.has(loc.id)) continue
      if (haversineKm(position.lat, position.lng, loc.lat, loc.lng) <= DISCOVERY_RADIUS_KM) {
        markVisited(loc.id)
        setSpell(`Oppdaget: ${loc.name}`)
        break // one stamp per fix — no message spam
      }
    }
  }, [position, hpLocationList, visitedIds, markVisited])

  const handleToggleGps = useCallback(() => {
    setActive((a) => {
      if (a) setSpell('Mischief managed')
      return !a
    })
  }, [setActive])

  function handleToggleMeasure() {
    setMeasureMode((m) => {
      if (m) setMeasurePoints([])
      return !m
    })
  }

  function handleMeasurePoint(lng: number, lat: number) {
    setMeasurePoints((pts) => [...pts, [lng, lat]])
  }

  function handleUndoMeasurePoint() {
    setMeasurePoints((pts) => pts.slice(0, -1))
  }

  function handleAddressSelect(lng: number, lat: number, name: string, detail: string) {
    // Zoom 16: an address selection means "show me this exact place" —
    // street level, not the region overview the default zoom gives.
    mapRef.current?.flyTo(lng, lat, 16)
    setGeocodeMarker({ lng, lat, name, detail })
    setShowGeocodeCard(false)
  }

  function handleSaveGeocodeAsPlace() {
    if (!geocodeMarker) return
    setShowGeocodeCard(false)
    setPendingLongPress({ lng: geocodeMarker.lng, lat: geocodeMarker.lat, name: geocodeMarker.name })
  }

  function handleRemoveGeocodePin() {
    setGeocodeMarker(null)
    setShowGeocodeCard(false)
  }

  function handleLongPress(lng: number, lat: number) {
    setPendingLongPress({ lng, lat })
  }

  function handleSaveCustomPlace(name: string, description: string, tags: string[]) {
    if (editingPlace) {
      updateCustomPlace(editingPlace.id, { name, description, tags })
      setEditingPlace(null)
      return
    }
    if (!pendingLongPress) return
    const p = addCustomPlace({
      name,
      description,
      tags,
      lat: pendingLongPress.lat,
      lng: pendingLongPress.lng,
    })
    setPendingLongPress(null)
    // Saved as a custom place: the geocode pin has served its purpose, and the
    // fresh place is shown on the map right away
    setShownCustomIds((prev) => new Set(prev).add(p.id))
    setGeocodeMarker(null)
    setShowGeocodeCard(false)
    mapRef.current?.flyTo(p.lng, p.lat)
  }

  function handleEditCustomPlace(id: string) {
    const p = customPlaces.find((cp) => cp.id === id)
    if (!p) return
    setSelectedLocation(null)
    setSelectedIsCustom(false)
    setDetailOpen(false)
    setEditingPlace(p)
  }

  return (
    <>
      <AppHeader house={house} />
      {/* Quiet offline indicator on the map surface — being offline is the
          normal state on the train, the user should not have to open Settings
          to know it (D12) */}
      {!online && (
        <div className="offline-chip" role="status">Frakoblet</div>
      )}
      {!hintDismissed && activeFilter.categories.length === 0 && !selectedLocation && (
        <div className="map-hint-chip">
          <button
            type="button"
            className="map-hint-chip__action"
            onClick={() => setOpenToCategoriesSignal((n) => n + 1)}
          >
            Velg kategorier i menyen for å se steder på kartet
          </button>
          <button
            type="button"
            className="map-hint-chip__dismiss"
            onClick={() => setHintDismissed(true)}
            aria-label="Skjul tips"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
      <InstallBanner />
      <MapView
        ref={mapRef}
        position={position}
        onLocationSelect={handleLocationSelect}
        showZoomControls={showZoomControls && !mapButtonsHidden}
        showLocateBtn={showLocateBtn && !mapButtonsHidden}
        onLocate={handleLocate}
        mapMode={measureMode ? 'measure' : 'browse'}
        measurePoints={measurePoints}
        onMeasurePoint={handleMeasurePoint}
        customPlaces={visibleCustomPlaces}
        onCustomPlaceClick={handleCustomPlaceClick}
        onLongPress={handleLongPress}
        geocodeMarker={geocodeMarker}
        onGeocodeMarkerClick={() => setShowGeocodeCard((v) => !v)}
        onMapClick={handleMapClick}
        baseLayer={baseLayer}
        onBaseLayerFailed={handleBaseLayerFailed}
        selectedLocation={selectedLocation}
        activeFilter={activeFilter}
        favouriteMarkerIds={favouriteMarkerIds}
        hpLocations={hpLocations}
      />
      {measureMode && (
        <MeasureBar
          points={measurePoints}
          onClear={() => setMeasurePoints([])}
          onUndo={handleUndoMeasurePoint}
          onClose={handleToggleMeasure}
        />
      )}
      <MenuSheet
        position={position}
        active={active}
        error={error}
        onToggle={handleToggleGps}
        visitedCount={visitedIds.size}
        visitedIds={visitedIds}
        totalPlaces={hpLocationList?.length ?? 0}
        house={house}
        onHouseChange={handleHouseChange}
        onOpenQuiz={() => setQuizOpen(true)}
        onOpenFunFacts={() => setFunFactsOpen(true)}
        measureMode={measureMode}
        onToggleMeasure={handleToggleMeasure}
        onAddressSelect={handleAddressSelect}
        onLocationSelect={handleLocationSelect}
        favouriteIds={favouriteIds}
        hpLocations={hpLocationList ?? []}
        customPlaces={customPlaces}
        onCustomPlaceClick={handleCustomPlaceClick}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        shownFavouriteIds={shownFavouriteIds}
        onToggleFavouriteVisible={handleToggleFavouriteVisible}
        onToggleAllFavouritesVisible={handleToggleAllFavouritesVisible}
        onFabLongPress={() => setMapButtonsHidden((v) => {
          setSpell(v ? 'Kartknapper synlige' : 'Kartknapper skjult – hold inne for å vise')
          return !v
        })}
        openToCategoriesSignal={openToCategoriesSignal}
        shownCustomIds={shownCustomIds}
        onToggleCustomVisible={handleToggleCustomVisible}
        onToggleAllCustomVisible={handleToggleAllCustomVisible}
        showZoomControls={showZoomControls}
        onToggleZoomControls={handleToggleZoomControls}
        showLocateBtn={showLocateBtn}
        onToggleLocateBtn={handleToggleLocateBtn}
        baseLayer={baseLayer}
        onBaseLayerChange={handleBaseLayerChange}
        offlineAreas={offlineAreas}
        offlineStatus={offlineStatus}
        offlineDone={offlineDone}
        offlineTotal={offlineTotal}
        offlineError={offlineError}
        getAreaEstimate={getAreaEstimate}
        onDownloadVisibleArea={handleDownloadVisibleArea}
        onCancelDownload={cancelOfflineDownload}
        onDeleteArea={removeOfflineArea}
        online={online}
        dataError={dataError}
      />
      <POIDetailSheet
        location={detailOpen ? selectedLocation : null}
        onClose={handleCloseDetail}
        isFavourite={selectedLocation ? favouriteIds.has(selectedLocation.id) : false}
        onToggleFavourite={toggleFavourite}
        isCustomPlace={selectedIsCustom}
        onDeleteCustomPlace={(id) => {
          removeCustomPlace(id)
          setSelectedLocation(null)
          setSelectedIsCustom(false)
        }}
        onEditCustomPlace={handleEditCustomPlace}
        isVisited={selectedLocation ? visitedIds.has(selectedLocation.id) : false}
        onToggleVisited={toggleVisited}
        online={online}
      />
      {geocodeMarker && showGeocodeCard && (
        <GeocodeCard
          name={geocodeMarker.name}
          detail={geocodeMarker.detail}
          onSave={handleSaveGeocodeAsPlace}
          onRemove={handleRemoveGeocodePin}
          onClose={() => setShowGeocodeCard(false)}
        />
      )}
      <AddPlaceSheet
        coords={editingPlaceCoords ?? pendingLongPress}
        initialName={editingPlace ? editingPlace.name : pendingLongPress?.name}
        initialDescription={editingPlace?.description}
        initialTags={editingPlace?.tags}
        existingTags={existingCustomTags}
        title={editingPlace ? 'Rediger sted' : 'Legg til sted'}
        onSave={handleSaveCustomPlace}
        onClose={() => { setPendingLongPress(null); setEditingPlace(null) }}
      />
      <QuizSheet open={quizOpen} onClose={() => setQuizOpen(false)} />
      <FunFactsSheet open={funFactsOpen} onClose={() => setFunFactsOpen(false)} />
      <SpellOverlay message={spell} onDone={() => setSpell(null)} />
      <OathSplash open={showOath} onDone={() => setShowOath(false)} />
    </>
  )
}
