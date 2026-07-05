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
  - **Exception (Lene, 2026-07-05):** category/type filter labels, badges, and HP book titles stay in English — use established Harry Potter-universe terminology (e.g. "Filming", "Canonical", "Eat and drink"). Do not translate these to Norwegian.
- Layout debugging: never estimate pixel positions or layout metrics from screenshots. For layout bugs that only reproduce on device, add a temporary debug overlay (viewport/safe-area/display-mode values) or request Safari Web Inspector readings, and ask whether the app runs in Safari or as installed PWA before theorizing.
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

## iOS 26 / Safari 26 platform notes

Current target: iOS 26.5.2 / Safari 26.5.2 (as of 2026-07-05).

**Status bar style** — `apple-mobile-web-app-status-bar-style` must be `default`, not `black-translucent`.
With `black-translucent` iOS 26 places the standalone webview at the top of the screen but sizes it screen-minus-status-bar (inner 793 of 852pt measured on-device), leaving a dead 59pt strip at the bottom that no CSS can paint. With `default` the webview sits below the status bar and reaches the physical bottom edge.

**Body/manifest background** — iOS 26 reserves a bottom zone (home indicator area) and tints it by sampling the page background. `html, body, #root { background }` and `background_color` in the PWA manifest must be set to `#E3DCCD` — the rendered parchment tone of the map (world-mask #EAD8AE at 0.72 opacity over tiles + sepia filter, measured from device screenshot 2026-07-05). If either value drifts from the other, the reserved zone will show as a distinct bar. See `src/main.css` and `vite.config.ts`.

## Design tokens

Parchment #E8D5AA · Burgundy #5C1010 · Dark ink #1A0A00 · Gold #9E6B1A
Fonts: Cinzel Decorative (headings) + EB Garamond (body), self-hosted via @fontsource

Note: `html/body` background and PWA manifest `background_color` are `#E3DCCD` — distinct from the Parchment design token (#E8D5AA). See iOS 26 platform notes above for why.
