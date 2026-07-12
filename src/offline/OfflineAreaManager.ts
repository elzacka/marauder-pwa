/**
 * Area-based offline maps (Lene, 2026-07-05) — the Tråkke iOS model ported to
 * a PWA. The user downloads selected areas (visible map view); we compute the
 * XYZ tile pyramid for the area (same math as Tråkke's estimateTileCount),
 * fetch every vector tile and store it in the Cache API. The service worker
 * serves tiles CacheFirst from the same cache, so downloaded areas render
 * offline. No external storage service involved.
 */

export type LngLatBounds = { west: number; south: number; east: number; north: number }

export type OfflineArea = {
  id: string
  name: string
  bounds: LngLatBounds
  minZoom: number
  maxZoom: number
  tileCount: number
  bytes: number
  createdAt: string
  /** URL template for the vector tiles used when this area was downloaded.
   *  Stored per-area so deleteArea survives style URL changes. */
  template?: string
  /** True when some tiles failed to download after a retry — offline coverage
   *  may be incomplete in this area. */
  incomplete?: boolean
}

const AREAS_KEY = 'marauder-offline-areas'
/** Kept for backwards compat with areas saved before per-area template field */
const TEMPLATE_KEY = 'marauder-tile-template'

/** Must match the runtimeCaching cacheName in vite.config.ts */
export const TILE_CACHE = 'map-tiles'

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/** Vector data stops at z14; MapLibre overzooms beyond that, so z14 gives
 *  full street detail. z4 matches the map's minZoom. */
export const AREA_MIN_ZOOM = 4
export const AREA_MAX_ZOOM = 14

/** Maximum tile count allowed per download — rough upper bound to avoid
 *  multi-GB downloads from a whole-country viewport with no warning. */
export const TILE_CAP = 60_000

/** Decompressed tile size estimate (vector tiles are stored uncompressed in
 *  the Cache API even when the server sends gzip). Previous value 35 kB was
 *  the gzipped size; uncompressed is 2–4× larger. */
const TILE_SIZE_ESTIMATE = 90_000

// ── Tile math (Web Mercator, same formulas as Tråkke) ──

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z)
}

function latToTileY(lat: number, z: number): number {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat))
  const r = (clamped * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

export function listTiles(
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
): Array<{ z: number; x: number; y: number }> {
  const tiles: Array<{ z: number; x: number; y: number }> = []
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lonToTileX(bounds.west, z)
    const xMax = lonToTileX(bounds.east, z)
    const yMin = latToTileY(bounds.north, z)
    const yMax = latToTileY(bounds.south, z)
    const max = 2 ** z - 1
    for (let x = Math.max(0, xMin); x <= Math.min(max, xMax); x++) {
      for (let y = Math.max(0, yMin); y <= Math.min(max, yMax); y++) {
        tiles.push({ z, x, y })
      }
    }
  }
  return tiles
}

export function estimateTileCount(bounds: LngLatBounds): number {
  return listTiles(bounds, AREA_MIN_ZOOM, AREA_MAX_ZOOM).length
}

export function estimateBytes(tileCount: number): number {
  return tileCount * TILE_SIZE_ESTIMATE
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}

// ── Area metadata (localStorage) ──

export function getAreas(): OfflineArea[] {
  try {
    const raw = localStorage.getItem(AREAS_KEY)
    return raw ? (JSON.parse(raw) as OfflineArea[]) : []
  } catch {
    return []
  }
}

function saveAreas(areas: OfflineArea[]) {
  localStorage.setItem(AREAS_KEY, JSON.stringify(areas))
}

export function renameArea(id: string, name: string): void {
  saveAreas(getAreas().map((a) => (a.id === id ? { ...a, name } : a)))
}

// ── Style / tile template resolution ──

type StyleSource = { url?: string; tiles?: string[]; type?: string; maxzoom?: number }
type StyleJson = {
  sources: Record<string, StyleSource>
  layers: Array<{ layout?: Record<string, unknown> }>
  glyphs?: string
  sprite?: string
}

async function fetchAndCache(url: string, cache: Cache, signal?: AbortSignal): Promise<Response> {
  const cached = await cache.match(url)
  if (cached) return cached
  const resp = await fetch(url, { signal })
  if (!resp.ok) throw new Error(`Nedlasting feilet (HTTP ${resp.status}): ${url}`)
  await cache.put(url, resp.clone())
  return resp
}

type ResolvedStyle = {
  /** URL template for vector tiles ({z}/{x}/{y}.pbf) */
  vectorTemplate: string
  /** URL template for background raster tiles (ne2_shaded or similar) */
  rasterTemplate?: string
  /** Max zoom the raster source serves — tiles above this do not exist */
  rasterMaxzoom?: number
}

