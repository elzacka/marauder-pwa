import { useState, useEffect, useRef, useCallback } from 'react'
import { useGeolocation } from './hooks/useGeolocation'
import { useWakeLock } from './hooks/useWakeLock'
import { useOfflineTiles } from './hooks/useOfflineTiles'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useFavourites } from './hooks/useFavourites'
import { useCustomPlaces } from './hooks/useCustomPlaces'
import { getOfflineFile } from './offline/OfflineMapManager'
import MapView, { type MapHandle } from './map/MapView'
import NearbySheet from './components/NearbySheet'
import POIDetailSheet from './components/POIDetailSheet'
import SettingsSheet from './components/SettingsSheet'
import MeasureBar from './components/MeasureBar'
import AddPlaceSheet from './components/AddPlaceSheet'
import InstallBanner from './components/InstallBanner'
import AppHeader from './components/AppHeader'
import type { HPLocation } from './types/hp-location'
import type { CustomPlace } from './types/custom-place'

const PMTILES_URL = import.meta.env.VITE_PMTILES_URL as string | undefined

function getInitialZoomControls(): boolean {
  return localStorage.getItem('showZoomControls') !== 'false'
}

function customPlaceToHPLocation(p: CustomPlace): HPLocation {
  return {
    id: p.id,
    name: p.name,
    location_type: 'interpreted',
    category: 'other_wizarding',
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

  const [offlineFile, setOfflineFile] = useState<File | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<HPLocation | null>(null)
  const [selectedIsCustom, setSelectedIsCustom] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showZoomControls, setShowZoomControls] = useState(getInitialZoomControls)
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<Array<[number, number]>>([])
  const [geocodeMarker, setGeocodeMarker] = useState<{ lng: number; lat: number } | null>(null)
  const [pendingLongPress, setPendingLongPress] = useState<{ lng: number; lat: number } | null>(null)
  const [showOnlyFavourites, setShowOnlyFavourites] = useState(false)
  const mapRef = useRef<MapHandle>(null)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (status === 'ready') {
      getOfflineFile().then((f) => setOfflineFile(f ?? null))
    } else if (status === 'none') {
      setOfflineFile(null)
    }
  }, [status])

  const handleLocationSelect = useCallback((loc: HPLocation) => {
    setSelectedLocation(loc)
    setSelectedIsCustom(false)
    mapRef.current?.flyTo(loc.lng, loc.lat)
  }, [])

  const handleCustomPlaceClick = useCallback((id: string) => {
    const p = customPlaces.find((cp) => cp.id === id)
    if (!p) return
    setSelectedLocation(customPlaceToHPLocation(p))
    setSelectedIsCustom(true)
    mapRef.current?.flyTo(p.lng, p.lat)
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
    setMeasurePoints((pts) => {
      if (pts.length >= 2) return [[lng, lat]]
      return [...pts, [lng, lat]]
    })
  }

  function handleAddressSelect(lng: number, lat: number) {
    mapRef.current?.flyTo(lng, lat)
    setGeocodeMarker({ lng, lat })
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    geocodeTimerRef.current = setTimeout(() => {
      geocodeTimerRef.current = null
      setGeocodeMarker(null)
    }, 8000)
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
    mapRef.current?.flyTo(p.lng, p.lat)
  }

  return (
    <>
      <InstallBanner />
      <AppHeader />
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
      />
      {measureMode && (
        <MeasureBar
          points={measurePoints}
          onClear={() => setMeasurePoints([])}
          onClose={handleToggleMeasure}
        />
      )}
      <NearbySheet
        position={position}
        active={active}
        error={error}
        onToggle={() => setActive((a) => !a)}
        onLocationSelect={handleLocationSelect}
        onSettingsClick={() => setSettingsOpen(true)}
        measureMode={measureMode}
        onToggleMeasure={handleToggleMeasure}
        onAddressSelect={handleAddressSelect}
        favouriteIds={favouriteIds}
        showOnlyFavourites={showOnlyFavourites}
        onToggleFavourites={() => setShowOnlyFavourites((v) => !v)}
        customPlaces={customPlaces}
        onCustomPlaceClick={handleCustomPlaceClick}
      />
      <POIDetailSheet
        location={selectedLocation}
        onClose={handleCloseDetail}
        isFavourite={selectedLocation ? favouriteIds.has(selectedLocation.id) : false}
        onToggleFavourite={toggleFavourite}
        isCustomPlace={selectedIsCustom}
        onDeleteCustomPlace={removeCustomPlace}
      />
      <AddPlaceSheet
        coords={pendingLongPress}
        onSave={handleSaveCustomPlace}
        onClose={() => setPendingLongPress(null)}
      />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
    </>
  )
}
