# Marauder — project rules for Claude Code

Stack-specific rules. Global rules live in ~/.claude/CLAUDE.md and apply here too.

## Project context

Harry Potter PWA for Great Britain and Irland.
Repo: https://github.com/elzacka/marauder-pwa. Deploy: GitHub Pages (Actions workflow).

## CI / deployment

Pipeline: `tsc -b && vite build` → upload artifact → `actions/deploy-pages@v4`.

When a deployment fails, check the build job first before assuming a code bug:
- Build job passes (green) + deploy job fails with "Deployment failed, try again later" → transient GitHub Pages infra error → `gh run rerun <id> --failed`
- Build job fails → look for tsc/vite errors in the build step log

Primary users: Lene + her 14-year old daughter, on iPhones, often offline (Scottish trains).

## Data files

- `public/data/hp-locations.json` — canonical, fetched at runtime (served by Workbox).
  The stale `src/data/` copy was deleted 2026-07-05; never reintroduce bundled JSON
  under `src/data/`. Use `useHPLocations()` which fetches from `public/data/`.

To update POI data: `npm run fetch-data` (runs `scripts/fetch-hp-data.mjs`).

Geo tags (country/city) for the clickable chip filter are curated in the `GEO_TAGS`
map at the top of `scripts/fetch-hp-data.mjs`. When adding a new POI, add an entry
there — the script logs a warning for any POI that is missing one.

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
  - **Exception (Lene, 2026-07-05):** category/type filter labels, badges, and HP book titles stay in English — use established Harry Potter-universe terminology (e.g. "Filming", "Canonical", "Eat and drink"). Do not translate these to Norwegian.
- Layout debugging: never estimate pixel positions or layout metrics from screenshots. For layout bugs that only reproduce on device, add a temporary debug overlay (viewport/safe-area/display-mode values) or request Safari Web Inspector readings, and ask whether the app runs in Safari or as installed PWA before theorizing.
- No emojis — not in code, strings, or any source file. Use SVG or CSS for icon-like symbols.
- No JSON bundle imports from `src/data/`. Data belongs in `public/` and is fetched, not bundled.
- Props declared in a component's `Props` type must be destructured and used. Prefix with `_` only when an interface forces inclusion but the value is genuinely unused.

## Dead code

All previously known-unused files were deleted 2026-07-05: `NearbySheet.tsx`,
`ds/CategoryFilter.tsx`, `OfflineDownload.tsx`, `ds/Button.tsx`,
`ds/BottomSheet.tsx` (+ their .module.css) and the stale `src/data/hp-locations.json`.
`AppHeader.tsx` is back IN USE (the "Marauder" wordmark — reinstated 2026-07-05
after being removed by mistake during PWA layout debugging). Do not delete it.

Deleted 2026-07-06: `src/hooks/useNominatim.ts` — replaced by `src/hooks/useGeocoder.ts`
(Photon geocoder, prefix/fuzzy search, filtered to GB/IE bbox).

## Offline-first priorities

P1: Offline Skottland-tiles (togreisen). P1: iPhone optimisation. P2+ everything else.
When adding features, verify PWA offline behaviour manually on iPhone or via DevTools offline mode.

## Offline map model — product decision (Lene, 2026-07-05)

Area-based downloads, the Tråkke iOS model: the user downloads selected areas
(current map view) locally on the device. NO external storage service, no
pmtiles/OPFS — that path was removed 2026-07-05.

- `src/offline/OfflineAreaManager.ts` computes the XYZ tile pyramid (z4–14) for
  an area, fetches every openfreemap vector tile into the Cache API cache
  `map-tiles`, and prefetches style/TileJSON/sprites/latin glyphs.
- The service worker serves `tiles.openfreemap.org` CacheFirst from the SAME
  cache (`runtimeCaching` in vite.config.ts) — this is what makes downloaded
  areas render offline. Keep the cacheName `map-tiles` in sync between the two.
- Area metadata lives in localStorage (`marauder-offline-areas`). Deleting an
  area keeps tiles that other overlapping areas still need.
- Do not reintroduce a single-file (pmtiles) download or external hosting.

## Map POI markers — product decision

The map starts EMPTY (Lene, 2026-07-05). Categories are MULTI-SELECT checkboxes:
each checked category/sub-type adds its POI markers to the map, unchecking
removes them, and no checked categories = no markers (`activeFilter` starts as
`emptyFilter()`, `hp-dots` layer starts `visibility: 'none'`). "All places" is a
master toggle. Do not "fix" this by showing markers on startup, and do not
revert FilterState to single-select. Search pins, custom-place markers and the
selected-location marker are unaffected.

## Base layers

