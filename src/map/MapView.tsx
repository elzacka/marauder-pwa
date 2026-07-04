import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { Protocol, PMTiles, FileSource } from 'pmtiles'
import { layers, namedFlavor } from '@protomaps/basemaps'
import type { FeatureCollection, Feature, Polygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Position } from '../hooks/useGeolocation'
import type { HPLocation, LocationType, LocationCategory } from '../types/hp-location'
import type { CustomPlace } from '../types/custom-place'
import hpLocationsData from '../data/hp-locations.json'
import styles from './MapView.module.css'

const hpLocations = hpLocationsData as unknown as FeatureCollection

const VIEW_BOUNDS: maplibregl.LngLatBoundsLike = [[-13.0, 48.0], [3.5, 62.0]]

const FLY_BOUNDS = { west: -11.5, east: 2.5, south: 49.0, north: 61.5 }

const MASK_HOLE = [
  [-11.5, 48.5], [2.5, 48.5], [2.5, 61.5], [-11.5, 61.5], [-11.5, 48.5],
]

const worldMask: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]],
      MASK_HOLE,
    ],
  },
}

const pmtilesProtocol = new Protocol()
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile)

const HP_PAINT: maplibregl.CircleLayerSpecification['paint'] = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 7, 12, 12],
  'circle-color': [
    'match', ['get', 'location_type'],
    'filming',     '#5C1010',
    'canonical',   '#9E6B1A',
    'interpreted', '#4A3B6B',
    '#5C1010',
  ],
  'circle-stroke-width': 2,
  'circle-stroke-color': '#E8D5AA',
  'circle-opacity': 0.92,
}

