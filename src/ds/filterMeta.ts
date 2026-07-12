// Multi-select filter model (Lene, 2026-07-05): each checked category adds its
// POI markers to the map; unchecking removes them. No checked categories = empty
// map (see CLAUDE.md "Map POI markers — product decision").
export type FilterState = {
  /** Selected category keys — never contains 'all' */
  categories: string[]
  /** Selected sub-types for 'locations'; only meaningful while 'locations' is selected */
  locationTypes: string[]
}

export type CategoryMeta = { key: string; label: string; types: string[]; color: string }

export const LOCATION_TYPES = ['filming', 'canonical', 'interpreted']

/**
 * SINGLE SOURCE for the category/type palette (Lene, 2026-07-05):
 * every category has a distinct colour; the Locations sub-types are
 * progressively LIGHTER shades of the Locations purple. MapView (POI dots)
 * and Badge import these — never define these colours elsewhere.
 * Reserved elsewhere: burgundy #5C1010 (favourites/selected/search pin),
 * green #2E6B3E (custom places / Mine steder).
 */
export const LOCATION_TYPE_COLORS: Record<string, string> = {
  filming:     '#5A3D95',
  canonical:   '#7659AE',
  interpreted: '#7A5FB0',
}

export const CATEGORY_META: CategoryMeta[] = [
  { key: 'atmosphere',   label: 'Atmosphere',   types: [], color: '#2A5070' },
  { key: 'attractions',  label: 'Attractions',  types: [], color: '#A04220' },
  { key: 'eat_and_drink', label: 'Eat and drink', types: [], color: '#7A5214' },
  { key: 'inspiration',  label: 'Inspiration',  types: [], color: '#7D3C6B' },
  { key: 'locations',    label: 'Locations',    types: LOCATION_TYPES, color: '#3E1F6B' },
  { key: 'sleep',        label: 'Sleep',        types: [], color: '#1F6B5E' },
  { key: 'transport',    label: 'Transport',    types: [], color: '#1A4A1A' },
]

export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORY_META.map((c) => [c.key, c.color]),
)

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
