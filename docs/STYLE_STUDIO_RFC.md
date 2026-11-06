# RFC 001 — Atlas Style Studio: The Cartographic Design Engine

**Status:** Proposed architecture and implementation contract (not implemented)  
**Branch:** `dev/style-studio`  
**Base:** `main` at `37f55c749708d62cdf85e98aebc348f2bcd4abee`  
**Date:** 2026-11-06  
**Positioning:** MapLibre-native, provider-independent, no mandatory account, reproducible, extensible cartographic authoring.  
**Rule:** Preserve Stage 1 map lifecycle, dynamic-resolution safety, touch safety, lazy loaders, cache policies, worker configuration, and raster fallback.

## 0. The distinction Atlas must earn

Atlas must **not** claim to be the first map style editor or that it already exceeds Mapbox Studio, MapTiler Map Designer, Maputnik, or QGIS. Those products are sophisticated and already offer layer, data-driven, font, icon, and rule controls. Atlas should differentiate by offering the following *together*, with portable source formats:

1. **Two simultaneous editing depths:** readable semantic controls for non-programmers and lossless access to the underlying MapLibre style specification for experts.
2. **Cartographic design systems:** reusable, type-checked tokens, aliases, semantic feature groups, themes, states, responsive zoom scales, and inheritance, rather than a collection of unrelated hex values.
3. **Inspectable provenance:** click a visible feature, inspect the actual source, source-layer, feature attributes, applicable style layers, expression path, active value, and why that visual result occurred.
4. **Visual conditional-rule authoring:** zoom, feature attribute, feature state, UI state, data bucket, locale, appearance, and application-provided variable rules, with expression AST output and readable debugging.
5. **Portability without lock-in:** import and export standards-compliant MapLibre style JSON, retain unknown standard properties, generate deterministic edits, support multiple compatible tile schemas through explicit adapters, and never mandate Atlas-hosted tiles.
6. **Software engineering for maps:** undo/redo, diffs, branches/variants, schema migrations, reproducible asset manifests, accessibility audits, test fixtures, screenshot regression, and SDK APIs.
7. **Performance as an authoring constraint:** live previews that do not destroy the renderer or regress touch gestures; per-property change impact warnings; source, tile, glyph, sprite, layout and GPU budgets.

These are design goals; specific capabilities must pass the acceptance gates below before being represented as shipped.

## 1. Principles and non-negotiable invariants

- **An editable surface, not a fake simulation:** the Studio edits actual style objects and renderer state. Avoid postprocessed raster filters as a substitute for vector styling.
- **Source awareness:** a road is only separately editable if the source provides distinguishing geometry/attributes. Missing data cannot be invented by a visual editor.
- **No silent destructive transformations:** round-trip imported MapLibre JSON with unsupported or unknown properties preserved unless the user explicitly removes them; preserve arbitrary valid expressions.
- **Graceful capability handling:** controls indicate supported, blocked by style/source, requires asset, experimental plugin, and unsupported by current renderer/version.
- **Deterministic compiler:** stable IDs, stable layer order, stable export, no hidden user state in output; compile with explicit renderer/version target and asset dependencies.
- **User data stays independent:** do not recolour application-owned marker/shape overlays when changing basemap categories. Business-domain permissions remain outside Atlas.
- **Mutations are transactional:** validate; prepare patches; apply in dependency order; commit to history only after successful application; support rollback/reload recovery.
- **Time-to-map and gestures take priority:** style edits cannot trigger repeated map construction, tile floods, WebGL framebuffer resizing during touch, or global restyling on every pointer event.
- **Open standards first:** the compiled source of truth is a standards-compliant MapLibre style document whenever the requested feature is expressible in the specification.
- **No forced backend:** editing, saving, export and tests should work locally; sharing, collaboration and asset hosting can be optional adapters later.

## 2. Rendering capability boundaries

### 2.1 Native MapLibre style properties (primary path)

