# Atlas architecture

Atlas consists of browser-side packages and a test application.

- **Core**: provider-agnostic geographic models, spherical measurement utilities, input parsing, explicit geocoding interfaces and a Photon/Nominatim adapter.
- **React**: a Leaflet renderer, layer components, map controller ref and map event callbacks.
- **Atlas Lab**: functional playground; calls public OSM/Photon for manual testing, exposes errors and event logs, and does not silently claim road routing.

### Providers

Default raster tiles: https://tile.openstreetmap.org/{z}/{x}/{y}.png

Default geocoder: https://photon.komoot.io

Reverse fallback: https://nominatim.openstreetmap.org

These are shared services, **not** Atlas infrastructure. Rate and attribution requirements apply, and production customers should use appropriate hosted or self-managed services. Never ship provider secrets inside Vite client variables.

### Scope and roadmap

v0.1: Leaflet raster adapter, points/lines/polygons/circles, geocoder, location picking, geometry, playground diagnostics.

Later: MapLibre vector adapter, editable vector styles, routing provider interface, offline packaging and robust GeoJSON import/export. None of these is advertised as working until implemented and tested.

### Security

Atlas never owns user accounts, reports or teacher data. Geographic points are not access controls. Applications must authorize map queries and sanitize user content before storing or displaying it. Geolocation requires browser permission.
