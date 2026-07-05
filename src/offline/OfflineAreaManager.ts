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
}

const AREAS_KEY = 'marauder-offline-areas'
const TEMPLATE_KEY = 'marauder-tile-template'

/** Must match the runtimeCaching cacheName in vite.config.ts */
export const TILE_CACHE = 'map-tiles'

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/** Vector data stops at z14; MapLibre overzooms beyond that, so z14 gives
 *  full street detail. z4 matches the map's minZoom. */
export const AREA_MIN_ZOOM = 4
export const AREA_MAX_ZOOM = 14

/** Rough estimate per vector tile (openfreemap, gzipped) */
const TILE_SIZE_ESTIMATE = 35_000

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

// ── Style / tile template resolution ──

type StyleJson = {
  sources: Record<string, { url?: string; tiles?: string[] }>
  layers: Array<{ layout?: Record<string, unknown> }>
  glyphs?: string
  sprite?: string
}

async function fetchAndCache(url: string, cache: Cache, signal?: AbortSignal): Promise<Response> {
  const cached = await cache.match(url)
  if (cached) return cached
  const resp = await fetch(url, { signal })
  if (resp.ok) await cache.put(url, resp.clone())
  return resp
}

/**
 * Resolve the {z}/{x}/{y} tile URL template from the style + TileJSON, and
 * cache the style, TileJSON, sprite sheets and the latin glyph ranges so the
 * downloaded area renders complete (labels + icons) offline.
 */
async function resolveAndCacheStyleAssets(cache: Cache, signal?: AbortSignal): Promise<string> {
  const styleResp = await fetchAndCache(MAP_STYLE_URL, cache, signal)
  const style = (await styleResp.clone().json()) as StyleJson

  let template: string | null = null
  for (const source of Object.values(style.sources)) {
    if (source.tiles?.[0]) {
      template = source.tiles[0]
      break
    }
    if (source.url) {
      const tjResp = await fetchAndCache(source.url, cache, signal)
      const tilejson = (await tjResp.clone().json()) as { tiles?: string[] }
      if (tilejson.tiles?.[0]) {
        template = tilejson.tiles[0]
        break
      }
    }
  }
  if (!template) throw new Error('Fant ikke flisadressen i kartstilen')
  localStorage.setItem(TEMPLATE_KEY, template)

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

  return template
}

function tileUrl(template: string, t: { z: number; x: number; y: number }): string {
  return template
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y))
}

// ── Download / delete ──

export async function downloadArea(
  name: string,
  bounds: LngLatBounds,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<OfflineArea> {
  const cache = await caches.open(TILE_CACHE)
  const template = await resolveAndCacheStyleAssets(cache, signal)
  const tiles = listTiles(bounds, AREA_MIN_ZOOM, AREA_MAX_ZOOM)

  // Quota check before downloading (same principle as K10)
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    const needed = estimateBytes(tiles.length)
    if (est.quota != null && est.usage != null && est.quota - est.usage < needed) {
      throw new Error(
        `Ikke nok lagringsplass: området trenger ca. ${formatBytes(needed)}.`,
      )
    }
  }

  let done = 0
  let bytes = 0
  onProgress(0, tiles.length)

  // Modest concurrency — fast enough, polite to the free tile service
  const CONCURRENCY = 6
  const queue = [...tiles]

  async function worker() {
    while (queue.length > 0) {
      if (signal.aborted) throw new DOMException('Avbrutt', 'AbortError')
      const tile = queue.shift()
      if (!tile) return
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
          // Single failed tile: skip — the SW falls back to network for it later
        }
      }
      done += 1
      onProgress(done, tiles.length)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  const area: OfflineArea = {
    id: `area-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    bounds,
    minZoom: AREA_MIN_ZOOM,
    maxZoom: AREA_MAX_ZOOM,
    tileCount: tiles.length,
    bytes,
    createdAt: new Date().toISOString(),
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

  const template = localStorage.getItem(TEMPLATE_KEY)
  if (template) {
    const keep = new Set<string>()
    for (const area of remaining) {
      for (const t of listTiles(area.bounds, area.minZoom, area.maxZoom)) {
        keep.add(tileUrl(template, t))
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
