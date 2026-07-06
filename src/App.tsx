import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
import QuizSheet from './components/QuizSheet'
import { useVisited } from './hooks/useVisited'
import { haversineKm } from './utils/distance'
import type { HPLocation } from './types/hp-location'
import type { CustomPlace } from './types/custom-place'
import { emptyFilter, type FilterState } from './ds/filterMeta'

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
    download: downloadOfflineArea, cancel: cancelOfflineDownload, remove: removeOfflineArea,
  } = useOfflineAreas()

  const { favouriteIds, toggleFavourite } = useFavourites()
  const { customPlaces, addCustomPlace, updateCustomPlace, removeCustomPlace } = useCustomPlaces()
  const { data: hpLocations, locations: hpLocationList, error: dataError } = useHPLocations()

  const [selectedLocation, setSelectedLocation] = useState<HPLocation | null>(null)
  const [selectedIsCustom, setSelectedIsCustom] = useState(false)
  const [showZoomControls, setShowZoomControls] = useState(getInitialZoomControls)
  const [showLocateBtn, setShowLocateBtn] = useState(getInitialLocateBtn)
  // Long-press on the FAB temporarily hides/shows the map button group
  // (whatever is toggled on in Settings) — a quick declutter gesture
  const [mapButtonsHidden, setMapButtonsHidden] = useState(false)
  const [house, setHouse] = useState<House>(getInitialHouse)
  const [spell, setSpell] = useState<string | null>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  const { visitedIds, toggleVisited, markVisited } = useVisited()

  // The oath — once per launch (the whole point of a Marauder's Map)
  useEffect(() => {
    setSpell('I solemnly swear that I am up to no good')
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
    localStorage.setItem('house', h)
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
  // Per-favourite map visibility (shown-set: hearts are opt-in, map starts clean)
  const [shownFavouriteIds, setShownFavouriteIds] = useState<Set<string>>(new Set())
  // Per-place visibility for Mine steder (hidden-set: new places show by default)
  const [hiddenCustomIds, setHiddenCustomIds] = useState<Set<string>>(new Set())
  const mapRef = useRef<MapHandle>(null)

  // All user tags in use — offered as quick-add suggestions in the form
  const existingCustomTags = useMemo(() => {
    const set = new Set<string>()
    for (const p of customPlaces) for (const t of p.tags ?? []) set.add(t)
    return [...set].sort((a, b) => a.localeCompare(b, 'nb'))
  }, [customPlaces])

  const visibleCustomPlaces = useMemo(
    () => customPlaces.filter((p) => !hiddenCustomIds.has(p.id)),
    [customPlaces, hiddenCustomIds],
  )

  const handleToggleCustomVisible = useCallback((id: string) => {
    setHiddenCustomIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleAllCustomVisible = useCallback(() => {
    setHiddenCustomIds((prev) =>
      prev.size === 0 ? new Set(customPlaces.map((p) => p.id)) : new Set(),
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
      prev.size === favouriteIds.size && favouriteIds.size > 0
        ? new Set()
        : new Set(favouriteIds),
    )
  }, [favouriteIds])

  function handleDownloadVisibleArea() {
    const bounds = mapRef.current?.getBounds()
    if (!bounds) return
    const name = `Område ${offlineAreas.length + 1}`
    void downloadOfflineArea(name, bounds)
  }

  const handleLocationSelect = useCallback((loc: HPLocation) => {
    // Offset upwards so the marker sits in the visible upper part while the
    // detail sheet (33 % height) covers the bottom
    mapRef.current?.flyTo(loc.lng, loc.lat, 13, -Math.round(window.innerHeight * 0.16))
    setSelectedLocation(loc)
    setSelectedIsCustom(false)
  }, [])

  const handleCustomPlaceClick = useCallback((id: string) => {
    const p = customPlaces.find((cp) => cp.id === id)
    if (!p) return
    setSelectedLocation(customPlaceToHPLocation(p))
    setSelectedIsCustom(true)
  }, [customPlaces])

  const handleCloseDetail = useCallback(() => {
    setSelectedLocation(null)
    setSelectedIsCustom(false)
  }, [])

  function handleToggleZoomControls(v: boolean) {
    setShowZoomControls(v)
    localStorage.setItem('showZoomControls', String(v))
  }

  function handleToggleLocateBtn(v: boolean) {
    setShowLocateBtn(v)
    localStorage.setItem('showLocateBtn', String(v))
  }

  function handleBaseLayerChange(layer: BaseLayer) {
    setBaseLayer(layer)
    localStorage.setItem('baseLayer', layer)
  }

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
    // Saved as a custom place: the geocode pin has served its purpose
    setGeocodeMarker(null)
    setShowGeocodeCard(false)
    mapRef.current?.flyTo(p.lng, p.lat)
  }

  function handleEditCustomPlace(id: string) {
    const p = customPlaces.find((cp) => cp.id === id)
    if (!p) return
    setSelectedLocation(null)
    setSelectedIsCustom(false)
    setEditingPlace(p)
  }

  return (
    <>
      <AppHeader />
      {/* Quiet offline indicator on the map surface — being offline is the
          normal state on the train, the user should not have to open Settings
          to know it (D12) */}
      {!online && (
        <div className="offline-chip" role="status">Frakoblet</div>
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
        onMapClick={handleCloseDetail}
        baseLayer={baseLayer}
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
        totalPlaces={hpLocationList?.length ?? 0}
        house={house}
        onHouseChange={handleHouseChange}
        onOpenQuiz={() => setQuizOpen(true)}
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
        onFabLongPress={() => setMapButtonsHidden((v) => !v)}
        hiddenCustomIds={hiddenCustomIds}
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
        onDownloadVisibleArea={handleDownloadVisibleArea}
        onCancelDownload={cancelOfflineDownload}
        onDeleteArea={removeOfflineArea}
        online={online}
        dataError={dataError}
      />
      <POIDetailSheet
        location={selectedLocation}
        onClose={handleCloseDetail}
        isFavourite={selectedLocation ? favouriteIds.has(selectedLocation.id) : false}
        onToggleFavourite={toggleFavourite}
        isCustomPlace={selectedIsCustom}
        onDeleteCustomPlace={removeCustomPlace}
        onEditCustomPlace={handleEditCustomPlace}
        isVisited={selectedLocation ? visitedIds.has(selectedLocation.id) : false}
        onToggleVisited={toggleVisited}
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
        coords={editingPlace ? { lng: editingPlace.lng, lat: editingPlace.lat } : pendingLongPress}
        initialName={editingPlace ? editingPlace.name : pendingLongPress?.name}
        initialDescription={editingPlace?.description}
        initialTags={editingPlace?.tags}
        existingTags={existingCustomTags}
        title={editingPlace ? 'Rediger sted' : 'Legg til sted'}
        onSave={handleSaveCustomPlace}
        onClose={() => { setPendingLongPress(null); setEditingPlace(null) }}
      />
      <QuizSheet open={quizOpen} onClose={() => setQuizOpen(false)} />
      <SpellOverlay message={spell} onDone={() => setSpell(null)} />
    </>
  )
}