function buildStyle(tilesUrl: string): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${tilesUrl}`,
        attribution: '',
      },
    },
    layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }) as maplibregl.LayerSpecification[],
  }
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

function addOverlays(
  map: maplibregl.Map,
  onLocationSelectRef: React.MutableRefObject<((loc: HPLocation) => void) | undefined>,
  onCustomPlaceClickRef: React.MutableRefObject<((id: string) => void) | undefined>,
) {
  // World parchment mask
  map.addSource('world-mask', { type: 'geojson', data: worldMask })
  map.addLayer({
    id: 'world-mask-fill',
    type: 'fill',
    source: 'world-mask',
    paint: { 'fill-color': '#EAD8AE', 'fill-opacity': 0.72 },
  })

  // HP locations
  map.addSource('hp-locations', { type: 'geojson', data: hpLocations })
  map.addLayer({ id: 'hp-dots', type: 'circle', source: 'hp-locations', paint: HP_PAINT })

  map.on('click', 'hp-dots', (e) => {
    if (!e.features?.length || !onLocationSelectRef.current) return
    const feat = e.features[0]
    const props = feat.properties
    const geom = feat.geometry
    if (geom.type !== 'Point') return
    const refs = typeof props.hp_references === 'string'
      ? (JSON.parse(props.hp_references) as string[])
      : (props.hp_references as string[])
    onLocationSelectRef.current({
      id: props.id as string,
      name: props.name as string,
      location_type: props.location_type as LocationType,
      category: props.category as LocationCategory,
      hp_references: refs,
      description: props.description as string,
      source: props.source as string,
      external_url: props.external_url as string | null,
      lat: geom.coordinates[1],
      lng: geom.coordinates[0],
    })
  })
  map.on('mouseenter', 'hp-dots', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'hp-dots', () => { map.getCanvas().style.cursor = '' })

  // Custom places
  map.addSource('custom-places', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({
    id: 'custom-place-dots',
    type: 'circle',
    source: 'custom-places',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 7, 12, 11],
      'circle-color': '#2E6B3E',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#E8D5AA',
      'circle-opacity': 0.9,
    },
  })
  map.on('click', 'custom-place-dots', (e) => {
    if (!e.features?.length || !onCustomPlaceClickRef.current) return
    const id = e.features[0].properties?.id as string | undefined
    if (id) onCustomPlaceClickRef.current(id)
  })
  map.on('mouseenter', 'custom-place-dots', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'custom-place-dots', () => { map.getCanvas().style.cursor = '' })

  // Measure overlay sources (empty at init)
  map.addSource('measure-points', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({
    id: 'measure-point-circles',
    type: 'circle',
    source: 'measure-points',
    paint: {
      'circle-radius': 8,
      'circle-color': '#9E6B1A',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#E8D5AA',
    },
  })

  map.addSource('measure-line', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({
    id: 'measure-line-layer',
    type: 'line',
    source: 'measure-line',
    paint: {
      'line-color': '#9E6B1A',
      'line-width': 2,
      'line-dasharray': [5, 4],
    },
  })
}

export type MapHandle = {
  flyTo: (lng: number, lat: number) => void
}

export type MapMode = 'browse' | 'measure'

type Props = {
  position: Position | null
  offlineFile?: File | null
  pmtilesUrl?: string
  onLocationSelect?: (loc: HPLocation) => void
  showZoomControls?: boolean
  mapMode?: MapMode
  measurePoints?: Array<[number, number]>
  onMeasurePoint?: (lng: number, lat: number) => void
  customPlaces?: CustomPlace[]
  onCustomPlaceClick?: (id: string) => void
  onLongPress?: (lng: number, lat: number) => void
  geocodeMarker?: { lng: number; lat: number } | null
}

const MapView = forwardRef<MapHandle, Props>(function MapView(props, ref) {
  const {
    position, offlineFile, pmtilesUrl, onLocationSelect, showZoomControls = true,
    mapMode = 'browse', measurePoints = [], onMeasurePoint,
    customPlaces = [], onCustomPlaceClick,
    onLongPress, geocodeMarker,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const geocodeMarkerRef = useRef<maplibregl.Marker | null>(null)
  const navControlRef = useRef<maplibregl.NavigationControl | null>(null)
  const firstPositionRef = useRef(false)
  const offlineRegisteredRef = useRef(false)

  const onLocationSelectRef = useRef(onLocationSelect)
  useEffect(() => { onLocationSelectRef.current = onLocationSelect }, [onLocationSelect])
  const onCustomPlaceClickRef = useRef(onCustomPlaceClick)
  useEffect(() => { onCustomPlaceClickRef.current = onCustomPlaceClick }, [onCustomPlaceClick])
  const onMeasurePointRef = useRef(onMeasurePoint)
  useEffect(() => { onMeasurePointRef.current = onMeasurePoint }, [onMeasurePoint])
  const onLongPressRef = useRef(onLongPress)
  useEffect(() => { onLongPressRef.current = onLongPress }, [onLongPress])
  const mapModeRef = useRef(mapMode)
  useEffect(() => { mapModeRef.current = mapMode }, [mapMode])

  const flyTo = useCallback((lng: number, lat: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 13, duration: 700 })
  }, [])
  useImperativeHandle(ref, () => ({ flyTo }), [flyTo])

  const showZoomControlsRef = useRef(showZoomControls)
  useEffect(() => {
    showZoomControlsRef.current = showZoomControls
    const map = mapRef.current
    const ctrl = navControlRef.current
    if (!map || !ctrl) return
    if (showZoomControls) {
      try { map.addControl(ctrl, 'bottom-right') } catch { /* already added */ }
    } else {
      try { map.removeControl(ctrl) } catch { /* not added */ }
    }
  }, [showZoomControls])

  // Map init
  useEffect(() => {
    if (!containerRef.current) return

    const style = pmtilesUrl
      ? buildStyle(pmtilesUrl)
      : 'https://tiles.openfreemap.org/styles/liberty'

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [-3.5, 55.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      attributionControl: false,
    })

    mapRef.current = map
    navControlRef.current = new maplibregl.NavigationControl({ showCompass: false })
    if (showZoomControlsRef.current) {
      map.addControl(navControlRef.current, 'bottom-right')
    }

    map.on('load', () => {
      map.fitBounds(VIEW_BOUNDS, {
        padding: { top: 60, right: 20, bottom: 140, left: 20 },
        duration: 0,
      })
      addOverlays(map, onLocationSelectRef, onCustomPlaceClickRef)

      // Long press (touch) → add custom place
      let lpTimer: ReturnType<typeof setTimeout> | null = null
      map.on('touchstart', (e) => {
        if (e.originalEvent.touches.length !== 1) return
        const { lng, lat } = e.lngLat
        lpTimer = setTimeout(() => {
          lpTimer = null
          onLongPressRef.current?.(lng, lat)
        }, 600)
      })
      const cancelLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null } }
      map.on('touchend', cancelLp)
      map.on('touchmove', cancelLp)
      map.on('touchcancel', cancelLp)

      // Map click in measure mode
      map.on('click', (e) => {
        if (mapModeRef.current !== 'measure') return
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['hp-dots', 'custom-place-dots'],
        })
        if (features.length > 0) return
        onMeasurePointRef.current?.(e.lngLat.lng, e.lngLat.lat)
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      geocodeMarkerRef.current = null
      navControlRef.current = null
      firstPositionRef.current = false
      offlineRegisteredRef.current = false
    }
  }, [pmtilesUrl])

  // Cursor style for map mode
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = mapMode === 'measure' ? 'crosshair' : ''
  }, [mapMode])

  // Measure points overlay
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pointSrc = map.getSource('measure-points') as maplibregl.GeoJSONSource | undefined
    const lineSrc = map.getSource('measure-line') as maplibregl.GeoJSONSource | undefined
    if (!pointSrc || !lineSrc) return

    pointSrc.setData({
      type: 'FeatureCollection',
      features: measurePoints.map((coords, i) => ({
        type: 'Feature' as const,
        properties: { index: i },
        geometry: { type: 'Point' as const, coordinates: coords },
      })),
    })

    lineSrc.setData({
      type: 'FeatureCollection',
      features: measurePoints.length >= 2 ? [{
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: measurePoints },
      }] : [],
    })
  }, [measurePoints])

  // Custom places overlay
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource('custom-places') as maplibregl.GeoJSONSource | undefined
    if (!src) return
    src.setData({
      type: 'FeatureCollection',
      features: customPlaces.map((p) => ({
        type: 'Feature' as const,
        properties: { id: p.id, name: p.name },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      })),
    })
  }, [customPlaces])

  // Geocode marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    geocodeMarkerRef.current?.remove()
    geocodeMarkerRef.current = null
    if (geocodeMarker) {
      const el = document.createElement('div')
      el.className = 'geocode-marker'
      geocodeMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([geocodeMarker.lng, geocodeMarker.lat])
        .addTo(map)
    }
  }, [geocodeMarker])

  // Offline PMTiles file registration
  useEffect(() => {
    if (!offlineFile) {
      offlineRegisteredRef.current = false
      return
    }
    if (!pmtilesUrl || offlineRegisteredRef.current) return
    const source = new FileSource(offlineFile)
    ;(source as unknown as { getKey: () => string }).getKey = () => pmtilesUrl
    const p = new PMTiles(source)
    pmtilesProtocol.add(p)
    offlineRegisteredRef.current = true
  }, [offlineFile, pmtilesUrl])

  // User position marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!position) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    if (markerRef.current) {
      markerRef.current.setLngLat([position.lng, position.lat])
    } else {
      const el = document.createElement('div')
      el.className = 'user-location-marker'
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([position.lng, position.lat])
        .addTo(map)
    }

    if (!firstPositionRef.current) {
      firstPositionRef.current = true
      const { west, east, south, north } = FLY_BOUNDS
      const inBounds =
        position.lng >= west && position.lng <= east &&
        position.lat >= south && position.lat <= north
      if (inBounds) {
        map.flyTo({ center: [position.lng, position.lat], zoom: 11 })
      }
    }
  }, [position])

  return <div ref={containerRef} className={styles.map} />
})

export default MapView