Expose all properties permitted by the *targeted* MapLibre Style Specification, not a hand-written permanent list. Generate typed controls, constraints, defaults, expression support, dependency warnings, and help from a pinned version of the style specification. Support:

- Sources: vector tiles, GeoJSON, raster imagery, raster-dem, image/video/canvas where compatible, TileJSON-backed endpoints, and custom registered protocols with adapter contracts.
- Layer types: background, fill, line, symbol, circle, heatmap, raster, hillshade, color-relief, fill-extrusion, plus validated extension layer types permitted by the target renderer.
- Layer properties: paint/layout/filter, minzoom/maxzoom, source-layer, visibility, order, transition configuration, metadata, line offsets/dashes/joins/caps, fill patterns, text halos/letter spacing/anchors, symbol/icon placement and collision behavior, shadows/hillshade/relief, extrusions, data expressions, etc., subject to individual property support.
- Root: terrain and DEM, projection, light(s), sky where available, sprite, glyphs, view defaults, transition defaults, and other version-supported style properties.
- Styling expressions: literal, get/has/id, case/match, step/interpolate, math, conversion, string, zoom, feature-state, global-state where supported, and advanced raw expression editing with validation.
- Feature-query tools: queryRenderedFeatures, querySourceFeatures, getStyle, inspect feature-state and runtime properties, honoring source and rendering caveats.
- Asset loading: sprites/icons, glyphs/fonts and images; CORS, licensing, Unicode coverage, size, and offline availability checks.

**Important:** a MapLibre API being present does not imply all layer properties allow data expressions or feature-state; generate property-specific affordances from the actual spec. Native/browser compatibility may differ.

### 2.2 Atlas higher-level authoring features (compiled to supported MapLibre)

- Semantic feature taxonomy: land, water, protected areas, vegetation, transport (motorway/trunk/primary/secondary/residential/service/path/rail/bridge/tunnel), buildings, boundaries, POIs, transit, labels, terrain.
- Group editing with individual exceptions, component styles, design token inheritance, and readable rule authoring.
- Colour palettes (light/dark/print/high contrast), scales, contrast warnings, palette generation, category ramps and data-driven gradients.
- Zoom keyframe editor, map-scale previews, interpolation curves, and discrete breakpoint visibility.
- Reusable symbol/icon design system, data-driven symbols, sprites and variant-aware typography roles.
- Source schema inspection and provider mapping, with explicit unsupported/lossy conversions.
- Multilingual label preferences when attributes and glyphs are present; feature fallbacks.
- Map camera/states and authoring contexts: desktop/mobile viewport, zoom, pitch, bearing, localization, screen density, theme variant; compile standard style data or apply runtime context updates as required.
- Data visualisation: categorical, graduated, class breaks, bivariate (where expressible), heatmaps, clusters, choropleths, quantitative legend generation. Compute statistics in a separate bounded data processing step; never assume vector tile contains global distribution.
- Export MapLibre JSON plus optional Atlas authoring manifest, icons/fonts/assets, license manifest, and typed SDK theme adapter.

### 2.3 Advanced/experimental extensions (NOT native claims)

- Custom WebGL layers/shader pipeline, stippling/hatching/paper ink, nonstandard filters, postprocessing effects, hand-drawn strokes, procedural patterns, spatial masks, arbitrary blending, 3D meshes, and cinematic lighting can require custom renderers/plugins, extra asset production, or preprocessed data.
- Offline tile packaging, self-hosted vector pipelines, dataset editing, routing, real-time collaborative sync and published style hosting require substantial additional systems and/or licenses.
- Atlas must show extension dependency, browser/platform support, security review and cost before allowing publication.
- Satellite raster imagery can be tinted/overlaid but does not offer vector-style selection of buildings or roads unless separate vector layers are available.
- Fonts do not become globally available by choosing a CSS family; MapLibre glyph/source mechanics, fonts, RTL support, licenses, and fallbacks must be satisfied.

## 3. Product capability breadth — feature families

