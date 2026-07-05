export type LocationType = 'filming' | 'canonical' | 'interpreted'
export type LocationCategory =
  | 'atmosphere'
  | 'attractions'
  | 'eat_and_drink'
  | 'inspiration'
  | 'sleep'
  | 'locations'
  | 'transport'

export type HPLocation = {
  id: string
  name: string
  location_type: LocationType
  categories: LocationCategory[]
  hp_references: string[]
  description: string
  source: string
  external_url: string | null
  /** Geo tags for the clickable tag chips (English established names) */
  country: string | null
  city: string | null
  lat: number
  lng: number
}

export const HP_BOOK_TITLES: Record<string, string> = {
  HP1: "Philosopher's Stone",
  HP2: 'Chamber of Secrets',
  HP3: 'Prisoner of Azkaban',
  HP4: 'Goblet of Fire',
  HP5: 'Order of the Phoenix',
  HP6: 'Half-Blood Prince',
  HP7: 'Deathly Hallows',
}

export function formatHpRef(ref: string): string {
  const title = HP_BOOK_TITLES[ref]
  return title ? `${ref} – ${title}` : ref
}
