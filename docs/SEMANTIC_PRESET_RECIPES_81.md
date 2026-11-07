# Semantic styles for all 81 Atlas presets

All 81 built-in themes now derive a full Stage 3 design profile, with 23
feature categories: building footprints, residential/commercial/industrial
land use, parks, woodlands, gardens, grassland, agriculture, water bodies,
rivers and streams, POIs, boundaries, railway networks and terrain where
available. This supplements, rather than replaces, the Stage 1 road and
Stage 2 typography recipes.

Every preset has an explicit named feature tuning recipe (81 of 81), in addition to its family hierarchy. Each preset reuses its own nine semantic palette roles (land, water,
parks, roads, buildings, labels, boundaries, transit and POIs). Palette
reskins recalculate feature colours rather than retaining another theme's
swatches. The themes share family-level hierarchy and category-aware
detailing but remain distinct because of their curated palettes and,
where useful, additional named tuning.

- Minimal: restrained land use and POIs; subtle boundaries; halo-free type
- Editorial: architectural buildings and borders; crisp text outlines
- Nature: woodland, water and relief prioritised over built infrastructure
- Travel: waterways, transport stations and landmark POIs emphasised
- Retro: archival washes, softened POIs and dashed border engraving
- Futuristic: geometric transit emphasis, layered urban land use, glowing city text
- Expressive: colourful garden, landmark and city detail
- Utility: high-visibility administrative and transport hierarchies

Building outlines are explicit for editorial, travel, retro, expressive and
utility families, while minimal and nature themes keep their provider outlines.
The new semantic zoom profiles delay dense building footprints and local borders
until useful scales, and introduce transport/health POIs before shopping/food.
Theme-specific overrides can still bring forward category detail; provider
min/max zoom and missing source data are never bypassed.

Named themes refine the pattern: Hiking emphasises forest and terrain;
Navigation emphasises transport stations; Maritime emphasises waterways;
Transit Map emphasises rail; Survey emphasises boundary levels; Emergency
emphasises hospitals; Blueprint enhances building outlines. Further named
theme adjustments adapt season, region, mood, era and purpose. All 17 styles
previously relying solely on family defaults now have deliberate refinements,
including Pastel City, Graphite Mono, Terra, High Contrast, Mist, Porcelain,
Ash Blue, Chalkboard, Paper Slate, Alabaster, Burgundy Print, Night Editorial,
Seventies Orange, Obsidian, Bubblegum, Peach and Mint Pop.

Tokyo Neon's requested road-style revert and its previous text-halo
behaviour remain intact. The retro CRT, Eighties Grid and Arcade themes use
controlled city/locality glows, while archival print maps retain crisp outlines
and Film Noir stays unglowed. Tokyo Neon gains Stage 3 feature colours but **not**
the reverted Tokyo-only roadway changes.

## Manual controls

Stage 3 has sparse property-level manual overrides. Switching themes changes
only unedited properties. Custom palette reskins update everything except
explicitly edited values. A selected feature has its own restore-to-theme
control; Reset feature edits restores all Stage 3 controls to the current
theme. Reset everything also clears the overrides.

The source provider remains authoritative. Atlas never fabricates building
use classifications, lake/ocean separation, or missing features. Existing
vector tiles, the MapLibre instance and source layers remain unchanged.

Tests cover the entire 81-theme catalog, palette propagation, manual edits,
typing effects, and compilation using actual OpenFreeMap Positron, Dark,
Bright and Liberty layer fixtures.