### 3.1 Geometry, infrastructure and environment
Land cover subtypes, surface types, parcel/plot boundaries if available, waterways by class/width, shorelines, wetlands, riverbanks, bathymetry if sourced, green spaces, elevation shading/contours if sourced, roads by classification and structure, rail and transit, bridges and tunnels, buildings and building typology, city/administrative boundaries, coastline, address/house numbers, urban features, airport/runway and ports, points of interest, landmark icons.

### 3.2 Property-level control
For each relevant layer: visibility, min/max zoom, opacity, colour/stops/gradients as supported, width/radius/offset, outline, stroke join/cap/dash/blur, fill pattern, extrusion height/base, ordering, filters, source/source-layer binding, label text and anchors, icon overlap/placement, transition duration/delay, per-feature class logic, root scene controls, and descriptive metadata. Don't invent unsupported fields or overwrite foreign style properties.

### 3.3 Cartographic typography
Font roles, fallback stacks and glyph source diagnostics, point-size curves by zoom, density, prioritization, line spacing/letter spacing where specified, rotation, alignment, transforms, halo, casing, optional abbreviation rules, label collision/allow-overlap, multilingual fallback, directionality, maximum widths and city/road/water/POI hierarchy. Provide visual font previews with coverage warnings.

### 3.4 Symbols and imagery
Icons, pins, badges, data-driven markers and sprites with pixel ratio handling; sprite atlas builder, import PNG/SVG subject to sanitation, naming/collision rules, provenance/license manifest; raster overlays, imagery opacity/hue/saturation/contrast controls supported by renderer, and optional DEM relief. Uploaded asset hosting is user-provided or an optional adapter.

### 3.5 Rules and dynamic styles
No-code expression builder + expert AST editor; boolean groups, matches, attribute operators, string membership, numerical ranges, zoom ramps, feature-state hover/selected/focused, application context, light/dark and accessible variants. Show rule precedence, matching feature counts where computable, and a “why does it look like this?” trace.

### 3.6 Thematic cartography and data insight
Automatic unique-value identification, equal interval, quantiles, natural breaks (bounded data with documented statistical meaning), continuous diverging/sequential ramps, scale bars, legend binding, layer-specific symbolization, feature inspection, multi-series/temporal data only with an appropriate source/update strategy; no claims of authoritative values without data.

### 3.7 3D, lighting and environment
Pitch/bearing/projection where supported, DEM/hillshade/terrain exaggeration, elevation colour maps, 3D building extrusions and height expressions, light source controls, atmosphere/sky if target supports, camera preview presets and 2D/3D parity testing; plugin-only status for physics-based materials, volumetric effects or external models outside the standard specification.

### 3.8 Interactions and accessible UX
Hover/selected/focus state themes with hit-testing, animation limits, reduced motion, high-contrast palettes, colour-vision simulation (advisory), minimum label readability warnings, focus targets for the editor, language/script previews, layer/search accessibility audit, keyboard navigation and desktop/mobile layouts.

### 3.9 Map UI and app overlay skinning
Optional separately scoped design tokens for controls, markers, tooltips, scale/attribution controls, context menus, selected geometry, clustering and application-specific overlays. Keep SDK chrome separate from basemap style. Publish APIs without coupling to CivicWatch/Shikshak logic.

### 3.10 Collaboration and delivery (future)
Style fork/diff/rebase, comment annotations, named release variants, snapshots, printable/exportable map compositions, authenticated optional sharing, hosted style publishing, asset deployment manifests, SDK consumption and automatic validation. Local offline editing remains usable without a service.

## 4. Style document architecture

Avoid using the current six-colour VectorTheme as the full design document. Keep it as a compatibility adapter for old clients. Introduce independently versioned `@atlas/style-core` (no React, no renderer and no network required) and optional `@atlas/style-react` or adapters where justified.

### 4.1 Canonical authoring model