/**
 * Resolve the {z}/{x}/{y} tile URL templates from the style + TileJSON, and
 * cache the style, TileJSON, sprite sheets and the latin glyph ranges so the
 * downloaded area renders complete (labels + icons) offline.
 *
 * Selects the VECTOR source for the main tile template (previously the code
 * took the first inline tiles[] match, which resolved to the ne2_shaded raster
 * PNG source that appears before openmaptiles in the liberty style manifest).
 */
async function resolveAndCacheStyleAssets(cache: Cache, signal?: AbortSignal): Promise<ResolvedStyle> {
  const styleResp = await fetchAndCache(MAP_STYLE_URL, cache, signal)
  const style = (await styleResp.clone().json()) as StyleJson

  let vectorTemplate: string | null = null
  let rasterTemplate: string | undefined
  let rasterMaxzoom: number | undefined

  for (const source of Object.values(style.sources)) {
    if (source.type === 'vector' && !vectorTemplate) {
      if (source.tiles?.[0]) {
        vectorTemplate = source.tiles[0]
      } else if (source.url) {
        const tjResp = await fetchAndCache(source.url, cache, signal)
        const tilejson = (await tjResp.clone().json()) as { tiles?: string[] }
        if (tilejson.tiles?.[0]) vectorTemplate = tilejson.tiles[0]
      }
    } else if (source.type === 'raster' && source.tiles?.[0] && !rasterTemplate) {
      rasterTemplate = source.tiles[0]
      rasterMaxzoom = source.maxzoom ?? 6
    }
  }

  if (!vectorTemplate) throw new Error('Fant ikke flisadressen i kartstilen')

  // Store for backwards compat with deleteArea on older area records
  localStorage.setItem(TEMPLATE_KEY, vectorTemplate)

  // Sprite sheets (icons)
  if (style.sprite) {
    for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) {
      try {
        await fetchAndCache(`${style.sprite}${suffix}`, cache, signal)
      } catch { /* sprite variant missing — not fatal */ }
    }
  }

  // Glyphs: the latin ranges cover GB/IE place names. Other ranges are
  // runtime-cached by the service worker as they are viewed online.
  if (style.glyphs) {
    const fontStacks = new Set<string>()
    for (const layer of style.layers) {
      const font = layer.layout?.['text-font']
      if (Array.isArray(font)) fontStacks.add((font as string[]).join(','))
    }
    const ranges = ['0-255', '256-511', '512-767']
    for (const stack of fontStacks) {
      for (const range of ranges) {
        const url = style.glyphs
          .replace('{fontstack}', encodeURIComponent(stack))
          .replace('{range}', range)
        try {
          await fetchAndCache(url, cache, signal)
        } catch { /* glyph range missing — not fatal */ }
      }
    }
  }

  return { vectorTemplate, rasterTemplate, rasterMaxzoom }
}

function tileUrl(template: string, t: { z: number; x: number; y: number }): string {
  return template
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y))
}

// ── Download / delete ──

/** Download a batch of tiles into cache using an atomic index counter
 *  (avoids O(n²) queue.shift() on large tile lists). Calls onTick() once per
 *  tile slot (hit or miss). Returns failed URLs and total bytes stored. */
async function downloadTiles(
  tiles: Array<{ z: number; x: number; y: number }>,
  template: string,
  cache: Cache,
  signal: AbortSignal,
  onTick: () => void,
): Promise<{ failed: string[]; bytes: number }> {
  const failed: string[] = []
  let idx = 0
  let bytes = 0

  async function worker() {
    for (;;) {
      if (signal.aborted) throw new DOMException('Avbrutt', 'AbortError')
      const i = idx++
      if (i >= tiles.length) break
      const tile = tiles[i]
      const url = tileUrl(template, tile)
      const existing = await cache.match(url)
      if (!existing) {
        try {
          const resp = await fetch(url, { signal })
          if (resp.ok && resp.status === 200) {
            const buf = await resp.arrayBuffer()
            bytes += buf.byteLength
            await cache.put(url, new Response(buf, {
              headers: { 'Content-Type': resp.headers.get('Content-Type') ?? 'application/x-protobuf' },
            }))
          }
          // 204/404 = empty tile (open sea) — nothing to store
        } catch (err) {
          if ((err as Error).name === 'AbortError') throw err
          failed.push(url)
        }
      }
      onTick()
    }
  }

  await Promise.all(Array.from({ length: 6 }, () => worker()))
  return { failed, bytes }
}

