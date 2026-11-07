# Atlas Lab exports (export-test)

Atlas Lab's **Export** section includes three downloads: PNG, real-vector SVG and a reusable JSON theme recipe. The top-right map download icon opens the panel. All files are created locally by the browser; neither Atlas Lab nor the Atlas SDK uploads them.

## PNG

Captures the visible vector viewport, Atlas pins and provider attribution. The output uses the map's current rendered canvas pixel density. Moving or low-resolution states may produce a lower-density image than a high-quality stationary map. It does not capture other page UI. The capture is made during a WebGL render frame: Atlas deliberately does **not** leave `preserveDrawingBuffer` enabled during map interaction, preserving earlier performance optimizations.

## SVG

Uses `@versatiles/svg-renderer` to render a genuine vector map from the active MapLibre style, with supported fills, lines, circles and labels. Atlas pins and attribution are overlaid as vector elements. Unsupported layers (such as raster, hillshade or some 3D/terrain effects) may be embedded as images; label placement and font metrics can differ from the interactive MapLibre view. SVG renders by loading the relevant map resources and may fail if provider assets forbid cross-origin access or are offline.

Attribution must be retained in distributed images. Neither format is a license to redistribute tiles or geographic data contrary to the underlying provider's terms.

**Current scope:** Vector renderer only. Raster/Leaflet fallback image export, print-size exports, full-world map exports, and server-side exports are outside this test branch.

## Portable Atlas theme JSON v1

`atlas-theme-v1.json` is an authoring **recipe**, not an image, GeoJSON collection, binary map package, or standalone MapLibre style file. It records:

- Original Atlas preset ID, exact matching base style (Positron, Liberty, Bright or Dark) and color-palette seed values.
- Original Atlas Style Document v2 with group colors and editable per-layer paint/layout bindings.
- Sparse road visibility/detail overrides and semantic feature overrides.
- Road widths, casings, stroke colors/dashes, label font stacks, halos, outlines, visibility, and zoom limits.
- Semantic layer choices including water, vegetation, buildings, POIs, borders and transit.

It deliberately **does not** move a user's map center, pin/report locations, drawings, account data, or application-specific marker colors. This is essential for reskinning existing CivicWatch/Shikshak maps without modifying their data.

The schema is versioned (`format: "atlas-theme"`, `schemaVersion: 1`, `styleDocumentVersion: 2`). `parseAtlasThemeBundle` rejects unknown schema versions, unknown presets/providers, unsafe keys, invalid overrides and payloads exceeding 2 MB. Import/export round-tripping is available in the Atlas Lab Export section.

### Reusing a theme in an Atlas integration

The **same Atlas vector base and layer inventory** is needed for exact visual reproduction. Atlas styling always depends on available provider layers. The helper recomputes the live style against the consumer's base style and layer inventory, so clients do not need to duplicate Atlas Lab's styling logic:

```tsx
import {parseAtlasThemeBundle,resolveAtlasThemeBundle,getAtlasPresetCoreColors} from "@atlas/style-core";
import {KEYLESS_VECTOR_STYLES} from "@atlas/react/vector-config";
import {AtlasVectorMap} from "@atlas/react/vector";

// Load your committed/imported JSON once, not inside every render:
const theme=parseAtlasThemeBundle(themeJsonString);

// Inside a React component:
const [styleDocument,setStyleDocument]=useState(theme.document);
<AtlasVectorMap
  center={currentUserOrReportLocation}
  zoom={13}
  styleUrl={KEYLESS_VECTOR_STYLES[theme.vectorStyle]}
  theme={getAtlasPresetCoreColors(theme.presetId)}
  styleDocument={styleDocument}
  onStyleLayers={(layers,baseStyle)=>{
    setStyleDocument(resolveAtlasThemeBundle(theme,layers,baseStyle));
  }}
  markers={existingProjectMarkers}
  shapes={existingProjectShapes}
/>;
```

The consuming project must already use the Atlas vector map component, or adapt its existing MapLibre/Leaflet integration. This branch **does not modify CivicWatch or Shikshak**. Their data and UI stay independent. Provider-specific symbol layouts, missing layers and custom glyph fonts may require an integration pass.

## Verification

Run `npm run check` for the TypeScript build and Vitest suites, and `npm run test:e2e` for browser workflows. This test branch has its own GitHub Actions push verification. Inspect screenshots manually for SVG alignment, especially complex typography and coverage across different cities.