- `documentVersion`: Atlas document schema version, independent of MapLibre style spec version.
- `target`: renderer family/version/capability profile (e.g. MapLibre GL JS 6.x) and relevant platform variants.
- `base`: canonical style JSON or explicit immutable source/style URL + hash snapshot; never blindly rely on mutable remote content for deterministic exports.
- `sources`: source descriptions, schema/fingerprint, required attribution, cross-origin/asset restrictions and optional adapter metadata.
- `semanticBindings`: semantic category -> exact compatible source/layer IDs and feature predicates; with confidence and provenance.
- `tokens`: palette, stroke, typography, spacing, transparency, animation and topographic scales; variables may reference other tokens with cycle detection.
- `components`: semantic groups with selectors, scoped defaults, overrides and ordering intent.
- `rules`: explicitly ordered conditions whose right-hand side is spec-typed values or expression AST.
- `layers`: exact layer-property overrides, authoring annotations, safe identities and optional created layers.
- `variants`: named overrides inheriting from a parent with explicit conflict handling.
- `assets`: glyphs, sprites, symbols and texture manifests including hashes/licenses.
- `history`: editor-local reversible operations; not embedded by default into the published style.
- `extensions`: namespace/version/schema/capability-checked plugin configuration; unknown entries preserved.
- `export`: reproducible render-ready MapLibre style, asset references and optional Atlas metadata.

The output MapLibre JSON is derived. Never expect third-party consumers to understand Atlas-only metadata to display a normal map.

### 4.2 Property resolution

At compile time: base style property -> bound semantic group override -> rule match (ordered, with deterministic precedence) -> explicit layer override -> active named variant -> compatible temporary interaction state. Prefer actual MapLibre expression composition over running a per-feature JavaScript rendering loop.

Maintain *provenance of each resolved property*: source/override/rule/variant, type, expected value, capability and last authoring action. Warn about unreachable rules, conflicting selectors, redundant overrides and missing dependencies.

### 4.3 Round-trip, import and migration

- Raw MapLibre import must preserve all standard and unknown compatible fields, filters, expressions, IDs and ordering.
- Atlas document import runs schema validation and versioned migrations; unsupported extensions are retained but not executed.
- Legacy v1 export (`{version:1,renderer:"maplibre",baseStyle,colors}`) imports into a semantic group palette document using the existing keys `land/water/parks/roads/buildings/labels`.
- Export full MapLibre JSON as distinct format; export Atlas authoring document as another, never mislabel one as the other.
- Use stable, content-addressed asset names, exhaustive import diagnostics and versionable JSON schema.
- Preserve source order and layer grouping when no edits are applied. Rebase of a newer upstream base style requires conflict reports and user review, not silent overwrites.

### 4.4 Provider adapters and classification

The current `categorize(id, source-layer, type)` is a heuristic. Retain it as **suggested binding only**, not authority. Build source adapters for OpenFreeMap style schemas first, with explicit layer mappings; add OpenMapTiles/other compatible sources later. Display per-binding confidence, rule coverage and feature examples. Unmapped layers remain editable under Raw Layers, not thrown away.

Provider substitution is *not* always equivalent because feature classes and metadata differ. Provide a matrix: exact mapping / approximate mapping / missing attribute / unsupported source / external asset required.

## 5. Editor interaction design

Three levels: **Quick**, **Layers**, **Expert**. All operate on one document, not three competing states.

1. **Quick/Design system:** editable style tokens, visual presets, semantic feature components, palette/font presets, preview scene.
2. **Layers:** searchable scene tree with feature groups and exact renderer layers; pin, group, hide, isolate, opacity/width/colour, zoom curves, drag ordering with validity warning, snapshots.
3. **Expert:** schema-generated property inspector, expression tree visualizer/editor, source inspector, JSON source view and structured diff; preserve arbitrary valid expressions.
4. **Direct map inspection:** clicking geometry yields rendered features in draw order; choose feature; trace style rule -> layer -> source-layer -> feature properties -> resolved paint/layout property. Highlight exact geometry where supported.
5. **Viewports:** multi-scale side-by-side (world/city/street), dark/light, low/high DPI, languages, dataless areas, motion/reduced-motion, different device classes; camera synchronization optional.
6. **Timeline:** undo/redo, named checkpoints, compare current to base/preset, show granular property diff, optional animation previews and variant transitions.
7. **Safety:** source property warnings, errors with recover/revert, preserve camera/markers, unsaved edits indication and export-check report.

