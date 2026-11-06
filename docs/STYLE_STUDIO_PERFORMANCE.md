# Atlas Lab fast preset preview (development kit only)

All 81 preset recipes are now prepared in memory after the first vector base
style finishes loading. Selecting a preset or editing its 4–6 colour palette
**does not call MapLibre setStyle**, change the tile source, remount the canvas,
or move the camera. A cached recipe returns the exact current provider layer
bindings and the existing MapLibre incremental paint/layout adapter applies
only the changed properties.

## Startup vs repeated edits

- Once Atlas Lab receives the loaded base's layer inventory, it creates and
  retains independent documents for the whole preset catalog.
- The four OpenFreeMap style **JSON definitions** receive low-priority preload
  hints. The browser can cache them subject to provider response headers.
- A bounded 32-entry LRU remembers recently generated custom-palette documents.
- Each preset selection keeps the current vector base. To explicitly compare
  Positron / Liberty / Bright / Dark layout and sprites, change the separate
  **Keyless vector starting styles** selector; this deliberately reloads the
  chosen provider style and rebuilds the preset cache for its new layer IDs.
- Actual vector tiles, glyphs, sprites, textures and arbitrary view/zoom levels
  are *not* all preloaded or permanently cached. Browser and MapLibre HTTP/worker
  caches govern reusable resources. All-world/all-zoom caching is impractical.
- The current incremental compiler still rebuilds a style JSON view for each
  colour edit. This stage removes network style reloads from theme selection,
  not every possible CPU allocation or WebGL paint-program update.

## Scope

The cache and recipe switching logic live exclusively in
`apps/playground/src/studio` and `apps/playground/src/App.tsx`.
The public `@atlas/react` components remain unchanged, and applications such
as CivicWatch and Shikshak retain their own fixed configured map style.

## Verification

The Studio cache has unit tests for full catalog preparation, document
isolation, palette LRU reuse and provider-specific invalidation. A browser
regression verifies that switching presets whose *original* recipes mention
different base providers causes no new style requests or canvas remount, even
after a custom palette edit, while preserving the markers.
