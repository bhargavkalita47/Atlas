# Atlas

A reusable, provider-independent mapping toolkit with an interactive testing playground.

**Status:** v0.1 foundation. This repo is deliberately separate from CivicWatch and Shikshak.

## Repository layout

- `packages/core` — geometry, geographic types and Photon/Nominatim geocoding.
- `packages/react` — React + Leaflet map, marker and shape components.
- `apps/playground` — Atlas Lab, a full-screen map feature-testing application.

## Local development

Requires Node 22+.

```sh
npm install
npm run dev  # builds SDK packages before launching playground
npm run test
npm run build
```

The development server is at http://localhost:5173.

## Cloudflare deployment

A root `wrangler.jsonc` serves the playground as static assets. Connect this repository to Cloudflare Workers or Pages with:
- Build command: `npm run build`
- Build output directory (Pages): `apps/playground/dist`
- Root directory: repository root

For Workers, deploy `npx wrangler deploy` after building.

## Features available in v0.1

Map pan/zoom, customizable raster tile sources, selectable markers and marker dragging, shapes and distance measurement, location search, reverse lookup, browser geolocation, GeoJSON export, event logging and a diagnostics panel.

**Limitations:** Custom vector feature colors, 3D, offline tile packaging and road-based turn-by-turn routing are not yet included. Raster tile styles depend on the provider, and demo public tile/geocoding endpoints have limits; configure an appropriate provider for production traffic.

## Philosophy

Atlas contains mapping capabilities, never CivicWatch or Shikshak business logic. Applications own their own data and permissions.

## Licenses and attribution

Atlas source is MIT licensed. Leaflet is BSD-2-Clause. OpenStreetMap data is available under ODbL and requires attribution. Photon and Nominatim are separate services with their own licenses and hosting policies. The public OSM tile service is not a production SLA. Do not proxy or bulk-fetch its tiles.

See `LICENSE` and `docs/ARCHITECTURE.md` for details.