Two base layers, chosen in Settings: Standard (openfreemap vector; works
offline in downloaded areas) and Satellitt (Esri World Imagery raster + the
standard style's symbol layers restyled white-with-dark-halo on top; online
only). Esri is free-with-attribution, not open source — chosen because open
alternatives (Sentinel-2, 10 m) lack street-level detail. Switching base layer
calls `map.setStyle`, which wipes custom layers/images — MapView re-adds
overlays and re-triggers data effects via `mapReady`.

## Map flyTo

`flyTo(lng, lat, zoom?, offsetY?)` — the 4th param shifts the animation target
vertically (pixels, negative = up) so the marker lands in the visible upper portion
of the screen above a bottom sheet. Do not remove the offset from `handleLocationSelect`.

Whenever a location is selected (HP location, custom place, geocode result), the map must pan to it:
- HP location / favourites: `mapRef.current?.flyTo(loc.lng, loc.lat, 13, -Math.round(window.innerHeight * 0.16))` — already in `handleLocationSelect`
- Geocode: `mapRef.current?.flyTo(lng, lat)` — already in `handleAddressSelect`
- Custom place add: `mapRef.current?.flyTo(p.lng, p.lat)` — already in `handleSaveCustomPlace`

## Bottom sheets

Three snap points — keep `SNAP_FRACTIONS` in `src/hooks/useSheetDrag.ts` in sync with the
CSS tokens in `src/ds/tokens.css`:

| Size | Fraction | CSS token |
|------|----------|-----------|
| default | 33 % | `--sheet-default-height` |
| half | 50 % | `--sheet-half-height` |
| expanded | 70 % | `--sheet-expanded-height` |

(Expanded is 70svh, not 85: a taller sheet pushed the search field out of
view when the iOS keyboard was open — diagnosed 2026-07-06.)

`POIDetailSheet` is non-modal (no backdrop, no `aria-modal`). The map stays
pannable while a detail sheet is open; tapping a different POI switches
selection. Close via drag-down or Escape.

**Never animate `transform` on `.maplibregl-marker` elements.** MapLibre positions
markers via inline `transform`; an animation with `fill-mode: both` or `forwards`
overrides it permanently and strands the pin at the top-left corner, detached from
map panning. Animate `opacity` instead. The geocode-marker pop was fixed this way
on 2026-07-06 after diagnosing the stuck-pin bug live.

## iOS 26 / Safari 26 platform notes

Current target: iOS 26.5.2 / Safari 26.5.2 (as of 2026-07-05).

**Status bar style** — `apple-mobile-web-app-status-bar-style` must be `default`, not `black-translucent`.
With `black-translucent` iOS 26 places the standalone webview at the top of the screen but sizes it screen-minus-status-bar (inner 793 of 852pt measured on-device), leaving a dead 59pt strip at the bottom that no CSS can paint. With `default` the webview sits below the status bar and reaches the physical bottom edge.

**Body/manifest background** — iOS 26 reserves a bottom zone (home indicator area) and tints it by sampling the page background. `html, body, #root { background }` and `background_color` in the PWA manifest must be set to `#E3DCCD` — the rendered parchment tone of the map (world-mask #EAD8AE at 0.72 opacity over tiles + sepia filter, measured from device screenshot 2026-07-05). If either value drifts from the other, the reserved zone will show as a distinct bar. See `src/main.css` and `vite.config.ts`.

## Design tokens

Parchment #E8D5AA · Burgundy #5C1010 · Dark ink #1A0A00 · Gold #9E6B1A
Fonts: Cinzel Decorative (headings) + EB Garamond (body), self-hosted via @fontsource

Note: `html/body` background and PWA manifest `background_color` are `#E3DCCD` — distinct from the Parchment design token (#E8D5AA). See iOS 26 platform notes above for why.

**Single palette source** — all category and location-type colours live in
`src/ds/filterMeta.ts` (`CATEGORY_META[*].color`, `LOCATION_TYPE_COLORS`,
`CATEGORY_COLORS`). `Badge.tsx` and `MapView.tsx` import from there.
Never define these colours elsewhere. Reserved outside the palette:
burgundy `#5C1010` (favourites / selected marker / search pin),
green `#2E6B3E` (custom places / Mine steder).

## Custom places

Geo tags (country/city) are reverse-geocoded automatically via Photon when a
place is added (fire-and-forget). A backfill pass runs once on mount for older
places saved before tags existed. Both paths are in `src/hooks/useCustomPlaces.ts`.
For UK points Photon returns `state` (Scotland/England/Wales) as the "country" — the
hook maps `country === 'United Kingdom' → state` so the chips match the HP data.
