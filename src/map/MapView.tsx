import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Feature, Polygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Position } from '../hooks/useGeolocation'
import type { HPLocation } from '../types/hp-location'
import { propsToLocation } from '../utils/featureToLocation'
import type { CustomPlace } from '../types/custom-place'
import type { FilterState } from '../ds/filterMeta'
import styles from './MapView.module.css'

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

// Online style; offline is handled by area downloads + the service worker
// serving tiles CacheFirst (see src/offline/OfflineAreaManager.ts)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

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

const SELECTED_HP_PAINT: maplibregl.CircleLayerSpecification['paint'] = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 15],
  'circle-color': [
    'match', ['get', 'location_type'],
    'filming',     '#5C1010',
    'canonical',   '#9E6B1A',
    'interpreted', '#4A3B6B',
    '#5C1010',
  ],
  'circle-stroke-width': 3,
  'circle-stroke-color': '#FFFFFF',
  'circle-opacity': 1,
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * Heart icon for favourite markers, drawn on a canvas (no innerHTML).
 * Burgundy fill with cream outline — matches the POI marker palette but the
 * shape alone distinguishes favourites.
 */
function makeHeartImage(size = 56): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new ImageData(size, size)
  const s = size / 32
  ctx.translate(size / 2, size / 2 + 1 * s)
  ctx.beginPath()
  ctx.moveTo(0, 10 * s)
  ctx.bezierCurveTo(-2 * s, 8 * s, -12 * s, 2 * s, -12 * s, -4 * s)
  ctx.bezierCurveTo(-12 * s, -9 * s, -8.5 * s, -11.5 * s, -5.5 * s, -11.5 * s)
  ctx.bezierCurveTo(-3 * s, -11.5 * s, -1 * s, -10 * s, 0, -7.5 * s)
  ctx.bezierCurveTo(1 * s, -10 * s, 3 * s, -11.5 * s, 5.5 * s, -11.5 * s)
  ctx.bezierCurveTo(8.5 * s, -11.5 * s, 12 * s, -9 * s, 12 * s, -4 * s)
  ctx.bezierCurveTo(12 * s, 2 * s, 2 * s, 8 * s, 0, 10 * s)
  ctx.closePath()
  ctx.fillStyle = '#5C1010'
  ctx.strokeStyle = '#F5ECD7'
  ctx.lineWidth = 2 * s
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

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

  // HP locations — hidden by default: the map starts empty and markers appear
  // only when a category is chosen (product decision, Lene 2026-07-05). This
  // initial visibility must agree with App's initial activeFilter (null).
  map.addSource('hp-locations', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({
    id: 'hp-dots',
    type: 'circle',
    source: 'hp-locations',
    paint: HP_PAINT,
    layout: { visibility: 'none' },
  })

  // Favourite hearts — heart-shaped markers for favourites ("Alle" toggle).
  // Rendered above hp-dots; filter/visibility managed by the filter effect.
  map.addImage('heart-marker', makeHeartImage(), { pixelRatio: 2 })
  map.addLayer({
    id: 'favourite-hearts',
    type: 'symbol',
    source: 'hp-locations',
    layout: {
      'icon-image': 'heart-marker',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 12, 1.0],
      'icon-allow-overlap': true,
      visibility: 'none',
    },
  })

  // Selected HP location (single marker)
  map.addSource('selected-hp-location', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({ id: 'selected-hp-dot', type: 'circle', source: 'selected-hp-location', paint: SELECTED_HP_PAINT })

  map.on('click', 'hp-dots', (e) => {
    if (!e.features?.length || !onLocationSelectRef.current) return
    const feat = e.features[0]
    const geom = feat.geometry
    if (geom.type !== 'Point') return
    // Single conversion point — do not rebuild HPLocation by hand here (CLAUDE.md)
    onLocationSelectRef.current(
      propsToLocation(feat.properties, geom.coordinates[0], geom.coordinates[1]),
    )
  })
  map.on('mouseenter', 'hp-dots', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'hp-dots', () => { map.getCanvas().style.cursor = '' })

  // Favourite hearts open the same POI detail as regular dots
  map.on('click', 'favourite-hearts', (e) => {
    if (!e.features?.length || !onLocationSelectRef.current) return
    const feat = e.features[0]
    const geom = feat.geometry
    if (geom.type !== 'Point') return
    onLocationSelectRef.current(
      propsToLocation(feat.properties, geom.coordinates[0], geom.coordinates[1]),
    )
  })
  map.on('mouseenter', 'favourite-hearts', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'favourite-hearts', () => { map.getCanvas().style.cursor = '' })

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
  flyTo: (lng: number, lat: number, zoom?: number) => void
  /** Current visible map bounds — used for "download this area" */
  getBounds: () => { west: number; south: number; east: number; north: number } | null
}

