# CivicWatch companion maps

These four Atlas vector presets are designed around CivicWatch's lavender/coral light UI and deep-teal dark UI. The basemap intentionally stays less prominent than CivicWatch's separate category markers. This is a style collection, not a new source of map data.

| Atlas preset | Base | Land | Water | Parks | Roads | Buildings | Labels |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CivicWatch Lavender | Positron | #F9F6FE | #D7E8F2 | #DCECE0 | #FFFFFF | #E7DDF3 | #302B43 |
| CivicWatch Coral Paper | Positron | #FBF7F4 | #CFE5E6 | #DCE9DA | #FFFFFF | #EFDFDE | #352D38 |
| CivicWatch Clear Streets | Positron | #F4F8F7 | #B9DDE0 | #CCE6DE | #FFFFFF | #DDE9E7 | #213F47 |
| CivicWatch Night Teal | Dark | #0B262D | #17444E | #193B38 | #55767D | #173840 | #EAF5F4 |

## How to choose

**Lavender** is the default recommendation for CivicWatch light mode. Soft lavender buildings and pale streets support the existing coral report pins without competing with them.

**Coral Paper** is a warmer alternative for civic reports, editorial layouts and documentation. Blush is restricted to city blocks and subtle transport details rather than filling the map with warning red.

**Clear Streets** is suitable for mobile and dense-issue areas. Local road and road-name visibility is intentionally stronger while building density and nonessential POIs stay lower.

**Night Teal** is the dark counterpart to CivicWatch's #0A2328 panels. Pale labels and teal water balance the interface without making every road luminous.

All four suppress generic POIs, tune road and label hierarchy, adjust building visibility and change semantic geographic features. Their styling uses existing map features only and does not alter CivicWatch's report markers.

## Preview and export

In Atlas Lab, open **Style studio → Themes → CivicWatch**. The four styles appear together, with illustrative palette miniatures, and can be applied and exported as normal Atlas presets.

For an app already using MapLibre:

```ts
import {
  createAtlasPresetDocument,
  inspectStyleLayers,
  compileAtlasStyle
} from "@atlas/style-core";

const baseStyle = /* loaded MapLibre v8 style JSON */;
const document = createAtlasPresetDocument(
  "civicwatch-lavender",
  inspectStyleLayers(baseStyle),
  { baseStyle }
);
const output = compileAtlasStyle(baseStyle, document);
// Use output.style in the MapLibre integration.
```

**Integration boundary:** CivicWatch currently uses a Leaflet raster basemap. It cannot be recoloured by Atlas's MapLibre vector preset compiler. These themes are implemented and previewable inside Atlas; changing CivicWatch's live map requires a separate vector-renderer integration, while retaining its reporting, geocoding and marker logic.

The map provider controls which feature classes exist. Validate zoom-level legibility, mobile street density and marker contrast with actual tiles before production use.
