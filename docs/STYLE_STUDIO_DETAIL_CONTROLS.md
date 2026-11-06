# Map detail controls — Atlas style authoring

Atlas Lab offers **Map Detail Controls** beneath the preset/palette editors.

- Density quick starts: **Full, Balanced, Quiet, Essential**.
- Five independently configurable road opacity controls:
  motorways/trunk, primary, secondary/tertiary, local/residential,
  and service/paths.
- Independently show/hide and fade buildings, water, parks, place labels,
  road labels, POIs, transit, administrative boundaries and terrain.
- The user can reset all map detail controls without resetting their colours.
- Details persist when switching presets. The resulting style overrides
  are included when exporting the Atlas v2 style JSON.
- All changes use the persistent MapLibre instance and the existing incremental
  style adapter; no network request is needed just to change detail levels.

## How road classes work

Provider-specific layers named for individual road classes receive independent
`line-opacity` values. For vector styles that draw several types in one shared
road layer, Atlas builds a MapLibre `match` expression based on feature
`class`, `highway` or `type` fields. Unknown classes retain the layer's
baseline opacity. The expression is applied only to known transportation
line layers, not road-name symbols.

Because vector tile providers vary, not every source supports every control.
A style with no roads or a different road-class field may require
provider-specific bindings and filters. On modified properties, existing
data-driven zoom-opacity expressions may be replaced; resetting restores
the underlying original expression. Road geometry remains sourced from
the original provider.

## Scope / portability

The pure authoring layer lives in `@atlas/style-core` and writes standard
version-2 Atlas style overrides. The concrete detail panel and state management
live in Atlas Lab. No changes are required in CivicWatch or Shikshak, whose
single chosen style can remain compiled once in their code.