## 6. Runtime adapter and mutation strategy

Existing `@atlas/react/vector` uses `AtlasVectorMap`, `applyVectorTheme`, an in-map WeakMap classification cache, `style.load` reinstallation, lazy renderer loading, adaptive resolution and touch guards. Upgrade incrementally.

- Add a pure compiler that computes an ordered patch plan against a snapshot of the actual base style; classify patches as cheap paint, layout/reflow, layer graph, source change, asset change, root style change, or renderer-restart-required.
- For simple style paint: use `setPaintProperty` on changed property/layer only and deduplicate user input per animation frame where safe; never call `setStyle` for one colour change.
- For layout/filter: apply `setLayoutProperty`/`setFilter` with warned style/reflow cost; throttle sliders instead of rendering large cascades.
- For layer graph: coordinate `addLayer`/`removeLayer`/`moveLayer`, source and sprite availability, preserve dependent layer identity and app-owned overlays.
- For new source or major root changes: stage a validated transaction; perform minimum necessary style update, then reattach overlays after `style.load`, restore actual camera and current authoring document.
- Keep the existing vector map instance alive whenever possible; do not reset drag, center, zoom, selected pin or user shapes.
- Do not run map restyle/update loops for every map mousemove, tile-loaded event, gesture frame or WebGL repaint.
- Preflight cache and remote asset policy before sampling/prefetching; no speculative bulk tile requests; preserve public OSM/OpenFreeMap terms.
- Maintain bounded caches with explicit invalidation keyed to source/style revision; invalidate classification on style reload; avoid memory leaks in history/assets/preview clones.
- Preserve fallback raster behavior, but communicate which controls are vector-only.

## 7. The Minimal preset (first deliverable)

Name: **Minimal Light**. Base source: keyless OpenFreeMap Positron until source-specific bindings are verified.

Design tokens (starting values, to validate against the actual source and rendering):
- land `#F7F7F5`
- water `#DCE9EB`
- parks `#E5EDE3`
- buildings `#E9E9E6`
- primary roads `#FFFFFF`
- road outlines `#D4D6D3`
- labels `#535B59`

Behavior: subdued land, visible natural features, coherent road hierarchy, sparse POIs, restrained labels; preserve navigation context at neighbourhood zooms. No removal of all street labels as a fake minimal preset. Keep compatible OpenFreeMap attribution. Minimal Dark, Print and High Contrast are subsequent variants of the same design system, not hardcoded copies.

**First user journey:** open Style Studio -> choose Minimal Light -> inspect road group -> expand `primary` -> adjust paint and width -> see map update without camera loss -> set zoom-dependent size -> undo -> export the Atlas document and compiled standard MapLibre style -> import and reproduce on same fixture.

## 8. Milestone roadmap with acceptance gates

These stages are dependencies, not release promises or fixed schedules. More than one can proceed independently after the foundations are proven.

**0. Ground truth & fixtures**
- Freeze current `main` as regression base, list existing exact theme behavior and all public styles.
- Capture representative MapLibre JSON and property/source manifests for OpenFreeMap Positron/Liberty/Bright/Dark in permitted tests (no bulk tiles).
- Establish screenshot fixtures at world/city/street zoom, low-end mobile interaction tests, cold/warm startup budgets and capability table.
- Gate: reproducible baseline, Stage 1 tests green.

**1. Style core & Minimal**
- Create `@atlas/style-core`, typed document schema and validation, deterministic compiler, legacy 6-colour compatibility, Minimal Light preset, exact layer inventory/capability classification, known provider adapter.
- Gate: snapshot -> compile -> MapLibre JSON valid; unknown fields survive; minimal renders as intended on fixtures.

