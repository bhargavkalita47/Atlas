# Atlas Preset Library and Auto Palette Reskin

The Atlas Style Studio now offers **81 curated presets** built on the four existing
OpenFreeMap vector starting styles: Positron, Liberty, Bright, and Dark.

All presets are assembled with the current v2 authoring format, using semantic
layer colours, selected opacity/visibility controls and optional major-road
width rules. None creates extra tile layers, requires an account, or uses
proprietary map API keys. This is a **style library**, not an imagery or dataset
library.

## Explore the library

In Atlas Lab, open **Style Studio → Atlas Preset Library**.

The eight searchable families are:

| Family | Cartographic mood |
| --- | --- |
| Minimal | Clean light and quiet dark surfaces |
| Editorial | Paper, architectural, museum and print atlases |
| Nature | Forest, snow, alpine, desert, rivers and coastline |
| Destinations | Regional colour inspiration (no new geographic data) |
| Retro | Sepia, film noir, vintage road maps and art deco |
| Futuristic | Blueprint, neon, holographic and technical moods |
| Expressive | Pastel, candy, vibrant colour and stylised themes |
| Functional | Navigation, transit, cycling, hiking and contrast-first palettes |

Search by name, descriptive term or category. The gallery paginates card
rendering to limit UI work. Picking a preset changes the current authoring
document and selects its base vector style, preserving the existing MapLibre
instance and Stage 1 gesture optimisation.

## Apply a palette of 4–6 colours

Choose a preset first, then use **Auto Palette Reskin**:

1. Pick one of twelve starter palettes, click **Enable custom palette**, or
   paste four to six hex colours separated by spaces, commas or newlines.
2. Edit the swatches. Valid hex edits update the map immediately.
3. The engine maps the input into ten semantic roles: land, water, parks, roads,
   buildings, labels, boundaries, transit, POIs and terrain.
4. The engine automatically adjusts the label/land contrast toward at least
   4.5:1. The interface shows the computed roles and a contrast report.
5. Switch to another preset to see the **same user palette** reinterpreted in
   the new preset's light/dark hierarchy. The preset's original base style,
   layer opacity/visibility and major-road rules remain in effect.
6. Use **Restore preset colours** to return to the underlying original theme.

Hex accepts `#RGB` and `#RRGGBB`. An input may contain four, five or six
colours. UI colour pickers and the paste field reject invalid input without
applying it. The engine is deterministic, pure and has unit tests for every
preset across 4, 5 and 6 colours.

The gallery palette previews are **illustrative** swatch compositions, not
actual screenshots or previews of external provider layer geometry.

## Technical API

```ts
import {
  ATLAS_STYLE_PRESETS,
  createAtlasPresetDocument,
  deriveSemanticPalette,
  reskinAtlasPreset,
  compileAtlasStyle,
  inspectStyleLayers,
} from "@atlas/style-core";

const baseStyle = /* a loaded MapLibre v8 style JSON */;
const layers = inspectStyleLayers(baseStyle);
const document = reskinAtlasPreset("paper-ink", [
  "#F6EBD8", "#8CBBCB", "#AACD9C", "#DE9F87", "#394553"
], layers);
const compiled = compileAtlasStyle(baseStyle,document);
// compiled.style is standards-oriented MapLibre style JSON.
// Its native authoring metadata retains the five user input colours.
```

The authoring document contains a `customPalette` array and
`paletteEngineVersion: 1` in metadata. Atlas Lab's **Export editable style
JSON (v2)** button includes the computed map-role settings and palette seed
metadata. Export is available without an account. Importing exported v2
documents back through the Studio UI is planned separately.

## Scope and honest limitations

- This first palette engine is **semantic colour allocation**, not a graphics
  shader that retints raw imagery. Raster imagery cannot be recoloured by
  selecting vector feature types without vector data.
- Colour assignment and group bindings depend on the source's actual layer
  inventory and heuristic classification. Unmapped layers retain provider
  styling. A preset cannot create missing geographic data.
- Text contrast is automatically checked against the computed **land** colour;
  this is not a WCAG certificate for every water, park, 3D, icon or overlapped
  label in every zoom position.
- Native icons/sprites, glyph fonts, complex external expressions, imagery
  licensing, 3D textures and map data require dedicated future controls.
- The first release doesn't expose named user-saved presets or cloud sync.
  Export a v2 style document to retain a customised design.
- Full arbitrary MapLibre spec property authoring belongs to the deeper
  Style Studio milestones in `docs/STYLE_STUDIO_RFC.md`.

## Verification

CI builds `@atlas/style-core`, `@atlas/react`, and the Atlas Lab Vite app,
then runs unit tests, packaging checks and Playwright Chromium tests. The
palette tests exercise every built-in preset in all three supported palette
sizes and check deterministic output, preserved layer rules and accessible
land/label contrast. The browser tests exercise palette edits, preset switching,
reset, vector canvas stability and touch/zoom regression coverage.
