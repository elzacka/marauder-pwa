import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Feature, Polygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Position } from '../hooks/useGeolocation'
import type { HPLocation } from '../types/hp-location'
import { propsToLocation } from '../utils/featureToLocation'
import type { CustomPlace } from '../types/custom-place'
import { LOCATION_TYPE_COLORS, CATEGORY_META, LOCATION_TYPES, type FilterState } from '../ds/filterMeta'
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

export type BaseLayer = 'standard' | 'satellite'

// Esri World Imagery: the best freely usable satellite source (≤1 m detail).
// Free with attribution — NOT open source; the open alternatives (Sentinel-2,
// 10 m) lack street-level detail. Verified 2026-07-05.
const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

/**
 * Hybrid satellite style: Esri imagery as base + the SYMBOL layers (place
 * names, road names) from the standard vector style on top.
 */
async function buildSatelliteStyle(): Promise<maplibregl.StyleSpecification> {
  const liberty = (await fetch(MAP_STYLE).then((r) => r.json())) as maplibregl.StyleSpecification
  return {
    version: 8,
    glyphs: liberty.glyphs,
    sprite: liberty.sprite,
    sources: {
      ...liberty.sources,
      satellite: {
        type: 'raster',
        tiles: [ESRI_IMAGERY],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [
      { id: 'satellite-base', type: 'raster', source: 'satellite' },
      // Labels restyled for imagery (Google hybrid look): white text with a
      // strong dark halo — the standard style's dark-on-light labels are
      // unreadable on top of photos
      ...liberty.layers
        .filter((l) => l.type === 'symbol')
        .map((l) => ({
          ...l,
          paint: {
            ...((l as { paint?: Record<string, unknown> }).paint ?? {}),
            'text-color': '#FFFFFF',
            'text-halo-color': 'rgba(0, 0, 0, 0.8)',
            'text-halo-width': 1.6,
          },
        })),
    ] as maplibregl.LayerSpecification[],
  }
}

// Dot colours come from the shared palette in filterMeta (single source)
const TYPE_COLOR_EXPR = [
  'match', ['get', 'location_type'],
  'filming',     LOCATION_TYPE_COLORS.filming,
  'canonical',   LOCATION_TYPE_COLORS.canonical,
  'interpreted', LOCATION_TYPE_COLORS.interpreted,
  LOCATION_TYPE_COLORS.filming,
] as unknown as maplibregl.ExpressionSpecification

const HP_PAINT: maplibregl.CircleLayerSpecification['paint'] = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 7, 12, 12],
  'circle-color': TYPE_COLOR_EXPR,
  'circle-stroke-width': 2,
  'circle-stroke-color': '#E8D5AA',
  'circle-opacity': 0.92,
}

const SELECTED_HP_PAINT: maplibregl.CircleLayerSpecification['paint'] = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 15],
  'circle-color': TYPE_COLOR_EXPR,
  'circle-stroke-width': 3,
  'circle-stroke-color': '#FFFFFF',
  'circle-opacity': 1,
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

// Static SVG strings for the map button group — Lucide markup (LocateFixed, Plus,
// Minus) inlined as strings, to match the Lucide icons used elsewhere. These are
// custom MapLibre controls set via innerHTML, so they can't use the React components.
const LUCIDE_ATTRS =
  'xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
const ICON_LOCATE =
  `<svg ${LUCIDE_ATTRS}><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/></svg>`
const ICON_ZOOM_IN =
  `<svg ${LUCIDE_ATTRS}><path d="M5 12h14"/><path d="M12 5v14"/></svg>`
const ICON_ZOOM_OUT =
  `<svg ${LUCIDE_ATTRS}><path d="M5 12h14"/></svg>`

