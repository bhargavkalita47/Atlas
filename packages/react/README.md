# @atlas/react

React adapters for Leaflet raster maps and MapLibre vector maps.

Import `leaflet/dist/leaflet.css` in your host application. Import `AtlasMap`, `MarkerLayer`, `ShapeLayer` and `AtlasMapHandle` from `@atlas/react`.

Use `AtlasVectorMap` with `DEFAULT_VECTOR_THEME`, `KEYLESS_VECTOR_STYLES` and `VectorTheme` for a basic editable vector layer palette. Import `maplibre-gl/dist/maplibre-gl.css` in the host application. The vector renderer uses keyless OSM-derived tiles from OpenFreeMap by default. The Leaflet raster adapter still cannot edit imagery baked into raster tiles.

## MapLibre v6 worker setup (required in Vite consumers)

MapLibre 6 uses a separately bundled browser Web Worker. The consuming Vite application must configure its URL **before** rendering `AtlasVectorMap`:

```ts
import { setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(maplibreWorkerUrl);
```

This worker is part of MapLibre, not Cloudflare Workers and not an API-key service. The `?worker&url` import is important: Vite bundles the worker and its module dependencies and serves the asset from the application's own origin. For other bundlers, consult MapLibre's worker installation instructions; Atlas intentionally keeps the SDK bundler-independent.
