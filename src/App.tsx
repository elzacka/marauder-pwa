import { useState, useEffect, useRef, useCallback } from 'react'
import { useGeolocation } from './hooks/useGeolocation'
import { useWakeLock } from './hooks/useWakeLock'
import { useOfflineTiles } from './hooks/useOfflineTiles'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useFavourites } from './hooks/useFavourites'
import { useCustomPlaces } from './hooks/useCustomPlaces'
import { useHPLocations } from './hooks/useHPLocations'
import { getOfflineFile } from './offline/OfflineMapManager'
import MapView, { type MapHandle } from './map/MapView'
import MenuSheet from './components/MenuSheet'
import POIDetailSheet from './components/POIDetailSheet'
import MeasureBar from './components/MeasureBar'
import AddPlaceSheet from './components/AddPlaceSheet'
import InstallBanner from './components/InstallBanner'
import GeocodeCard from './components/GeocodeCard'
import type { HPLocation } from './types/hp-location'
import type { CustomPlace } from './types/custom-place'
import type { FilterState } from './ds/filterMeta'

const PMTILES_URL = import.meta.env.VITE_PMTILES_URL as string | undefined

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
    lat: p.lat,
    lng: p.lng,
  }
}

export default function App() {
  const { position, error, active, setActive } = useGeolocation()
  useWakeLock(active)
  const online = useNetworkStatus()

  const { status, downloaded, total, error: dlError, download, cancel, remove } =
    useOfflineTiles(PMTILES_URL ?? '')

  const { favouriteIds, toggleFavourite } = useFavourites()
  const { customPlaces, addCustomPlace, removeCustomPlace } = useCustomPlaces()
  const { data: hpLocations, locations: hpLocationList } = useHPLocations()

  const [offlineFile, setOfflineFile] = useState<File | null>(null)
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
  // Default: show all HP dots on first paint — the map's whole purpose is showing them.
  // The filter narrows the view; it is not a gate for seeing anything at all.
  const [activeFilter, setActiveFilter] = useState<FilterState | null>({ category: 'all', locationType: 'all' })
  const mapRef = useRef<MapHandle>(null)

  useEffect(() => {
    if (status === 'ready') {
      getOfflineFile().then((f) => setOfflineFile(f ?? null))
    } else if (status === 'none') {
      setOfflineFile(null)
    }
  }, [status])

  const handleLocationSelect = useCallback((loc: HPLocation) => {
    mapRef.current?.flyTo(loc.lng, loc.lat)
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

  return (
    <>
      <InstallBanner />
      <MapView
        ref={mapRef}
        position={position}
        offlineFile={offlineFile}
        pmtilesUrl={PMTILES_URL}
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
        showZoomControls={showZoomControls}
        onToggleZoomControls={handleToggleZoomControls}
        pmtilesEnabled={!!PMTILES_URL}
        offlineStatus={status}
        downloaded={downloaded}
        total={total}
        offlineError={dlError}
        onDownload={download}
        onCancel={cancel}
        onDelete={remove}
        online={online}
      />
      <POIDetailSheet
        location={selectedLocation}
        onClose={handleCloseDetail}
        isFavourite={selectedLocation ? favouriteIds.has(selectedLocation.id) : false}
        onToggleFavourite={toggleFavourite}
        isCustomPlace={selectedIsCustom}
        onDeleteCustomPlace={removeCustomPlace}
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
        coords={pendingLongPress}
        initialName={pendingLongPress?.name}
        onSave={handleSaveCustomPlace}
        onClose={() => setPendingLongPress(null)}
      />
    </>
  )
}
