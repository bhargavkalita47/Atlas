# Atlas Style Studio: all 81 themes now use Stage 1 / 2 / 4 controls

The complete preset library now includes individual authored profiles for:
- Road colour, thickness, optional casing styling and dash pattern.
- City, locality, road and POI label colour, scale and tracking.
- Zoom-dependent road, label and geographic-feature visibility.

Eight editorial families establish baseline cartographic hierarchy, and
named preset refinements provide distinctive behaviours for navigation,
hiking, cycling, transit, accessibility, minimalist and expressive themes.
Individual road and label colours are generated from the theme's exact
semantic palette, not arbitrary fixed hex values, so custom palette
reskinning preserves the map hierarchy while updating its colours.

Styles are authored as pure source-layer paint/layout/zoom overrides,
without new tile sources or injected glyph files. Font stacks remain
provider-inherited; the design-kit typography panel allows safe selection
from provider-referenced stacks. Dark preset text halo removal remains
in effect.

Atlas Lab applies the current preset's advanced profile, then overlays
only explicitly changed controls. Untouched properties adopt the next
preset's defaults. The **Reset advanced design to preset** action clears
manual road/typography/zoom edits. The original 81-preset memory cache is
unchanged: selecting a preset does not call setStyle or replace tiles.

Built-in documents and normal palette reskins also include the new
advanced profile in their compiled Atlas v2 style document. Within Atlas
Lab, the preset cache explicitly returns raw colour documents, so
advanced styling and density are applied once rather than compounded.

Provider caveats remain: some tile styles combine classes, have no
casing layers, or use different source/label IDs. Zoom masking of shared
layers depends on supported per-feature class values and opacity
expressions. Preset definitions never claim missing geographic data.

This work remains solely on `dev/style-studio` and does not integrate with
CivicWatch or Shikshak.
