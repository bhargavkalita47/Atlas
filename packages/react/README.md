# Atlas React adapters

Two entry points keep Leaflet-only applications from importing the GPU-based MapLibre implementation.

## Lightweight Leaflet adapter

```tsx
import {AtlasMap,MarkerLayer,ShapeLayer} from "@atlas/react";
import "leaflet/dist/leaflet.css";
```

Leaflet uses raster tiles. Raster tiles cannot be individually restyled into custom roads or buildings.

## Editable MapLibre vector adapter

Install `maplibre-gl` alongside `@atlas/react` when using the optional vector adapter.

```tsx
import {AtlasVectorMap,DEFAULT_VECTOR_THEME} from "@atlas/react/vector";
import {setWorkerUrl} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(workerUrl);
```

The worker URL above is for Vite. Other bundlers must follow the MapLibre 6 worker setup guide.

The vector API accepts the same `AtlasMapHandle` as the raster adapter, with `center`, `zoom`, `markers`, `shapes`, `onClick` and `onViewChange`. Only the vector adapter requires WebGL2. Tile styles are independent of Atlas; OpenFreeMap is a keyless default, not owned infrastructure.

### Reuse

Both adapters expose imperative controls through `AtlasMapHandle`. Geocoding, coordinates, geometry and application data belong in `@atlas/core`; Atlas does not manage application accounts or private locations.

### Camera behavior

The `center` and `zoom` props specify the **initial map view**. Use `AtlasMapHandle.setView`, `flyTo`, or `fitTo` for subsequent camera changes. Atlas does not silently pan every time a parent component rerenders.

Marker and shape props accept read-only arrays. Replace or create data with stable IDs; Atlas reconciles individual marker elements and preserves the rest.

The `@atlas/react` package is currently developed as a monorepo workspace and **has not been published to npm**. Before public publishing, choose and verify an npm scope you control.

### Startup and device performance

The vector adapter is optional. In a Vite application, load the MapLibre entry point with `React.lazy` (Atlas Lab uses `apps/playground/src/VectorMapLoader.tsx`) so Leaflet-only pages never download WebGL code. The Vite worker URL must be registered **inside** the loaded module before the renderer is created.

`AtlasVectorMap` accepts `renderQuality="balanced" | "high"`. Balanced (the default) caps the canvas device-pixel ratio to **1.5** on very dense screens; High preserves the device's full resolution. Neither changes the geographic data or tile style. The renderer also disables unused world-copy rendering and unnecessary tile cross-fade.

The optional `onPerformance({phase,elapsedMs,styleUrl})` callback reports style-ready and first-idle timings. First idle includes the tile and glyph load for the current view. Use it in production preview comparisons rather than relying on fast synthetic unit tests. Atlas Lab exposes these values in Diagnostics.

`applyVectorTheme` caches style-layer classifications and only writes paint properties whose requested colors changed. Cache is invalidated when the MapLibre style reloads.

A large map dataset should use clustered GeoJSON/vector layers rather than thousands of individual DOM markers. The current React adapter optimizes ordinary marker lists but is not a point-cloud renderer.

### Adaptive resolution scaling

The vector adapter now supports `adaptiveResolution={true}` (default). During sustained camera motion (pan, pinch, scroll zoom or programmatic camera animations), Atlas temporarily caps canvas density at **1.0×**. After movement finishes and a short debounce, it restores the selected `renderQuality` baseline (Balanced = up to 1.5×, High = device DPR).

There is a 70 ms movement threshold to avoid expensive canvas reallocations for tiny transitions and a 180 ms restoration delay to avoid flicker between closely spaced gestures. MapLibre's `setPixelRatio` calls `resize`, which also emits camera events, so Atlas guards against re-entrant event loops. It uses no per-frame React state or `requestAnimationFrame` loop.

Set `adaptiveResolution={false}` to preserve constant pixel density. Optional `onResolutionChange={({phase,pixelRatio})=>...}` exposes the actual chosen canvas ratio for debugging. This changes only the GPU framebuffer resolution; basemap detail, label sources, zoom, and exported data are unchanged.
