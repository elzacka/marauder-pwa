export type FilterState = {
  category: string
  locationType: string
}

export type CategoryMeta = { key: string; label: string; types: string[] }

export const CATEGORY_META: CategoryMeta[] = [
  { key: 'all',          label: 'All',          types: [] },
  { key: 'atmosphere',   label: 'Atmosphere',   types: [] },
  { key: 'attractions',  label: 'Attractions',  types: [] },
  { key: 'eat_and_drink', label: 'Eat and drink', types: [] },
  { key: 'inspiration',  label: 'Inspiration',  types: [] },
  { key: 'locations',    label: 'Locations',    types: ['filming', 'canonical', 'interpreted'] },
  { key: 'sleep',        label: 'Sleep',        types: [] },
  { key: 'transport',    label: 'Transport',    types: [] },
]
