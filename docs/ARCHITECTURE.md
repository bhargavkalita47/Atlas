# Atlas architecture

Atlas consists of browser-side packages and a test application.

- **Core**: provider-agnostic geographic models, spherical measurement utilities, input parsing, explicit geocoding interfaces and a Photon/Nominatim adapter.
- **React**: Leaflet raster and MapLibre vector adapters with a shared map controller API, markers, shapes, and map event callbacks.
- **Atlas Lab**: functional playground; calls public OSM/Photon for manual testing, exposes errors and event logs, and does not silently claim road routing.

### Providers

Default vector tiles: https://tiles.openfreemap.org/styles/liberty, rendered by MapLibre. This public instance requires **no account or API key** but is still third-party hosting.

Default raster fallback: https://tile.openstreetmap.org/{z}/{x}/{y}.png

Default geocoder: https://photon.komoot.io

Reverse fallback: https://nominatim.openstreetmap.org

These are shared services, **not** Atlas infrastructure. Rate and attribution requirements apply, and production customers should use appropriate hosted or self-managed services. Never ship provider secrets inside Vite client variables.

### Scope and roadmap

v0.2: Leaflet raster adapter, MapLibre vector adapter, editable basic feature colors, points/lines/polygons/circles, geocoder, location picking, geometry, playground diagnostics.

Later: full MapLibre layer/typography editor, routing provider interface, offline packaging, and robust GeoJSON import/export. Current color editing is a basic categorical mapping, not a full arbitrary MapLibre style editor.

### Security

Atlas never owns user accounts, reports or teacher data. Geographic points are not access controls. Applications must authorize map queries and sanitize user content before storing or displaying it. Geolocation requires browser permission.
