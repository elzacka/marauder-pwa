export type FilterState = {
  category: string
  locationType: string
}

export type CategoryMeta = { key: string; label: string; types: string[] }

export const CATEGORY_META: CategoryMeta[] = [
  { key: 'all',             label: 'Alle',         types: ['filming', 'canonical', 'interpreted'] },
  { key: 'hogwarts',        label: 'Hogwarts',     types: ['filming', 'canonical', 'interpreted'] },
  { key: 'diagon_alley',    label: 'Diagon Alley', types: ['filming', 'interpreted'] },
  { key: 'hogsmeade',       label: 'Hogsmeade',    types: ['filming'] },
  { key: 'ministry',        label: 'Ministry',     types: ['filming'] },
  { key: 'other_wizarding', label: 'Annet',        types: ['canonical', 'interpreted'] },
]
