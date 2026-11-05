# Atlas

A reusable, provider-independent mapping toolkit with an interactive testing playground.

**Status:** v0.2 vector styling preview, with an active stabilization branch (pre-release). This repo is deliberately separate from CivicWatch and Shikshak.

## Repository layout

- `packages/core` — geometry, geographic types and Photon/Nominatim geocoding.
- `packages/react` — React adapters for Leaflet raster and MapLibre vector maps, marker and shape components.
- `apps/playground` — Atlas Lab, a full-screen map feature-testing application.

## Local development

Requires Node 22+.

```sh
npm install
npm run dev  # builds SDK packages before launching playground
npm run test
npm run build
npx playwright install chromium # first time only
npm run test:e2e           # browser smoke tests
```

The development server is at http://localhost:5173. The playground initializes the MapLibre v6 browser worker using the Vite `?worker&url` import before rendering the vector map. Applications using `@atlas/react/vector` must configure the MapLibre worker for their bundler (see `packages/react/README.md`).

## Cloudflare deployment

A root `wrangler.jsonc` serves the playground as static assets. Connect this repository to Cloudflare Workers or Pages with:
- Build command: `npm run build`
- Build output directory (Pages): `apps/playground/dist`
- Root directory: repository root

For Workers, deploy `npx wrangler deploy` after building.

## Features available in the current preview

Map pan/zoom, vector theme editing (land, water, parks, roads, buildings and labels), keyless vector tiles via OpenFreeMap, an OSM raster fallback, selectable and draggable markers, shapes and distance measurement, location search, reverse lookup, browser geolocation, GeoJSON export, event logging and diagnostics.

**Limitations:** Vector color editing operates on identifiable layers in a supplied MapLibre style; some cartographic layers may require more detailed rules. 3D, offline tile packaging, road routing, private tile hosting, and full vector style JSON editing are not yet included. Public geocoding and tile endpoints do not provide a guaranteed SLA. No paid map API key is required for the testing playground.

## Philosophy

Atlas contains mapping capabilities, never CivicWatch or Shikshak business logic. Applications own their own data and permissions.

## Licenses and attribution

Atlas source is MIT licensed. Leaflet is BSD-2-Clause; MapLibre is BSD-3-Clause. OpenStreetMap data is available under ODbL and requires attribution. Photon and Nominatim are separate services with their own licenses and hosting policies. The playground's default editable vector map uses the third-party OpenFreeMap public instance, which requires no registration or API key. It remains a hosted service, not Atlas-owned infrastructure; self-hosting is optional. The public OSM raster service is not a production SLA. Do not proxy or bulk-fetch its tiles.

See `LICENSE`, `docs/ARCHITECTURE.md` and `docs/STABILIZATION.md` for details.
