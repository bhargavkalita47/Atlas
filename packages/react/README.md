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