export type MapMode = 'browse' | 'measure'

type Props = {
  position: Position | null
  onLocationSelect?: (loc: HPLocation) => void
  showZoomControls?: boolean
  mapMode?: MapMode
  measurePoints?: Array<[number, number]>
  onMeasurePoint?: (lng: number, lat: number) => void
  customPlaces?: CustomPlace[]
  onCustomPlaceClick?: (id: string) => void
  onLongPress?: (lng: number, lat: number) => void
  geocodeMarker?: { lng: number; lat: number } | null
  onGeocodeMarkerClick?: () => void
  selectedLocation?: HPLocation | null
  activeFilter?: FilterState
  /** Favourite POI ids to force-show as markers regardless of category filter */
  favouriteMarkerIds?: string[]
  hpLocations?: FeatureCollection | null
}

const MapView = forwardRef<MapHandle, Props>(function MapView(props, ref) {
  const {
    position, onLocationSelect, showZoomControls = true,
    mapMode = 'browse', measurePoints = [], onMeasurePoint,
    customPlaces = [], onCustomPlaceClick,
    onLongPress, geocodeMarker, onGeocodeMarkerClick,
    selectedLocation = null, activeFilter, favouriteMarkerIds = [],
    hpLocations = null,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // True once map 'load' has fired and overlay sources/layers exist. Data
  // effects depend on this: locally cached data (service worker) arrives
  // BEFORE the map finishes loading, so effects that ran too early must
  // re-run when the map becomes ready — otherwise the layers stay empty
  // forever and no POI markers ever appear.
  const [mapReady, setMapReady] = useState(false)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const geocodeMarkerRef = useRef<maplibregl.Marker | null>(null)
  const navControlRef = useRef<maplibregl.NavigationControl | null>(null)
  const firstPositionRef = useRef(false)

  const onLocationSelectRef = useRef(onLocationSelect)
  useEffect(() => { onLocationSelectRef.current = onLocationSelect }, [onLocationSelect])
  const onCustomPlaceClickRef = useRef(onCustomPlaceClick)
  useEffect(() => { onCustomPlaceClickRef.current = onCustomPlaceClick }, [onCustomPlaceClick])
  const onMeasurePointRef = useRef(onMeasurePoint)
  useEffect(() => { onMeasurePointRef.current = onMeasurePoint }, [onMeasurePoint])
  const onLongPressRef = useRef(onLongPress)
  useEffect(() => { onLongPressRef.current = onLongPress }, [onLongPress])
  const onGeocodeMarkerClickRef = useRef(onGeocodeMarkerClick)
  useEffect(() => { onGeocodeMarkerClickRef.current = onGeocodeMarkerClick }, [onGeocodeMarkerClick])
  const mapModeRef = useRef(mapMode)
  useEffect(() => { mapModeRef.current = mapMode }, [mapMode])

  const flyTo = useCallback((lng: number, lat: number, zoom = 13) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 700 })
  }, [])
  const getBounds = useCallback(() => {
    const b = mapRef.current?.getBounds()
    if (!b) return null
    return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }
  }, [])
  useImperativeHandle(ref, () => ({ flyTo, getBounds }), [flyTo, getBounds])

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

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
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
      setMapReady(true)

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
          layers: ['hp-dots', 'custom-place-dots', 'selected-hp-dot'],
        })
        if (features.length > 0) return
        onMeasurePointRef.current?.(e.lngLat.lng, e.lngLat.lat)
      })
    })

    return () => {
      setMapReady(false)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      geocodeMarkerRef.current = null
      navControlRef.current = null
      firstPositionRef.current = false
    }
  }, [])

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

  // Custom places overlay (localStorage data — also arrives before map load)
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
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

  // Geocode marker — persistent pin; tapping it toggles the result card in App.
  // anchor: 'bottom' so the pin TIP marks the location, not the pin centre.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    geocodeMarkerRef.current?.remove()
    geocodeMarkerRef.current = null
    if (geocodeMarker) {
      const el = document.createElement('div')
      el.className = 'geocode-marker'
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', 'Valgt søketreff — trykk for detaljer')
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onGeocodeMarkerClickRef.current?.()
      })
      geocodeMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([geocodeMarker.lng, geocodeMarker.lat])
        .addTo(map)
    }
  }, [geocodeMarker])

  // Selected HP location marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource('selected-hp-location') as maplibregl.GeoJSONSource | undefined
    if (!src) return
    if (!selectedLocation) {
      src.setData(EMPTY_FC)
      return
    }
    src.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          id: selectedLocation.id,
          name: selectedLocation.name,
          location_type: selectedLocation.location_type,
          categories: JSON.stringify(selectedLocation.categories),
        },
        geometry: { type: 'Point', coordinates: [selectedLocation.lng, selectedLocation.lat] },
      }],
    })
  }, [selectedLocation])

  // Active category filter → hp-dots visibility and filter expression.
  // Multi-select: each checked category contributes an OR-branch; no checked
  // categories = layer hidden (map starts empty — product decision).
  // mapReady in deps: a filter chosen before the map finished loading must be
  // applied once the layer exists.
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    if (!map.getLayer('hp-dots')) return

    const cats = activeFilter?.categories ?? []
    const parts: unknown[] = []

    for (const cat of cats) {
      const catExpr = ['in', cat, ['get', 'categories']]
      if (cat === 'locations') {
        const types = activeFilter?.locationTypes ?? []
        if (types.length > 0 && types.length < 3) {
          parts.push(['all', catExpr, ['match', ['get', 'location_type'], types, true, false]])
        } else {
          parts.push(catExpr)
        }
      } else {
        parts.push(catExpr)
      }
    }

    // Favourites ("Alle" toggle) render as hearts in their own layer; the same
    // POIs are excluded from hp-dots so a favourite never shows dot + heart.
    const hasFavs = favouriteMarkerIds.length > 0
    if (map.getLayer('favourite-hearts')) {
      map.setLayoutProperty('favourite-hearts', 'visibility', hasFavs ? 'visible' : 'none')
      if (hasFavs) {
        map.setFilter('favourite-hearts', ['match', ['get', 'id'], favouriteMarkerIds, true, false] as unknown as maplibregl.FilterSpecification)
      }
    }

    if (parts.length === 0) {
      map.setLayoutProperty('hp-dots', 'visibility', 'none')
      return
    }

    map.setLayoutProperty('hp-dots', 'visibility', 'visible')
    let expr: unknown = parts.length === 1 ? parts[0] : ['any', ...parts]
    if (hasFavs) {
      expr = ['all', expr, ['!', ['match', ['get', 'id'], favouriteMarkerIds, true, false]]]
    }
    map.setFilter('hp-dots', expr as maplibregl.FilterSpecification)
  }, [activeFilter, favouriteMarkerIds, mapReady])

  // HP locations data — set when the fetched FeatureCollection arrives OR when
  // the map becomes ready, whichever happens last (see mapReady comment above)
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !hpLocations) return
    const src = map.getSource('hp-locations') as maplibregl.GeoJSONSource | undefined
    src?.setData(hpLocations)
  }, [hpLocations, mapReady])

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
