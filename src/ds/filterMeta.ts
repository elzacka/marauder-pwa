// Multi-select filter model (Lene, 2026-07-05): each checked category adds its
// POI markers to the map; unchecking removes them. No checked categories = empty
// map (see CLAUDE.md "Map POI markers — product decision").
export type FilterState = {
  /** Selected category keys — never contains 'all' */
  categories: string[]
  /** Selected sub-types for 'locations'; only meaningful while 'locations' is selected */
  locationTypes: string[]
}

export type CategoryMeta = { key: string; label: string; types: string[] }

export const LOCATION_TYPES = ['filming', 'canonical', 'interpreted']

export const CATEGORY_META: CategoryMeta[] = [
  { key: 'atmosphere',   label: 'Atmosphere',   types: [] },
  { key: 'attractions',  label: 'Attractions',  types: [] },
  { key: 'eat_and_drink', label: 'Eat and drink', types: [] },
  { key: 'inspiration',  label: 'Inspiration',  types: [] },
  { key: 'locations',    label: 'Locations',    types: LOCATION_TYPES },
  { key: 'sleep',        label: 'Sleep',        types: [] },
  { key: 'transport',    label: 'Transport',    types: [] },
]

export const ALL_CATEGORY_KEYS = CATEGORY_META.map((c) => c.key)

export function emptyFilter(): FilterState {
  return { categories: [], locationTypes: [] }
}

export function fullFilter(): FilterState {
  return { categories: [...ALL_CATEGORY_KEYS], locationTypes: [...LOCATION_TYPES] }
}

/** Does a location match the current filter? Empty selection matches everything
 *  (used for search scope; the map layer is hidden separately when empty). */
export function locationMatchesFilter(
  locCategories: string[],
  locationType: string,
  f: FilterState,
): boolean {
  if (f.categories.length === 0) return true
  for (const c of f.categories) {
    if (c === 'locations') {
      if (
        locCategories.includes('locations') &&
        (f.locationTypes.length === 0 || f.locationTypes.includes(locationType))
      ) return true
    } else if (locCategories.includes(c)) {
      return true
    }
  }
  return false
}
