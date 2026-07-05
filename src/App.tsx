import { useState, useRef, useCallback, useMemo } from 'react'
import { useGeolocation } from './hooks/useGeolocation'
import { useWakeLock } from './hooks/useWakeLock'
import { useOfflineAreas } from './hooks/useOfflineAreas'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useFavourites } from './hooks/useFavourites'
import { useCustomPlaces } from './hooks/useCustomPlaces'
import { useHPLocations } from './hooks/useHPLocations'
import MapView, { type MapHandle } from './map/MapView'
import MenuSheet from './components/MenuSheet'
import POIDetailSheet from './components/POIDetailSheet'
import MeasureBar from './components/MeasureBar'
import AddPlaceSheet from './components/AddPlaceSheet'
import InstallBanner from './components/InstallBanner'
import GeocodeCard from './components/GeocodeCard'
import AppHeader from './components/AppHeader'
import type { HPLocation } from './types/hp-location'
import type { CustomPlace } from './types/custom-place'
import { emptyFilter, type FilterState } from './ds/filterMeta'

function getInitialZoomControls(): boolean {
  return localStorage.getItem('showZoomControls') !== 'false'
}

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
    country: null,
    city: null,
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
  // "Alle" over favourites: show every favourite as a map marker in one tap
  const [favouritesOnMap, setFavouritesOnMap] = useState(false)
  const mapRef = useRef<MapHandle>(null)

  // Stable id list for the map filter; empty when the toggle is off
  const favouriteMarkerIds = useMemo(
    () => (favouritesOnMap ? [...favouriteIds] : []),
    [favouritesOnMap, favouriteIds],
  )

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

  function handleSaveCustomPlace(name: string, description: string) {
    if (editingPlace) {
      updateCustomPlace(editingPlace.id, { name, description })
      setEditingPlace(null)
      return
    }
    if (!pendingLongPress) return
    const p = addCustomPlace({
      name,
      description,
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
        showZoomControls={showZoomControls}
        mapMode={measureMode ? 'measure' : 'browse'}
        measurePoints={measurePoints}
        onMeasurePoint={handleMeasurePoint}
        customPlaces={customPlaces}
        onCustomPlaceClick={handleCustomPlaceClick}
        onLongPress={handleLongPress}
        geocodeMarker={geocodeMarker}
        onGeocodeMarkerClick={() => setShowGeocodeCard((v) => !v)}
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
        onToggle={() => setActive((a) => !a)}
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
        favouritesOnMap={favouritesOnMap}
        onToggleFavouritesOnMap={() => setFavouritesOnMap((v) => !v)}
        showZoomControls={showZoomControls}
        onToggleZoomControls={handleToggleZoomControls}
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
        title={editingPlace ? 'Rediger sted' : 'Legg til sted'}
        onSave={handleSaveCustomPlace}
        onClose={() => { setPendingLongPress(null); setEditingPlace(null) }}
      />
    </>
  )
}
