# Maintaining the places (`hp-locations.json`)

This file is the **single source of truth** for every place shown in Marauder.
There is no generator script anymore — you edit this JSON **by hand**. The app
fetches it at runtime (`useHPLocations()`), so whatever is here is what users see
on the map and in the lists.

- **File:** `public/data/hp-locations.json`
- **Format:** a GeoJSON `FeatureCollection` — a top-level object with a
  `"features"` array, one entry per place.
- **Language:** English only (descriptions, fun facts, everything user-facing).

---

## Anatomy of one place

Each place is one GeoJSON `Feature`. Here is a fully annotated example:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-3.1882, 55.952]   // [longitude, latitude] — LON FIRST
  },
  "properties": {
    "id": "balmoral-hotel",            // unique, lowercase-with-dashes, never reuse
    "name": "The Balmoral Hotel",      // shown as the title
    "location_type": "canonical",      // canonical | filming | interpreted
    "categories": ["inspiration", "sleep"],
    "hp_references": ["HP7"],           // HP1..HP8
    "description": "Where J.K. Rowling finished the Deathly Hallows in 2007.",
    "source": "manual",                // use "manual" for anything you add by hand
    "external_url": "https://www.roccofortehotels.com/hotels-and-resorts/the-balmoral-hotel/",
    "country": "Scotland",             // drives the geo-tag chip filter
    "city": "Edinburgh",               // drives the geo-tag chip filter
    "fun_fact": "She signed a marble bust in room 552."
  }
}
```

---

## Field reference

| Field | Required | Purpose / allowed values |
|-------|----------|--------------------------|
| `geometry.coordinates` | yes | `[longitude, latitude]`. **Longitude first.** Edinburgh ≈ `[-3.19, 55.95]`. |
| `id` | yes | Unique slug, lowercase with dashes. Don't reuse or rename an existing one. |
| `name` | yes | Display title. |
| `location_type` | yes | `canonical` (book/real place), `filming` (film location), or `interpreted`. |
| `categories` | yes | One or more of: `atmosphere`, `attractions`, `eat_and_drink`, `inspiration`, `locations`, `sleep`, `transport`. |
| `hp_references` | yes | Any of `HP1`–`HP8` (book/film numbers). |
| `description` | yes | The text shown on the place. Keep it to a sentence or two. |
| `source` | yes | Set `"manual"` for hand-added places. |
| `external_url` | optional | The **"Les mer" link**. Omit the field (or set `null`) to hide the button. |
| `country`, `city` | recommended | Power the clickable geo-tag chips. Set both on every place. |
| `fun_fact` | optional | Small highlighted fact. |
| `wikidata_id` | optional | Only present on places originally imported from Wikidata. Leave as-is; not needed for new places. |

---

## Common tasks

**Edit a description or fun fact** — find the place by `name`, change the
`description` / `fun_fact` string, save.

**Fix or replace a "Les mer" link** — change `external_url`. Paste the full
`https://…` URL. To remove a broken link entirely, delete the whole
`"external_url": "…",` line (remember to remove the trailing comma issue — see
"Keep it valid JSON" below).

**Add a new place** — copy an existing Feature block, paste it as a new entry in
the `features` array (comma between entries), then change every field. Give it a
new unique `id` and correct `coordinates`.

**Remove a place** — delete its entire `{ … }` Feature block, and make sure the
commas between the remaining blocks are still correct.

**Move a pin / fix coordinates** — edit `geometry.coordinates`. Get the numbers
from Google Maps (right-click → the first number is latitude, the second is
longitude) and **swap them**, because GeoJSON is `[longitude, latitude]`.

---

## Keep it valid JSON (the one thing that breaks the app)

- Every string in double quotes `"like this"`.
- Commas **between** items, but **no comma after the last** item in an array or
  object.
- No comments in the real file (the `//` notes above are only for this guide).

Quick check after editing (run from the repo root):

```bash
node -e "JSON.parse(require('fs').readFileSync('public/data/hp-locations.json','utf8')); console.log('valid JSON')"
```

If it prints `valid JSON`, you're safe. If it throws, it names the line to fix.

---

## Preview and publish

- **Local preview:** `npm run dev` — changes hot-reload immediately.
- **Publish:** commit and push. GitHub Pages rebuilds and deploys.
- **See it on your phone:** the service worker caches this file, so after a
  deploy do a hard refresh, or close and reopen the installed PWA, to pick up
  the new data.
