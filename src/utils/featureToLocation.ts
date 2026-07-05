import type { Feature, Point } from 'geojson'
import type { HPLocation, LocationType, LocationCategory } from '../types/hp-location'

/**
 * MapLibre serialises array/object properties to JSON strings when features are
 * queried from rendered layers. This helper accepts both shapes.
 */
function parseStringArray(v: unknown): string[] {
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v) as unknown
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }
  return Array.isArray(v) ? (v as string[]) : []
}

/**
 * Single conversion point for GeoJSON properties → HPLocation (see CLAUDE.md:
 * do not duplicate this conversion in components). Handles both raw GeoJSON
 * properties and MapLibre-serialised properties from queried features.
 */
/** Only http(s) URLs are allowed into href attributes — the data pipeline
 *  pulls from external sources (Wikidata/WikiVoyage), so never trust it (K9). */
function safeExternalUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v === '') return null
  return /^https?:\/\//i.test(v) ? v : null
}

export function propsToLocation(
  p: Record<string, unknown>,
  lng: number,
  lat: number,
): HPLocation {
  return {
    id: p.id as string,
    name: p.name as string,
    location_type: p.location_type as LocationType,
    categories: parseStringArray(p.categories) as LocationCategory[],
    hp_references: parseStringArray(p.hp_references),
    description: (p.description ?? '') as string,
    source: p.source as string,
    external_url: safeExternalUrl(p.external_url),
    lat,
    lng,
  }
}

export function featureToLocation(f: Feature<Point>): HPLocation {
  return propsToLocation(
    f.properties ?? {},
    f.geometry.coordinates[0],
    f.geometry.coordinates[1],
  )
}
