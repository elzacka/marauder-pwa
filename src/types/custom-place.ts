export type CustomPlace = {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  createdAt: string
  /** Geo tags for chips — reverse-geocoded automatically when online */
  country?: string | null
  city?: string | null
  /** User-defined filter tags (chips), e.g. "Hotell" */
  tags?: string[]
  /** True once a reverse-geocode attempt has been made (even if it returned nothing) */
  geoTried?: boolean
}
