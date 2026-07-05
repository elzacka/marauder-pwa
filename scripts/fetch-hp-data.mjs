#!/usr/bin/env node
/**
 * Fetches and merges HP location data from Wikidata SPARQL and WikiVoyage,
 * then combines with manually curated POIs.
 *
 * Output: public/data/hp-locations.json
 *
 * Run: node scripts/fetch-hp-data.mjs
 *
 * Coordinate note: Wikidata WKT format is Point(longitude latitude) — longitude first.
 * GeoJSON coordinates are also [longitude, latitude]. Direct mapping, no swap needed.
 */

import { writeFileSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../public/data/hp-locations.json')

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

// Q216930 = Harry Potter film series on Wikidata
const SPARQL_QUERY = `
SELECT DISTINCT ?location ?locationLabel ?coords ?filmLabel ?ordinal WHERE {
  ?film wdt:P179 wd:Q216930 .
  ?film p:P179 ?seriesStmt .
  ?seriesStmt ps:P179 wd:Q216930 ;
              pq:P1545 ?ordinal .
  ?film wdt:P915 ?location .
  ?location wdt:P625 ?coords .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY xsd:integer(?ordinal) ?locationLabel
`

/** Parse WKT Point(lng lat) → [lng, lat] */
function parseWKT(wkt) {
  const m = wkt.match(/Point\(([0-9.+-]+)\s+([0-9.+-]+)\)/)
  if (!m) return null
  return [parseFloat(m[1]), parseFloat(m[2])]
}

/** Ordinal "1"–"8" → "HP1"–"HP8" */
function ordinalToRef(ordinal) {
  return `HP${ordinal}`
}

async function fetchWikidata() {
  console.log('Fetching Wikidata SPARQL...')
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'marauder-pwa/1.0 (https://github.com/elzacka/marauder-pwa)' },
  })
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`)
  const json = await res.json()

  // Group by location, collecting hp_references and coordinates
  const byLocation = new Map()
  for (const row of json.results.bindings) {
    const id = row.location.value.split('/').pop() // Q-ID
    const label = row.locationLabel.value
    const coords = parseWKT(row.coords.value)
    const ref = ordinalToRef(row.ordinal.value)

    if (!coords || label.startsWith('Q')) continue // skip if label not resolved

    if (!byLocation.has(id)) {
      byLocation.set(id, { wikidataId: id, name: label, coords, refs: new Set() })
    }
    byLocation.get(id).refs.add(ref)
  }

  return [...byLocation.values()].map((loc) => ({
    wikidataId: loc.wikidataId,
    name: loc.name,
    coords: loc.coords,
    refs: [...loc.refs].sort(),
  }))
}

async function fetchWikiVoyageListings() {
  console.log('Fetching WikiVoyage HP tourism article...')
  const url =
    'https://en.wikivoyage.org/w/api.php?action=parse&page=Harry_Potter_tourism&prop=wikitext&format=json&origin=*'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'marauder-pwa/1.0 (https://github.com/elzacka/marauder-pwa)' },
  })
  if (!res.ok) throw new Error(`WikiVoyage HTTP ${res.status}`)
  const json = await res.json()
  const wikitext = json.parse?.wikitext?.['*'] ?? ''

  // Parse {{listing|name=...|lat=...|long=...|...}} blocks
  const listings = []
  const re = /\{\{listing\b([^}]*)\}\}/gi
  let m
  while ((m = re.exec(wikitext)) !== null) {
    const block = m[1]
    const get = (key) => {
      const km = block.match(new RegExp(`\\|\\s*${key}\\s*=\\s*([^|{}]+)`))
      return km ? km[1].trim() : null
    }
    const name = get('name')
    const lat = parseFloat(get('lat') ?? '')
    const lng = parseFloat(get('long') ?? '')
    if (name && !isNaN(lat) && !isNaN(lng)) {
      listings.push({ name, lat, lng, url: get('url') ?? null })
    }
  }
  console.log(`  Found ${listings.length} WikiVoyage listings with coordinates`)
  return listings
}

// ---------------------------------------------------------------------------
// CURATED POIs — the authoritative list.
// source: "manual"  → hand-curated, coordinates verified
// source: "wikidata" → coordinate will be overridden by Wikidata result if available
// wikidata_id: used to match against SPARQL results for coordinate updates
// ---------------------------------------------------------------------------

const CURATED = [
  // --- Edinburgh ---
  {
    id: 'elephant-house',
    name: 'The Elephant House',
    location_type: 'canonical',
    categories: ['inspiration', 'eat_and_drink'],
    hp_references: ['HP1', 'HP2', 'HP3'],
    description: 'Kaffebaren der J.K. Rowling satt og skrev de første Harry Potter-bøkene.',
    source: 'manual',
    external_url: 'https://www.elephanthouse.biz',
    coords: [-3.1917, 55.9486],
  },
  {
    id: 'victoria-street',
    name: 'Victoria Street',
    location_type: 'interpreted',
    categories: ['inspiration'],
    hp_references: ['HP1'],
    description: 'Den buede gaten med fargerike fasader som sies å ha inspirert Diagon Alley.',
    source: 'manual',
    external_url: null,
    coords: [-3.1927, 55.9477],
  },
  {
    id: 'greyfriars-kirkyard',
    name: 'Greyfriars Kirkyard',
    location_type: 'interpreted',
    categories: ['inspiration', 'atmosphere'],
    hp_references: ['HP1'],
    description:
      'Kirkegården der gravsteinen til Thomas Riddle antas å ha inspirert Tom Riddle/Voldemort.',
    source: 'manual',
    external_url: 'https://www.greyfriarskirk.com',
    coords: [-3.1924, 55.9463],
  },
  {
    id: 'george-heriots-school',
    name: "George Heriot's School",
    location_type: 'interpreted',
    categories: ['inspiration', 'atmosphere'],
    hp_references: ['HP1'],
    description:
      'Det imposante renessanseslottet som sies å ha inspirert Rowling til Hogwarts-bygningen.',
    source: 'manual',
    external_url: 'https://www.george-heriots.com',
    coords: [-3.1919, 55.9455],
  },
  {
    id: 'balmoral-hotel',
    name: 'The Balmoral Hotel',
    location_type: 'canonical',
    categories: ['inspiration', 'sleep'],
    hp_references: ['HP7'],
    description:
      'Her fullførte J.K. Rowling Dødstalismanene i 2007. Rommet er nå kjent som Harry Potter-suiten.',
    source: 'manual',
    external_url: 'https://www.roccofortehotels.com/hotels-and-resorts/the-balmoral-hotel',
    coords: [-3.1882, 55.952],
  },
  // --- Scotland ---
  {
    id: 'glenfinnan-viaduct',
    name: 'Glenfinnan-viadukten',
    location_type: 'filming',
    categories: ['locations', 'transport', 'atmosphere'],
    hp_references: ['HP2', 'HP3', 'HP4', 'HP5', 'HP6'],
    description:
      'Den ikoniske jernbanebroen over Loch Shiel som Hogwarts Express krysser i filmene. Loch Shiel ble også brukt som Hogwarts-sjøen.',
    source: 'manual',
    external_url: 'https://www.nts.org.uk/visit/places/glenfinnan-monument',
    coords: [-5.4312, 56.8726],
  },
  {
    id: 'jacobite-steam-train',
    name: 'The Jacobite – Hogwarts Express-ruten',
    location_type: 'filming',
    categories: ['transport', 'attractions'],
    hp_references: ['HP2', 'HP3', 'HP4', 'HP5', 'HP6'],
    description:
      'The Jacobite er det nærmeste man kommer å ri Hogwarts Express. Damptog kjører daglig Fort William–Mallaig over Glenfinnan-viadukten der togscenene ble filmet.',
    source: 'manual',
    external_url: 'https://www.westcoastrailways.co.uk/jacobite',
    coords: [-5.1063, 56.8185],
  },
  {
    id: 'glencoe',
    name: 'Glencoe',
    location_type: 'filming',
    categories: ['locations', 'atmosphere'],
    hp_references: ['HP3', 'HP4'],
    description:
      'Dramatiske fjell og landskap brukt som eksteriører i Fangen fra Azkaban og Ildbegeret.',
    source: 'manual',
    external_url: 'https://www.nts.org.uk/visit/places/glencoe',
    coords: [-5.1012, 56.676],
  },
  {
    id: 'glen-nevis',
    name: 'Glen Nevis og Steall Falls',
    location_type: 'filming',
    categories: ['locations', 'atmosphere'],
    hp_references: ['HP4'],
    description:
      'Dalen ved Storbritannias høyeste fjell ble brukt til Triwizard-labyrinten, og Steall Falls (Steall-fossen) ble filmsted for den andre oppgaven i Ildbegeret.',
    source: 'wikidata',
    wikidata_id: 'Q3108687',
    external_url: 'https://www.walkhighlands.co.uk/lochaber/glen-nevis.shtml',
    coords: [-5.0142, 56.7957],
  },
  // --- England: Yorkshire / North ---
  {
    id: 'goathland-station',
    name: 'Goathland Station',
    location_type: 'filming',
    categories: ['locations', 'transport'],
    hp_references: ['HP1'],
    description:
      'Stasjonen på North Yorkshire Moors Railway som ble Hogsmeade stasjon i Filosofens stein.',
    source: 'manual',
    external_url: 'https://www.nymr.co.uk',
    coords: [-0.7250, 54.3996],
  },
  {
    id: 'malham-cove',
    name: 'Malham Cove',
    location_type: 'filming',
    categories: ['locations', 'atmosphere'],
    hp_references: ['HP7'],
    description:
      'Det mektige kalksteinsamfieteret i North Yorkshire ble Godric Grevende og campinglandskapet der Harry og Hermione søker Horkrukser i Dødstalismanene.',
    source: 'manual',
    external_url: 'https://www.nationaltrust.org.uk/visit/yorkshire/malham-cove',
    coords: [-2.1572, 54.0706],
  },
  {
    id: 'alnwick-castle',
    name: 'Alnwick Castle',
    location_type: 'filming',
    categories: ['locations', 'attractions'],
    hp_references: ['HP1', 'HP2'],
    description:
      'Brukt som Hogwarts-eksteriør og til Madam Hoochs flygetime med kosterne i HP1 og HP2.',
    source: 'wikidata',
    wikidata_id: 'Q1320427',
    external_url: 'https://www.alnwickcastle.com',
    coords: [-1.7042, 55.4158],
  },
  // --- England: Midlands / West ---
  {
    id: 'gloucester-cathedral',
    name: 'Gloucester Cathedral',
    location_type: 'filming',
    categories: ['locations', 'atmosphere'],
    hp_references: ['HP1', 'HP2', 'HP6'],
    description:
      'Gloucester Cathedrals middelaldersgang ble Hogwarts-korridorene der trollmannsstudentene vandrer i HP1, HP2 og HP6.',
    source: 'wikidata',
    wikidata_id: 'Q262500',
    external_url: 'https://www.gloucestercathedral.org.uk',
    coords: [-2.2478, 51.8647],
  },
  {
    id: 'lacock-abbey',
    name: 'Lacock Abbey',
    location_type: 'filming',
    categories: ['locations'],
    hp_references: ['HP1', 'HP2', 'HP6', 'HP7'],
    description:
      'Lacock Abbey i Wiltshire ble brukt i fire filmer – Snapes klasserom, Quirrells klasserom, korridor-scener og eksteriører til Godric Grevende.',
    source: 'wikidata',
    wikidata_id: 'Q1148460',
    external_url: 'https://www.nationaltrust.org.uk/visit/wiltshire/lacock-abbey-village-and-clutterbuck',
    coords: [-2.121, 51.4158],
  },
  {
    id: 'lacock-village',
    name: 'Lacock Village',
    location_type: 'filming',
    categories: ['locations', 'atmosphere'],
    hp_references: ['HP1', 'HP7'],
    description:
      'Den middelalderske landsbyen Lacock ble Godric Grevende – gatene der Voldemort angrep Potters og huset der Harry vokste opp finnes her.',
    source: 'manual',
    external_url: 'https://www.nationaltrust.org.uk/visit/wiltshire/lacock-abbey-village-and-clutterbuck',
    coords: [-2.1218, 51.4168],
  },
  {
    id: 'hardwick-hall',
    name: 'Hardwick Hall',
    location_type: 'filming',
    categories: ['locations'],
    hp_references: ['HP7'],
    description:
      'Hardwick Halls majestetiske elisabetanske fasade ble Malfoy Manor i Dødstalismanene – stedet der Harry, Ron og Hermione holdes fanget.',
    source: 'manual',
    external_url: 'https://www.nationaltrust.org.uk/visit/derbyshire/hardwick-hall',
    coords: [-1.3052, 53.1628],
  },
  {
    id: 'lavenham',
    name: 'Lavenham',
    location_type: 'filming',
    categories: ['locations', 'atmosphere'],
    hp_references: ['HP7'],
    description:
      'Den vakre trehus-landsbyen Lavenham i Suffolk ble brukt som Godric Grevende i Dødstalismanene del 1.',
    source: 'manual',
    external_url: 'https://www.discoversuffolk.org.uk/places/lavenham/',
    coords: [0.7971, 52.1052],
  },
  // --- England: Oxford ---
  {
    id: 'christ-church-oxford',
    name: 'Christ Church, Oxford',
    location_type: 'filming',
    categories: ['locations', 'attractions'],
    hp_references: ['HP1', 'HP2'],
    description:
      'Trappegangen i Christ Church ble Hogwarts-trappen der Minerva McGonagall tar imot de nye elevene i HP1. Storsalen inspirerte Hogwarts Storsalen.',
    source: 'wikidata',
    wikidata_id: 'Q745967',
    external_url: 'https://www.chch.ox.ac.uk',
    coords: [-1.2569, 51.7502],
  },
  {
    id: 'bodleian-library',
    name: 'Bodleian Library, Oxford',
    location_type: 'filming',
    categories: ['locations', 'attractions'],
    hp_references: ['HP1', 'HP2'],
    description:
      "Duke Humfrey's Library ble Hogwarts-biblioteket, og Divinity School ble sykehusfløyen der Harry våkner etter HP1s finalekamp.",
    source: 'wikidata',
    wikidata_id: 'Q82133',
    external_url: 'https://www.bodleian.ox.ac.uk',
    coords: [-1.254, 51.7542],
  },
  {
    id: 'new-college-oxford',
    name: 'New College, Oxford',
    location_type: 'filming',
    categories: ['locations'],
    hp_references: ['HP4'],
    description:
      'New Colleges middelalderklostergang ble Hogwarts-gårdsplassen der Draco Malfoy og vennene hans skuler i Ildbegeret.',
    source: 'wikidata',
    wikidata_id: 'Q1179523',
    external_url: 'https://www.new.ox.ac.uk',
    coords: [-1.2487, 51.7534],
  },
  // --- England: Durham ---
  {
    id: 'durham-cathedral',
    name: 'Durham Cathedral',
    location_type: 'filming',
    categories: ['locations', 'atmosphere'],
    hp_references: ['HP1', 'HP2'],
    description:
      'Den normanniske katedralen i Durham ble Hogwarts-korridorer og klostrene der Nevilles padde ble forvandlet til en katt i HP1.',
    source: 'wikidata',
    wikidata_id: 'Q746207',
    external_url: 'https://www.durhamcathedral.co.uk',
    coords: [-1.5758, 54.7733],
  },
  // --- England: London ---
  {
    id: 'wb-studio-tour',
    name: 'Warner Bros. Studio Tour London',
    location_type: 'filming',
    categories: ['locations', 'attractions'],
    hp_references: ['HP1', 'HP2', 'HP3', 'HP4', 'HP5', 'HP6', 'HP7', 'HP8'],
    description:
      'The Making of Harry Potter – originalrekvisitter, kostymer og settet fra alle filmene.',
    source: 'manual',
    external_url: 'https://www.wbstudiotour.co.uk',
    coords: [-0.4191, 51.6909],
  },
  {
    id: 'kings-cross',
    name: "King's Cross – Plattform 9¾",
    location_type: 'canonical',
    categories: ['locations', 'attractions', 'transport'],
    hp_references: ['HP1', 'HP2', 'HP3', 'HP4', 'HP5', 'HP6', 'HP7'],
    description:
      'Den magiske plattformen der Hogwarts Express avgår hvert år 1. september. Trolleyvognen i veggen er idag et turistikon.',
    source: 'manual',
    external_url: 'https://www.harrypotter.com/visit/platform-nine-three-quarters',
    coords: [-0.1236, 51.5322],
  },
  {
    id: 'leadenhall-market',
    name: 'Leadenhall Market',
    location_type: 'filming',
    categories: ['locations'],
    hp_references: ['HP1'],
    description:
      'Den overdekte markedshallen ble Diagon Alley-inngangen og The Leaky Cauldron-inngangen i Filosofens stein.',
    source: 'wikidata',
    wikidata_id: 'Q961148',
    external_url: null,
    coords: [-0.0831, 51.5127],
  },
  {
    id: 'australia-house',
    name: 'Australia House',
    location_type: 'filming',
    categories: ['locations'],
    hp_references: ['HP1', 'HP2'],
    description: 'Interiøret i Australia House ble brukt som filmsettet til Gringotts-banken.',
    source: 'manual',
    external_url: null,
    coords: [-0.1183, 51.5131],
  },
  {
    id: 'claremont-square',
    name: 'Claremont Square',
    location_type: 'filming',
    categories: ['locations'],
    hp_references: ['HP5', 'HP7'],
    description:
      'Torget ble filmet som Grimmauldsplass 12, hjemmet til familien Black og Ordens høkvarter.',
    source: 'manual',
    external_url: null,
    coords: [-0.1073, 51.5319],
  },
  {
    id: 'millennium-bridge',
    name: 'Millennium Bridge',
    location_type: 'filming',
    categories: ['locations'],
    hp_references: ['HP6'],
    description:
      'Millennium Bridge ble dramatisk revet ned av Voldemorts dødisere i åpningsscenen fra Halvblodsprinsen.',
    source: 'manual',
    external_url: null,
    coords: [-0.098, 51.5094],
  },
  {
    id: 'london-zoo',
    name: 'Reptilhuset, London Zoo',
    location_type: 'filming',
    categories: ['locations', 'attractions'],
    hp_references: ['HP1'],
    description:
      'Reptilhuset i London Zoo er der Harry Potter for første gang snakket med en boa-slange og uforvarende sendte Dudley inn i beholderen i Filosofens stein.',
    source: 'wikidata',
    wikidata_id: 'Q270263',
    external_url: 'https://www.zsl.org/london-zoo',
    coords: [-0.1557, 51.5358],
  },
  {
    id: 'goodwins-court',
    name: "Goodwin's Court",
    location_type: 'interpreted',
    categories: ['inspiration', 'atmosphere'],
    hp_references: [],
    description:
      "Den smaleste gaten i Covent Garden, bygget på 1600-tallet, er en av inspirasjonskildene til Diagon Alley med sine buede vinduer og gammeldagse lykter.",
    source: 'manual',
    external_url: null,
    coords: [-0.124, 51.5112],
  },
  // --- Wales ---
  {
    id: 'freshwater-west',
    name: 'Freshwater West, Pembrokeshire',
    location_type: 'filming',
    categories: ['locations', 'atmosphere'],
    hp_references: ['HP7'],
    description:
      'Den avsidesliggende stranden i Wales ble Shell Cottage og stedet der Dobby ble gravlagt i Dødstalismanene. Fans bringer fremdeles tributter til Dobbys lille grav.',
    source: 'manual',
    external_url: 'https://www.pembrokeshirecoast.wales/things-to-do/beaches/freshwater-west/',
    coords: [-5.0942, 51.6277],
  },
]

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

/**
 * For POIs with a wikidata_id, try to update their coordinates from the
 * Wikidata SPARQL results (which have building-level precision).
 */
function mergeWithWikidata(curated, wikidataResults) {
  const byQid = new Map(wikidataResults.map((r) => [r.wikidataId, r]))

  return curated.map((poi) => {
    if (!poi.wikidata_id) return poi
    const wd = byQid.get(poi.wikidata_id)
    if (!wd) return poi

    console.log(`  [Wikidata] Updated coords for ${poi.id}: ${wd.coords}`)
    return { ...poi, coords: wd.coords }
  })
}

/**
 * Convert internal curated format → GeoJSON Feature
 */
function toFeature(poi) {
  const { coords, wikidata_id, ...props } = poi
  const feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coords },
    properties: props,
  }
  if (wikidata_id) feature.properties.wikidata_id = wikidata_id
  return feature
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let wikidataResults = []
  try {
    wikidataResults = await fetchWikidata()
    console.log(`  Got ${wikidataResults.length} Wikidata locations`)
  } catch (e) {
    console.warn(`  Wikidata fetch failed (${e.message}), using manual coordinates`)
  }

  // WikiVoyage fetch (informational — we use it to spot gaps, not to auto-import)
  try {
    const wvListings = await fetchWikiVoyageListings()
    const curatedNames = new Set(CURATED.map((p) => p.name.toLowerCase()))
    const gaps = wvListings.filter((l) => !curatedNames.has(l.name.toLowerCase()))
    if (gaps.length) {
      console.log(`\nWikiVoyage listings not yet in curated set (${gaps.length}):`)
      gaps.slice(0, 10).forEach((g) => console.log(`  - ${g.name} (${g.lat}, ${g.lng})`))
    }
  } catch (e) {
    console.warn(`  WikiVoyage fetch failed: ${e.message}`)
  }

  const merged = mergeWithWikidata(CURATED, wikidataResults)
  const fc = {
    type: 'FeatureCollection',
    features: merged.map(toFeature),
  }

  writeFileSync(OUT, JSON.stringify(fc, null, 2), 'utf8')
  console.log(`\nWrote ${fc.features.length} features to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