/** A single footprint (sole + heel), burgundy — drawn on canvas like the heart */
function makeFootprintImage(size = 20): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new ImageData(size, size)
  const s = size / 20
  ctx.fillStyle = 'rgba(92, 16, 16, 0.85)'
  // Sole
  ctx.beginPath()
  ctx.ellipse(10 * s, 8 * s, 3.4 * s, 5.2 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  // Heel
  ctx.beginPath()
  ctx.ellipse(10 * s, 16 * s, 2.4 * s, 2.6 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

type MapButtonsOptions = {
  showLocate: boolean
  showZoom: boolean
  onLocate: () => void
}

/**
 * One combined control group: locate + zoom in + zoom out (Lene, 2026-07-05).
 * Custom control instead of maplibregl.NavigationControl so all three buttons
 * share the exact same design — built by the same code path.
 */
class MapButtonsControl implements maplibregl.IControl {
  private container: HTMLDivElement | null = null

  constructor(private opts: MapButtonsOptions) {}

  onAdd(map: maplibregl.Map): HTMLElement {
    const c = document.createElement('div')
    c.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    const addBtn = (icon: string, label: string, onClick: () => void) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.setAttribute('aria-label', label)
      b.innerHTML = icon
      b.addEventListener('click', (e) => { e.stopPropagation(); onClick() })
      c.appendChild(b)
    }

    if (this.opts.showLocate) addBtn(ICON_LOCATE, 'Gå til min posisjon', this.opts.onLocate)
    if (this.opts.showZoom) {
      addBtn(ICON_ZOOM_IN, 'Zoom inn', () => map.zoomIn({ duration: 300 }))
      addBtn(ICON_ZOOM_OUT, 'Zoom ut', () => map.zoomOut({ duration: 300 }))
    }

    this.container = c
    return c
  }

  onRemove(): void {
    this.container?.remove()
    this.container = null
  }
}

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

function addOverlays(map: maplibregl.Map) {
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

  // Footprints — the Marauder's Map signature: your position leaves a fading
  // trail of footprints (Julia-godkjent design krav, 2026-07-05)
  map.addImage('footprint', makeFootprintImage(), { pixelRatio: 2 })
  map.addSource('footprints', { type: 'geojson', data: EMPTY_FC })
  map.addLayer({
    id: 'footprints',
    type: 'symbol',
    source: 'footprints',
    layout: {
      'icon-image': 'footprint',
      'icon-size': 0.9,
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-offset': ['case', ['get', 'left'], ['literal', [-4, 0]], ['literal', [4, 0]]],
    },
    paint: {
      'icon-opacity': ['get', 'opacity'],
    },
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
  // NB: cursor handlers are intentionally NOT registered here — they are
  // registered once in the 'load' handler so they survive style switches
  // without accumulating duplicate listeners on every addOverlays() call.

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
  /** offsetY (px, negative = up): shifts the target above centre so it stays
      visible when a bottom sheet covers the lower part of the screen */
  flyTo: (lng: number, lat: number, zoom?: number, offsetY?: number) => void
  /** Current visible map bounds — used for "download this area" */
  getBounds: () => { west: number; south: number; east: number; north: number } | null
}

export type MapMode = 'browse' | 'measure'

type Props = {
  position: Position | null
  onLocationSelect?: (loc: HPLocation) => void
  showZoomControls?: boolean
  showLocateBtn?: boolean
  onLocate?: () => void
  mapMode?: MapMode
  measurePoints?: Array<[number, number]>
  onMeasurePoint?: (lng: number, lat: number) => void
  customPlaces?: CustomPlace[]
  onCustomPlaceClick?: (id: string) => void
  onLongPress?: (lng: number, lat: number) => void
  geocodeMarker?: { lng: number; lat: number } | null
  onGeocodeMarkerClick?: () => void
  /** Tap on empty map (browse mode) — used to close the POI detail sheet */
  onMapClick?: () => void
  baseLayer?: BaseLayer
  /** Called when a base-layer switch fails (e.g. offline Satellitt) so App
   *  can revert its own state and localStorage to the previous layer. */
  onBaseLayerFailed?: (failedLayer: BaseLayer) => void
  selectedLocation?: HPLocation | null
  activeFilter?: FilterState
  /** Favourite POI ids to force-show as markers regardless of category filter */
  favouriteMarkerIds?: string[]
  hpLocations?: FeatureCollection | null
}

const MapView = forwardRef<MapHandle, Props>(function MapView(props, ref) {
  const {
    position, onLocationSelect, showZoomControls = true,
    showLocateBtn = true, onLocate,
    mapMode = 'browse', measurePoints = [], onMeasurePoint,
    customPlaces = [], onCustomPlaceClick,
    onLongPress, geocodeMarker, onGeocodeMarkerClick, onMapClick, baseLayer = 'standard',
    onBaseLayerFailed,
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
  const onMapClickRef = useRef(onMapClick)
  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  const onBaseLayerFailedRef = useRef(onBaseLayerFailed)
  useEffect(() => { onBaseLayerFailedRef.current = onBaseLayerFailed }, [onBaseLayerFailed])
  const mapModeRef = useRef(mapMode)
  useEffect(() => { mapModeRef.current = mapMode }, [mapMode])
  const positionRef = useRef(position)
  useEffect(() => { positionRef.current = position }, [position])

  const flyTo = useCallback((lng: number, lat: number, zoom = 13, offsetY = 0) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 700, offset: [0, offsetY] })
  }, [])
  const getBounds = useCallback(() => {
    const b = mapRef.current?.getBounds()
    if (!b) return null
    return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }
  }, [])
  useImperativeHandle(ref, () => ({ flyTo, getBounds }), [flyTo, getBounds])

  const onLocateRef = useRef(onLocate)
  useEffect(() => { onLocateRef.current = onLocate }, [onLocate])

  // Combined button group (locate + zoom). Recreated when the Settings
  // toggles change. NB: must run AFTER the map init effect below on first
  // render — React runs effects in declaration order, but map init is
  // declared later, so this effect waits for mapReady instead.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!showZoomControls && !showLocateBtn) return
    const ctrl = new MapButtonsControl({
      showLocate: showLocateBtn,
      showZoom: showZoomControls,
      onLocate: () => onLocateRef.current?.(),
    })
    map.addControl(ctrl, 'bottom-right')
    return () => {
      try { map.removeControl(ctrl) } catch { /* map already removed */ }
    }
  }, [showZoomControls, showLocateBtn, mapReady])

  // Map init
  useEffect(() => {
    if (!containerRef.current) return

    // Declared in outer scope so the cleanup can clear any pending long-press
    let lpTimer: ReturnType<typeof setTimeout> | null = null

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

    map.on('load', () => {
      map.fitBounds(VIEW_BOUNDS, {
        padding: { top: 60, right: 20, bottom: 140, left: 20 },
        duration: 0,
      })
      // Default view one zoom level closer than the full-bounds fit (Lene, 2026-07-06)
      map.setZoom(map.getZoom() + 1)
      addOverlays(map)

      // Cursor style for marker layers — registered once here so they survive
      // setStyle() calls without accumulating duplicate listeners.
      const setCursor = (c: string) => () => { map.getCanvas().style.cursor = c }
      for (const layer of ['hp-dots', 'favourite-hearts', 'custom-place-dots']) {
        map.on('mouseenter', layer, setCursor('pointer'))
        map.on('mouseleave', layer, setCursor(''))
      }

      setMapReady(true)

      // Long press (touch): browse mode → add custom place; measure mode →
      // add a measure point, snapped to a marker under the finger if any
      map.on('touchstart', (e) => {
        if (e.originalEvent.touches.length !== 1) return
        const { lng, lat } = e.lngLat
        const point = e.point
        lpTimer = setTimeout(() => {
          lpTimer = null
          if (mapModeRef.current === 'measure') {
            const pad = 14
            const features = map.queryRenderedFeatures(
              [[point.x - pad, point.y - pad], [point.x + pad, point.y + pad]],
              { layers: ['hp-dots', 'favourite-hearts', 'custom-place-dots', 'selected-hp-dot'] },
            )
            const snapped = features.find((f) => f.geometry.type === 'Point')
            if (snapped && snapped.geometry.type === 'Point') {
              onMeasurePointRef.current?.(snapped.geometry.coordinates[0], snapped.geometry.coordinates[1])
            } else {
              onMeasurePointRef.current?.(lng, lat)
            }
            return
          }
          onLongPressRef.current?.(lng, lat)
        }, 600)
      })
      const cancelLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null } }
      map.on('touchend', cancelLp)
      map.on('touchmove', cancelLp)
      map.on('touchcancel', cancelLp)

      // General map click.
      // Measure mode: tapping ON a marker snaps the measure point to the
      // marker's exact coordinates (Lene, 2026-07-05).
      // Browse mode: a tap on EMPTY map closes the POI detail sheet — drags
      // don't fire 'click', so panning never closes it.
      map.on('click', (e) => {
        const pad = 22
        const markerLayers = ['hp-dots', 'favourite-hearts', 'custom-place-dots', 'selected-hp-dot']
          .filter((id) => map.getLayer(id))
        const features = map.queryRenderedFeatures(
          [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]],
          { layers: markerLayers },
        )
        if (mapModeRef.current === 'measure') {
          const snapped = features.find((f) => f.geometry.type === 'Point')
          if (snapped && snapped.geometry.type === 'Point') {
            onMeasurePointRef.current?.(snapped.geometry.coordinates[0], snapped.geometry.coordinates[1])
          } else {
            onMeasurePointRef.current?.(e.lngLat.lng, e.lngLat.lat)
          }
          return
        }
        // Browse mode: a marker within the hit box opens/switches the POI
        // detail sheet; empty map closes it
        const hit = features.find((f) => f.geometry.type === 'Point')
        if (hit && hit.geometry.type === 'Point') {
          if (hit.layer.id === 'custom-place-dots') {
            const id = hit.properties?.id as string | undefined
            if (id) onCustomPlaceClickRef.current?.(id)
          } else if (onLocationSelectRef.current) {
            onLocationSelectRef.current(
              propsToLocation(hit.properties, hit.geometry.coordinates[0], hit.geometry.coordinates[1]),
            )
          }
          return
        }
        onMapClickRef.current?.()
      })
    })

    return () => {
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null }
      setMapReady(false)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      geocodeMarkerRef.current = null
      firstPositionRef.current = false
    }
  }, [])

  // Base layer switch (Standard ↔ Satellitt). setStyle wipes custom sources,
  // layers and images, so overlays are re-added and mapReady re-triggers the
  // data effects afterwards.
  const appliedLayerRef = useRef<BaseLayer>('standard')
  useEffect(() => {
    const map = mapRef.current
    if (!map || appliedLayerRef.current === baseLayer) return
    const prev = appliedLayerRef.current
    appliedLayerRef.current = baseLayer
    let cancelled = false
    ;(async () => {
      try {
        const style = baseLayer === 'satellite' ? await buildSatelliteStyle() : MAP_STYLE
        if (cancelled) return
        setMapReady(false)
        map.setStyle(style as maplibregl.StyleSpecification | string, { diff: false })
        map.once('idle', () => {
          if (cancelled) return
          if (!map.getLayer('hp-dots')) {
            addOverlays(map)
          }
          setMapReady(true)
        })
      } catch {
        // Style fetch failed (offline Satellitt?) — revert to previous layer
        appliedLayerRef.current = prev
        onBaseLayerFailedRef.current?.(baseLayer)
      }
    })()
    return () => { cancelled = true }
  }, [baseLayer])

  // Cursor style for map mode
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = mapMode === 'measure' ? 'crosshair' : ''
  }, [mapMode])

  // Measure points overlay (mapReady dep: re-populate after base layer switch)
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
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
  }, [measurePoints, mapReady])

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
  }, [customPlaces, mapReady])

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
        // Measure mode: tap/long-press on the pin = measure point at the pin
        if (mapModeRef.current === 'measure') {
          onMeasurePointRef.current?.(geocodeMarker.lng, geocodeMarker.lat)
          return
        }
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
  }, [selectedLocation, mapReady])

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
        if (types.length > 0 && types.length < LOCATION_TYPES.length) {
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
    // The SELECTED place is excluded from both layers — only the enlarged
    // selected marker shows it (fixes "double marker", Lene 2026-07-06).
    const selId = selectedLocation?.id ?? null
    const hasFavs = favouriteMarkerIds.length > 0
    if (map.getLayer('favourite-hearts')) {
      map.setLayoutProperty('favourite-hearts', 'visibility', hasFavs ? 'visible' : 'none')
      if (hasFavs) {
        let heartsExpr: unknown = ['match', ['get', 'id'], favouriteMarkerIds, true, false]
        if (selId) heartsExpr = ['all', heartsExpr, ['!=', ['get', 'id'], selId]]
        map.setFilter('favourite-hearts', heartsExpr as maplibregl.FilterSpecification)
      }
    }

    // Marker colour = the colour of the checkbox that made it visible
    // (Lene, 2026-07-05): dots shown via a category tick get that category's
    // colour; Locations dots keep the sub-type shades (their checkboxes).
    // Overlaps resolve in menu order. Fallback (nothing ticked, e.g. the
    // selected marker from search) = sub-type colours.
    const orderedChecked = CATEGORY_META.filter((c) => cats.includes(c.key))
    let colorExpr: unknown = TYPE_COLOR_EXPR
    if (orderedChecked.length > 0) {
      const e: unknown[] = ['case']
      for (const c of orderedChecked) {
        if (c.key === 'locations') {
          e.push(['in', 'locations', ['get', 'categories']], TYPE_COLOR_EXPR)
        } else {
          e.push(['in', c.key, ['get', 'categories']], c.color)
        }
      }
      e.push(TYPE_COLOR_EXPR)
      colorExpr = e
    }
    map.setPaintProperty('hp-dots', 'circle-color', colorExpr as maplibregl.ExpressionSpecification)
    if (map.getLayer('selected-hp-dot')) {
      map.setPaintProperty('selected-hp-dot', 'circle-color', colorExpr as maplibregl.ExpressionSpecification)
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
    if (selId) {
      expr = ['all', expr, ['!=', ['get', 'id'], selId]]
    }
    map.setFilter('hp-dots', expr as maplibregl.FilterSpecification)
  }, [activeFilter, favouriteMarkerIds, selectedLocation, mapReady])

  // HP locations data — set when the fetched FeatureCollection arrives OR when
  // the map becomes ready, whichever happens last (see mapReady comment above)
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !hpLocations) return
    const src = map.getSource('hp-locations') as maplibregl.GeoJSONSource | undefined
    src?.setData(hpLocations)
  }, [hpLocations, mapReady])

  // Footprint trail: add a print when we have moved far enough; older prints
  // fade progressively and the oldest disappear
  const footprintsRef = useRef<Array<{ lng: number; lat: number; bearing: number; left: boolean }>>([])
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    const src = map.getSource('footprints') as maplibregl.GeoJSONSource | undefined
    if (!src) return
    if (!position) {
      footprintsRef.current = []
      src.setData(EMPTY_FC)
      return
    }
    const prints = footprintsRef.current
    const last = prints[prints.length - 1]
    if (last) {
      const dLng = position.lng - last.lng
      const dLat = position.lat - last.lat
      const meters = Math.hypot(dLat * 111_320, dLng * 111_320 * Math.cos((position.lat * Math.PI) / 180))
      if (meters < 12) return
      const bearing = (Math.atan2(dLng, dLat) * 180) / Math.PI
      prints.push({ lng: position.lng, lat: position.lat, bearing, left: !last.left })
    } else {
      prints.push({ lng: position.lng, lat: position.lat, bearing: 0, left: false })
    }
    if (prints.length > 14) prints.splice(0, prints.length - 14)
    src.setData({
      type: 'FeatureCollection',
      features: prints.map((p, i) => ({
        type: 'Feature' as const,
        properties: {
          bearing: p.bearing,
          left: p.left,
          opacity: Math.max(0.12, ((i + 1) / prints.length) * 0.85),
        },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      })),
    })
  }, [position, mapReady])

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
      // Measure mode: tap on your own position = measure point exactly there
      el.addEventListener('click', (ev) => {
        if (mapModeRef.current === 'measure' && positionRef.current) {
          ev.stopPropagation()
          onMeasurePointRef.current?.(positionRef.current.lng, positionRef.current.lat)
        }
      })
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
