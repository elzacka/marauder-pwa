import type { Feature, Point } from 'geojson'
import type { HPLocation, LocationType, LocationCategory } from '../types/hp-location'

export function featureToLocation(f: Feature<Point>): HPLocation {
  const p = f.properties ?? {}
  return {
    id: p.id as string,
    name: p.name as string,
    location_type: p.location_type as LocationType,
    categories: (p.categories ?? []) as LocationCategory[],
    hp_references: (p.hp_references ?? []) as string[],
    description: (p.description ?? '') as string,
    source: p.source as string,
    external_url: p.external_url as string | null,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }
}
