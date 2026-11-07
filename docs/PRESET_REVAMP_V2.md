# Atlas Preset Library v2 — road hierarchy, detail and crisp dark labels

All 81 presets now have curated cartographic density profiles as well as
colours. Eight family baselines and per-preset refinements set the relative
emphasis of motorways, primary/secondary streets, neighbourhood roads,
paths, buildings, boundaries, parks, POIs, labels, transit and terrain.

## Atlas Lab

Selecting a preset immediately applies its native road/detail design using
the existing MapLibre incremental paint/layout adapter. Map Detail Controls
displays its actual settings, and manual edits are kept as **sparse overrides**.
Switching presets keeps only the explicitly changed controls and inherits
everything else from the newly selected preset. **Reset to preset** discards
the manual overrides. Changing the 4–6 colour palette never erases details.

All presets use the same retained map instance and the prewarmed in-memory
preset catalog. The underlying tile source, camera and marker state remain
unchanged when switching presets.

## Dark labels

Dark preset recipes use crisp single-colour labels, overriding the provider's
text halo as follows:

- `text-halo-width: 0`
- `text-halo-blur: 0`
- `text-halo-color: rgba(0, 0, 0, 0)`

These properties are emitted for all dark symbol layers. Light recipes
continue to inherit their own provider's halo settings. Source fonts are
not changed. This applies to palette reskins and standard JSON export.

## Developer API

- `getAtlasPresetDetailSettings(id)` returns a fresh, complete detail profile.
- `createAtlasPresetDocument(id, layers)` now generates a fully styled v2
  authoring document including its curated detail controls by default.
- `createAtlasPresetDocument(id,layers,{includeDetails:false})` lets Atlas
  Lab prepare the base recipe without detail overrides; it merges the selected
  profile and user adjustments **once** against the loaded provider style.
- `mergeMapDetailOverrides` and `deriveMapDetailOverrides` preserve sparse
  manual customisations when switching themes.

The original MapLibre layer schema still determines which features exist.
Road class heuristics are not equivalent to a guaranteed provider mapping;
exact style provider/zoom rendering remains provider-dependent.

No changes were made to CivicWatch, Shikshak, or production `main`.