**2. Fine-grained editing**
- Add source/layer tree, groups, visibility, paint/layout property controls, filters, line geometry, opacity, exact overrides, reset, actual renderer patch update.
- Gate: individual layer edits do not alter unrelated layers, camera or user overlays; meaningful performance logging.

**3. Expression and conditional rule engine**
- Build AST visual editor, zoom ramps, categorical/numeric filters, feature state and app-state declarations, expression provenance/validation, experts’ raw JSON mode.
- Gate: complex visual rule roundtrips to native expressions and survives load/unload, undo and provider warnings.

**4. Typography and symbols**
- Font/glyph inspector, Unicode coverage, text layout controls, sprite assets, icon design/build pipeline, dependency manifest and attribution checks.
- Gate: valid symbols appear across tested scripts and DPIs without missing glyphs or broken URLs.

**5. Source intelligence and provider portability**
- Detailed source schema introspection, exact mapping adapters, GeoJSON/vector source support, data change diagnostics, style diff/rebase tooling.
- Gate: meaningful migration diagnostics and zero silent dropped rules.

**6. Terrain, 3D and effects**
- Native DEM, hillshade, color-relief, fill-extrusion, light/projection controls; define plugin experiments for nonnative effects.
- Gate: capability-specific previews and GPU/power budgets, not unsupported marketing claims.

**7. Data-driven thematic studio**
- Thematic scales, classification algorithms, bivariate styles, choropleth/heatmap/cluster controls and generated legends.
- Gate: validated against reproducible datasets and documented missing-data behavior.

**8. Design system, variants and collaboration-ready history**
- Linked tokens, variants, inheritance, semantic roles, compare/diff, release snapshots, accessibility assistant, local persistence with migrations.
- Gate: deterministic variant compile and reversible operations under source/style churn.

**9. Integration, export and distribution**
- Export compiled MapLibre JSON, Atlas source document, asset bundle/license manifest, typed React APIs, framework-neutral adapter plan, optional hosted publishing.
- Gate: import/export roundtrip on clean project, no compulsory Atlas backend/API key.

**10. Advanced authoring extensions**
- Sandboxed/permissioned plugin SDK, graphics/shaders, textures, custom tile/data pipelines and optional 3D techniques. Maintain renderer/version support matrix.
- Gate: plugins fail closed and cannot break baseline drag/touch, accessibility, resource or security guarantees.

**11. Release and documentation**
- Cartography tutorials, full property coverage table, examples, API documentation, public compatibility matrix and verified benchmarks.
- Gate: publish only features tested on real desktop/mobile builds and representative third-party styles.

## 9. Concrete workspace implementation plan

Existing locations:
- `packages/react/src/vectorConfig.ts`: legacy `VectorTheme` six fields; do not break existing consumers.
- `packages/react/src/VectorMap.tsx`: MapLibre component, classifier, theme cache, style lifecycle and performance/touch-sensitive integration.
- `packages/react/src/vector-theme.test.ts`: compatibility tests must remain.
- `apps/playground/src/App.tsx`: has Style Studio tab, Positron default and basic colour pickers/JSON export.
- `apps/playground/src/VectorMapLoader.tsx`: worker registration and lazy-loading boundary; preserve.
- `docs/PERFORMANCE.md`/`docs/STABILIZATION.md`: baseline/stability contracts.

Proposed new modules:
- `packages/style-core/src/{schema,presets,compiler,expression,capabilities,providers,roundtrip,history,diagnostics}.ts`
- `packages/react/src/styleRuntime.ts` as MapLibre patch adapter and overlay-safe layer mutation orchestrator.
- `apps/playground/src/studio/{StudioShell,LayerTree,Inspector,MapPicker,RuleBuilder,TokenEditor,ViewportMatrix,HistoryPanel,AssetManager}.tsx` with components loaded only in Studio mode.
- `tests/fixtures/styles`, `tests/fixtures/data` or equivalent for deterministic, license-compliant fixtures.
- Document schema / compiler / SDK / support matrix and editable examples.