export async function downloadArea(
  name: string,
  bounds: LngLatBounds,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<OfflineArea> {
  // Request durable storage before the first download so iOS is less likely to
  // evict tiles under storage pressure (navigator.storage.persist() is a hint,
  // not a guarantee — but it raises priority vs. best-effort cache entries).
  if (navigator.storage?.persist) {
    void navigator.storage.persist()
  }

  const cache = await caches.open(TILE_CACHE)
  const { vectorTemplate, rasterTemplate, rasterMaxzoom } = await resolveAndCacheStyleAssets(cache, signal)

  const vectorTiles = listTiles(bounds, AREA_MIN_ZOOM, AREA_MAX_ZOOM)
  // Raster background tiles (ne2_shaded) are only available up to z6.
  const rasterTiles = rasterTemplate && rasterMaxzoom != null
    ? listTiles(bounds, AREA_MIN_ZOOM, Math.min(rasterMaxzoom, AREA_MAX_ZOOM))
    : []

  const totalTiles = vectorTiles.length + rasterTiles.length

  // Quota check before downloading (decompressed estimate)
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    const needed = estimateBytes(totalTiles)
    if (est.quota != null && est.usage != null && est.quota - est.usage < needed) {
      throw new Error(
        `Ikke nok lagringsplass: området trenger ca. ${formatBytes(needed)}.`,
      )
    }
  }

  let doneSoFar = 0
  onProgress(0, totalTiles)

  // Download vector tiles first (the important ones), then raster background
  const first = await downloadTiles(
    vectorTiles, vectorTemplate, cache, signal,
    () => onProgress(++doneSoFar, totalTiles),
  )
  let bytes = first.bytes

  // Retry failed vector tiles once (transient network blip recovery)
  let permanentFailed = first.failed
  if (first.failed.length > 0) {
    let retryIdx = 0
    const retryFailed: string[] = []
    async function retryWorker() {
      for (;;) {
        if (signal.aborted) throw new DOMException('Avbrutt', 'AbortError')
        const i = retryIdx++
        if (i >= first.failed.length) break
        const url = first.failed[i]
        try {
          const resp = await fetch(url, { signal })
          if (resp.ok && resp.status === 200) {
            const buf = await resp.arrayBuffer()
            bytes += buf.byteLength
            const ct = resp.headers.get('Content-Type') ?? 'application/x-protobuf'
            await cache.put(url, new Response(buf, { headers: { 'Content-Type': ct } }))
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') throw err
          retryFailed.push(url)
        }
      }
    }
    await Promise.all(Array.from({ length: 6 }, () => retryWorker()))
    permanentFailed = retryFailed
  }

  if (permanentFailed.length > 0) {
    throw new Error(
      `${permanentFailed.length} av ${vectorTiles.length} kartfliser mangler etter to forsøk — prøv igjen med bedre dekning.`,
    )
  }

  // Download raster background tiles (best-effort, failures are non-fatal)
  if (rasterTiles.length > 0 && rasterTemplate) {
    try {
      const { bytes: rasterBytes } = await downloadTiles(
        rasterTiles, rasterTemplate, cache, signal,
        () => onProgress(++doneSoFar, totalTiles),
      )
      bytes += rasterBytes
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      // Raster failures don't block saving — vector tiles are the critical path
    }
  }

  const area: OfflineArea = {
    id: `area-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    bounds,
    minZoom: AREA_MIN_ZOOM,
    maxZoom: AREA_MAX_ZOOM,
    tileCount: vectorTiles.length,
    bytes,
    createdAt: new Date().toISOString(),
    template: vectorTemplate,
  }
  saveAreas([...getAreas(), area])
  return area
}

/**
 * Delete an area's tiles — except tiles that another downloaded area still
 * needs (areas can overlap; shared tiles must survive).
 */
export async function deleteArea(id: string): Promise<void> {
  const areas = getAreas()
  const target = areas.find((a) => a.id === id)
  if (!target) return
  const remaining = areas.filter((a) => a.id !== id)

  // Use per-area template if available; fall back to the global key for older
  // area records saved before the template field existed.
  const template = target.template ?? localStorage.getItem(TEMPLATE_KEY)
  if (template) {
    const keep = new Set<string>()
    for (const area of remaining) {
      const areaTemplate = area.template ?? template
      for (const t of listTiles(area.bounds, area.minZoom, area.maxZoom)) {
        keep.add(tileUrl(areaTemplate, t))
      }
    }
    const cache = await caches.open(TILE_CACHE)
    for (const t of listTiles(target.bounds, target.minZoom, target.maxZoom)) {
      const url = tileUrl(template, t)
      if (!keep.has(url)) await cache.delete(url)
    }
  }

  saveAreas(remaining)
}

/** Sample a few tile URLs for an area and return true if they are in cache.
 *  Used on startup to detect iOS tile eviction. */
export async function areaHasTiles(area: OfflineArea): Promise<boolean> {
  const template = area.template ?? localStorage.getItem(TEMPLATE_KEY)
  if (!template) return false
  const cache = await caches.open(TILE_CACHE)
  // Sample up to 3 tiles spread across zoom 10 (a zoom level with good coverage)
  const sampleTiles = listTiles(area.bounds, 10, 10).slice(0, 3)
  if (sampleTiles.length === 0) return false
  for (const t of sampleTiles) {
    const hit = await cache.match(tileUrl(template, t))
    if (!hit) return false
  }
  return true
}
