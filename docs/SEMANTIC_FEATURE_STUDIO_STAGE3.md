# Stage 3 — semantic map features and Atlas Lab organisation

Stage 3 adds an authoring control for actual provider-backed vector layers:
building polygons (plus height scaling where an extrusion layer already
exists); residential/commercial/industrial **land-use zones**, parks,
woodlands, grasslands, gardens, agricultural land; water polygons, rivers,
streams and canals; healthcare, education, food, shopping, landmark and
transport POIs; country/state/district boundaries, railway/transit lines,
contours and hillshade where exposed.

**Provider data matters.** A building footprint does not establish whether
a building is residential, commercial or industrial; those labels here refer
only to land-use areas. Similarly, a generic water polygon layer may combine
lakes, reservoirs and coastline water. Atlas does not invent a distinction
that the tile source cannot supply. Unsupported feature categories are
marked in the UI.

Shared provider layers are styled with class-specific paint and opacity
expressions, rather than recolouring a whole layer indiscriminately.
Complex existing zoom opacity expressions retain their provider behaviour
when an independent zoom mask cannot be composed safely.

The Style Studio now has seven task-based navigation tabs: Themes, Roads,
Features, Typography, Zoom, Layers and Map setup. A searchable six-family
Features pane shows which controls can apply to the current provider.
Typography includes global and per-label Show, Hide and Preset buttons
for crisp outlines and soft halos. Both render through MapLibre's
`text-halo-width` and `text-halo-blur` properties.

No new tile source, raster layer or map instance is created for an ordinary
style edit. Presets and old road controls remain intact. The work stays on
`dev/semantic-features` until explicitly merged.