Keep the new core independent of `maplibre-gl` and React, except for type-only compatibility adapters when required. Avoid introducing a dependency on a monolithic state-management package solely for the editor. Studio UI can evolve without modifying every SDK consumer.

## 10. Tests, performance budgets and safety

**Correctness:** schema validation, property min/max and expression-capability enforcement, provider adapter fixtures, unknown field preservation, stable ID/order, deterministic roundtrip, cyclic token detection, invalid asset rejection, filter compiler consistency, rule precedence, legacy theme migration.

**Rendering:** visual screenshot golden maps across zoom/pitch/base style, gradients and labels, different screen DPI and locale; verify map picking traces correct draw order and source attribution.

**Regression:** moving/stationary two-finger touch, partial release, pinch/zoom hold, very rapid camera movement, WebGL context loss/restore, style reload during edits, switching to raster and back, marker drag, selected pin, shape overlays and geolocation.

**Performance:** quantify patch costs (paint < layout < source rebuild as a typical hierarchy), frame pacing, style ready/idle, memory growth during 1000 edits and undo cycles, main-thread long tasks, editor package load budget, minimal-vs-detailed source load. Thresholds should be measured from repeatable CI/device baselines, not invented FPS guarantees.

**Security and licensing:** use a verified expression AST without `eval`/user-supplied JavaScript execution; sanitation of SVG/assets and names/URLs; remote source allowlist or user-consent model, no tokens in public bundles, CORS diagnostics, tile-service usage policy and proper map/font/sprite attribution. Plugin boundary isolated, versioned and permission-aware.

**Availability:** no account or hosted service required to author local styles; distinguish network provider outages from compiler bugs. Raster fallback remains a functional map, even though vector controls are disabled.

## 11. Competitive benchmark (targeted, not assumed superiority)

- **Maputnik**: established open-source editor for MapLibre styles. Atlas must not merely reproduce a property panel; add semantic grouping + provenance/debugging + design-system tooling while preserving raw spec fidelity.
- **MapTiler Map Designer**: already offers comprehensive layer/attribute/font/icon/sprite/language/data source controls. Atlas must compete on portability, extensibility, authoring ergonomics, reproducible documents and deep rule debugging.
- **Mapbox Studio**: already offers visual editing, expressions, assets, custom data, hosted publishing and advanced effects within its ecosystem. Atlas should prioritize open standards, self-hostability and auditability rather than promise feature-for-feature parity with proprietary renderers.
- **QGIS**: much deeper desktop GIS/data processing and rule-based cartography. Atlas should integrate or interoperate with mature data tools, not pretend web MapLibre styling replaces all GIS workflows.

Track capability coverage by *tested property and output target*, not count of switches or marketing adjectives.

## 12. Definition of success

A developer can import an arbitrary compatible MapLibre map style, inspect exactly why a visible road/building/label looks as it does, modify a deeply nested condition without breaking unrelated styles, switch between named variants and source mappings with explicit warnings, export a standard renderer-ready style, reproduce it in another application, and profile the rendering impact. A designer can do a meaningful subset of the same work visually without needing to learn the style spec. Neither must create an account or buy a proprietary map key to edit a locally available map.

The first implementation sprint is **Phase 0 + Phase 1 + a minimal end-to-end slice of Phase 2**. Do not attempt every advanced capability at once, but architect the schema and renderer boundary so none of the later capabilities requires rebuilding the foundation.

## References (technical contracts)

- https://maplibre.org/maplibre-style-spec/
- https://maplibre.org/maplibre-style-spec/layers/
- https://maplibre.org/maplibre-style-spec/expressions/
- https://maplibre.org/maplibre-style-spec/root/
- https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
- https://docs.maptiler.com/guides/map-design/editor/
- https://docs.mapbox.com/console-tools/studio/studio-interface/
- https://maputnik.github.io/
