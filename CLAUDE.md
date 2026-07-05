# Marauder — project rules for Claude Code

Stack-specific rules. Global rules live in ~/.claude/CLAUDE.md and apply here too.

## Project context

Harry Potter PWA for Storbritannia/Irland. Deadline: trip 24. juli 2026.
Repo: https://github.com/elzacka/marauder-pwa. Deploy: Cloudflare Pages.

Primary users: Lene + her 14-year old daughter, on iPhones, often offline (Scottish trains).

## Data files

Two copies of location data exist — keep them in sync or remove the stale one:
- `public/data/hp-locations.json` — canonical, 30 features, fetched at runtime (served by Workbox)
- `src/data/hp-locations.json` — stale 14-feature snapshot; do NOT import this file in source code

**Never import `src/data/hp-locations.json` directly into any component or module.**
The correct path is to use `useHPLocations()` which fetches from `public/data/`.

To update POI data: `npm run fetch-data` (runs `scripts/fetch-hp-data.mjs`).

## Architecture

- Single data pipeline: `public/data/hp-locations.json` → `useHPLocations()` → parses via `featureToLocation()` from `src/utils/featureToLocation.ts` → returns `{ data: FeatureCollection, locations: HPLocation[], loading }`.
- `data` (raw FeatureCollection) goes to MapView for MapLibre GL layers.
- `locations` (parsed HPLocation[]) goes to MenuSheet for search/filter lists.
- Do NOT duplicate the GeoJSON→HPLocation conversion in components. Extend `featureToLocation.ts` if the type changes.

## TypeScript

`tsc --noEmit` does NOT work for this project (project references).
Always use: `tsc --noEmit -p tsconfig.app.json`

## Conventions

- All code, identifiers, types, and tab values in English. Norwegian is for user-facing text only.
- No emojis — not in code, strings, or any source file. Use SVG or CSS for icon-like symbols.
- No JSON bundle imports from `src/data/`. Data belongs in `public/` and is fetched, not bundled.
- Props declared in a component's `Props` type must be destructured and used. Prefix with `_` only when an interface forces inclusion but the value is genuinely unused.

## Dead code

`NearbySheet.tsx` is not imported anywhere (replaced by MenuSheet). It is kept intentionally for now; do not extract logic from it — it will be deleted.

## Offline-first priorities

P1: Offline Skottland-tiles (togreisen). P1: iPhone optimisation. P2+ everything else.
When adding features, verify PWA offline behaviour manually on iPhone or via DevTools offline mode.

## Map flyTo

Whenever a location is selected (HP location, custom place, geocode result), the map must pan to it:
- HP location / favourites: `mapRef.current?.flyTo(loc.lng, loc.lat)` — already in `handleLocationSelect`
- Geocode: `mapRef.current?.flyTo(lng, lat)` — already in `handleAddressSelect`
- Custom place add: `mapRef.current?.flyTo(p.lng, p.lat)` — already in `handleSaveCustomPlace`

## Design tokens

Parchment #E8D5AA · Burgundy #5C1010 · Dark ink #1A0A00 · Gold #9E6B1A
Fonts: Cinzel Decorative (headings) + EB Garamond (body), self-hosted via @fontsource
