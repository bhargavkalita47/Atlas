# @atlas/react

React adapters for Leaflet raster maps and MapLibre vector maps.

Import `leaflet/dist/leaflet.css` in your host application. Import `AtlasMap`, `MarkerLayer`, `ShapeLayer` and `AtlasMapHandle` from `@atlas/react`.

Use `AtlasVectorMap` with `DEFAULT_VECTOR_THEME`, `KEYLESS_VECTOR_STYLES` and `VectorTheme` for a basic editable vector layer palette. Import `maplibre-gl/dist/maplibre-gl.css` in the host application. The vector renderer uses keyless OSM-derived tiles from OpenFreeMap by default. The Leaflet raster adapter still cannot edit imagery baked into raster tiles.
