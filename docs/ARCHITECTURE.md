# Atlas architecture

Atlas consists of browser-side packages and a test application.

- **Core**: provider-agnostic geographic models, spherical measurement utilities, input parsing, explicit geocoding interfaces and a Photon/Nominatim adapter.
- **React**: `@atlas/react` is the lightweight Leaflet raster adapter; `@atlas/react/vector` is the optional MapLibre (WebGL2) adapter. Both expose a shared map controller API, markers, shapes and map event callbacks. MapLibre is an optional peer dependency for raster-only consumers.
- **Atlas Lab**: functional playground; calls public OSM/Photon for manual testing, exposes errors and event logs, and does not silently claim road routing.

### Providers

Default vector tiles: https://tiles.openfreemap.org/styles/liberty, rendered by MapLibre. This public instance requires **no account or API key** but is still third-party hosting.

Default raster fallback: https://tile.openstreetmap.org/{z}/{x}/{y}.png

Default geocoder: https://photon.komoot.io

Reverse fallback: https://nominatim.openstreetmap.org

These are shared services, **not** Atlas infrastructure. Rate and attribution requirements apply, and production customers should use appropriate hosted or self-managed services. Never ship provider secrets inside Vite client variables.

### Scope and roadmap

v0.2: Leaflet raster adapter, MapLibre vector adapter, editable basic feature colors, points/lines/polygons/circles, geocoder, location picking, geometry, playground diagnostics.

Later: full MapLibre layer/typography editor, routing provider interface, offline packaging, and advanced GeoJSON editing. Bounded, validated GeoJSON import/export is already implemented in @atlas/core. Current color editing is a basic categorical mapping, not a full arbitrary MapLibre style editor.

### Tests and compatibility

The library has unit tests for coordinate parsing, measurement, geocoding, GeoJSON roundtrips and vector theme compilation. The playground has Chromium smoke tests for browser worker initialization, vector style switching, pin rendering, and mobile raster fallback. GitHub CI runs those tests in a draft pull request before merging.

Application bundlers must configure MapLibre v6's dedicated worker URL before mounting the vector adapter (see `packages/react/README.md`). Leaflet requires no WebGL2 and is the fallback.

### Security

Atlas never owns user accounts, reports or teacher data. Geographic points are not access controls. Applications must authorize map queries and sanitize user content before storing or displaying it. Geolocation requires browser permission.
