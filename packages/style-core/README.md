# @atlas/style-core

Pure TypeScript Atlas style authoring and compilation utilities. No React, browser,
MapLibre runtime, network, provider account or backend required.

- `inspectStyleLayers(style)`: inspect exact MapLibre layer IDs and **suggest** semantic groups.
- `createMinimalLightDocument(style, "positron")`: create the first versioned theme preset with explicit (reviewable) layer bindings.
- `compileAtlasStyle(style, doc)`: deterministic, non-mutating MapLibre v8 JSON compilation; group defaults followed by exact layer overrides.
- `migrateLegacyColorTheme(legacy, style, id)`: import the old six-colour v1 Atlas theme into v2.
- `parseAtlasStyleDocument` / `stringifyAtlasStyleDocument`: bounded import and deterministic export.

The compiler preserves valid unrecognised MapLibre style fields. It does **not**
yet implement a complete MapLibre property/type/expression validator or all RFC 001
features. Provider classification is a suggestion, not a guarantee. Never use
unreviewed heuristic bindings as proof of provider semantics.

See `docs/STYLE_STUDIO_RFC.md` for the phased plan.
