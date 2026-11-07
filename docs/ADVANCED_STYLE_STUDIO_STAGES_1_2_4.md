# Atlas Lab stages 1, 2 and 4 — Advanced cartographic authoring

Implementation is deliberately restricted to `dev/style-studio`. These
controls run on the current loaded MapLibre vector map. They patch the same
version-2 style document used by the existing 81-preset design library; normal
edits do not remount the map or request a new base style.

## Stage 1: Advanced road styling

Five OSM road tiers have separate editable road colours, line widths,
visibility and dash patterns: motorway/trunk, primary, secondary/tertiary,
local/residential, and paths/service roads. Existing independent opacity
sliders remain under Map Detail Controls.

Casing colour/width controls affect **existing road casing layers** only;
when the selected provider has no casing layer, the UI disables these
controls rather than inventing a new line layer. Dedicated road layers use
direct paint/layout updates; shared transportation layers use the source's
per-feature `class`, `highway` or `type` attributes. Dashed line
expressions require data-driven `line-dasharray` support (MapLibre GL JS
6.x). Unknown road classes inherit their original paint.

## Stage 2: Typography Studio

Four editable label families: cities/major places, localities and
neighbourhoods, road/street names, and points of interest.

- Text colour with an explicit custom/inherit toggle.
- Text size factor from 0.5× to 2.5×, preserving standard zoom-size
  interpolation where possible.
- Text letter spacing from -0.1 to 0.4 em.
- Visibility: preset / show / hide.
- Font stack selection limited to **font families already referenced by the
  currently loaded provider style**, so weight/style depends on supplied
  glyph assets. Arbitrary web/CSS fonts are not injected.
- Dark presets continue to suppress text halos and glow.

## Stage 4: Zoom-dependent detail

Every road tier and label family plus nine map detail categories has a
configurable minimum and maximum zoom level. Empty (“Auto”) values inherit
the source map's existing visibility and zoom limits. Numeric
minzoom/maxzoom overrides apply directly to distinct source layers.

On shared road classes, Atlas attempts per-feature zoom masks using a
zoom-step expression, retaining existing class-level numeric/data
opacities when feasible. Complex provider-defined zoom opacity
expressions may not support exact per-class masks without splitting
layers; Atlas records a warning rather than silently replacing these
expressions.

Quick preview zoom buttons (z5, z9, z13, z16, z19) change the live map
camera without changing its style source, so the designer can inspect
readability and information hierarchy at several scales.

## Current limitations

Different providers vary in layer IDs, embedded feature categories, casing
coverage and font glyph availability. Controls cannot reveal features
absent from the vector tile source. Advanced settings are kept in Atlas Lab
state and included in `atlas-style-v2.json` as ordinary layer overrides;
production import/integration tooling is intentionally deferred.

These additions do **not** modify the fixed map styles in CivicWatch
or Shikshak and do not merge the experimental branch into `main`.
