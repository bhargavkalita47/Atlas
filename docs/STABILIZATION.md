# Atlas stabilization — step 1

This document tracks the isolated `dev/stabilization` branch. `main`, CivicWatch, and Shikshak remain untouched until the draft pull request is intentionally reviewed and merged.

## Implemented on this branch

- **Decoupled entry points**: `@atlas/react` for Leaflet; `@atlas/react/vector` for MapLibre. Vector is optional and keeps raster-only consumers from importing the heavy WebGL renderer.
- **Map lifecycle**: vector style changes update the existing map rather than remounting it. Custom layers and the current theme are reinstalled on `style.load`; load failures have bounded timeouts and a raster fallback.
- **Marker reconciliation**: both engines update DOM markers by stable ID instead of destroying and recreating every marker on a single selection or drag.
- **Geographic core**: strict coordinate parsing (rejecting empty values), more efficient path-length calculation, configurable geocoding timeouts and paced requests.
- **GeoJSON**: reusable `toAtlasGeoJSON` and `parseAtlasGeoJSON` with coordinate validation, size bounds, polygon-ring handling and circle metadata. Atlas Lab uses these core APIs rather than maintaining a parallel implementation.
- **Playground**: memoized geometry arrays, renderer retry and preserved camera position when switching to Leaflet.
- **Verification**: unit tests, TypeScript builds, and Chromium smoke tests using a deterministic style that invokes the MapLibre worker.

## Engineering boundaries

- MapLibre v6's browser Worker **must** be configured by the consuming bundler. The Atlas Lab Vite entry point already does this; `@atlas/react/vector` documents its setup.
- OpenFreeMap is the default keyless third-party vector tile service. We do not own its uptime. The Leaflet raster fallback relies on public OSM tiles, which have their own usage policy.
- Not included: generalized clustering for tens of thousands of points, fully editable arbitrary MapLibre JSON styling, road routing, offline maps, self-hosted tile services, or a production geocoding SLA.
- DOM markers are optimized for ordinary map overlays; large datasets should use GeoJSON layers and clustering rather than one DOM node per geographic feature.
- Atlas does not provide authorization; applications are responsible for user permissions and location privacy.

## Validation checklist

- [x] Static TypeScript builds and package-level unit tests in GitHub CI.
- [ ] Chromium E2E smoke tests green on the latest commit.
- [ ] Atlas Lab tested on deployed Cloudflare desktop and mobile browsers.
- [ ] Verify map worker URL asset, tile/glyph networking, and style changes on real production build.
- [ ] Confirm GeoJSON import/export and location interactions in live browser.
- [ ] Review draft PR, then decide separately whether to merge it into main.

## How to run

```sh
npm install
npm run check
npx playwright install chromium
npm run test:e2e
npm run dev
```

Do not merge until both CI and manual deployment verification are satisfactory.
