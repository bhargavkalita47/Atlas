# Atlas — Open-Source Mapping Toolkit

[Open Atlas Lab](https://atlas.bhargavkalita1327.workers.dev/) · [View architecture](docs/ARCHITECTURE.md)

Atlas is a reusable mapping toolkit and visual style editor for applications that need a distinctive, configurable map without coupling their interface to a single mapping provider. Atlas Lab lets users customise map features, typography, geometry and themes, and export their work as images or portable theme configurations.

## Product capabilities

- Interactive MapLibre vector and Leaflet raster maps with OpenStreetMap-derived data.
- Semantic styling of major roads, residential streets, buildings, parks, water and labels.
- Curated themes, feature controls, geometry tools, markers, measurement and GeoJSON.
- PNG, SVG and reusable JSON theme export.
- Reusable React adapters and a style compiler for integrating the same map theme into other applications.

**Real integration:** [Shikshak](https://shikshak.co.in/) uses Atlas Pastel City for tutor discovery and home-area maps.

**Stack:** TypeScript · React · MapLibre GL JS · Leaflet · OpenFreeMap · Vite · Playwright · Cloudflare Workers

## Project timeline

| Phase | What changed |
| --- | --- |
| 5 November 2026 · Mapping toolkit | Began as a way to reuse markers, shapes, geocoding and map interactions across products. Added MapLibre for editable vector maps, OpenFreeMap as the keyless vector tile source and Leaflet as the raster option. |
| 5–6 November · Stabilisation | Split the renderers into on-demand chunks, selectively preloaded style assets, added cache rules for fingerprinted app assets and reduced rendering load on high-DPI devices. Preserved camera position across renderer changes and stabilised rapid zoom and mobile pinch interactions. |
| 7 November · [Style Studio](https://github.com/bhargavkalita47/Atlas/commit/747f9deb) | Separated main roads from residential streets and bylanes at the feature level. Primary and Secondary controls now edit independent groups even where the source style mixes road classes in one layer. |
| 7 November · [Semantic themes](https://github.com/bhargavkalita47/Atlas/commit/79628c75) | Merged 81 curated themes, searchable feature controls, independent label outline and halo controls, and task-based Studio tabs. Reset everything restores style defaults while keeping map content. |
| November · [Portable themes and exports](https://github.com/bhargavkalita47/Atlas/pull/4) | Added PNG and SVG viewport export, validated JSON theme bundles, and a reusable resolver for applying the same theme in another app. |
| 10 November · [Shikshak integration](https://github.com/Bhargav-shikshak/shikshak/pull/8) | Shikshak merged the MapLibre migration and used the Atlas compiler to reproduce the Pastel City preset on its discovery and home-area maps. |

**Today:** Atlas Lab supports map styling, geometry tools and portable theme exports. The toolkit provides reusable React adapters for vector and raster maps.

## Engineering challenges and solutions

- **Vector startup.** MapLibre and Leaflet were both loaded before the first render. Lazy-loading each renderer reduced minified initial application JavaScript from 1,503.31 kB to 269.01 kB, about 82% in the recorded builds. The vector engine, worker and tiles load separately. High-DPI rendering also gained a balanced pixel-ratio cap. See the [build comparison](docs/PERFORMANCE.md).
- **Road hierarchy across providers.** Provider layers can mix main roads and residential streets. The compiler splits mixed layers using OSM feature classes so the two groups can be styled independently.
- **Reproducing a theme elsewhere.** A theme bundle must carry semantic settings and overrides, including nullable values. The resolver validates the bundle and compiles it against a matching provider style. Tests cover round-tripping and reuse.
- **SVG output.** The export path preserves attribution and falls back when the source cannot provide suitable vector geometry. The browser regression checks that supported exports contain visible geometry. See the [adapter notes](packages/react/README.md).

## Repository layout

| Path | Responsibility |
| --- | --- |
| `packages/core` | Geographic types, geometry, GeoJSON and Photon/Nominatim geocoding |
| `packages/style-core` | Provider-aware feature classification, style compilation, themes and custom overrides |
| `packages/react` | React adapters for Leaflet raster and MapLibre vector maps, markers and shapes |
| `apps/playground` | Atlas Lab, Style Studio and diagnostics |

## Local development

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
```

Vite prints the local URL, usually http://localhost:5173. The playground configures the MapLibre browser worker before mounting the vector map. If consuming `@atlas/react/vector` in another app, follow the [React adapter setup](packages/react/README.md) for your bundler.

## Deployment

The root [Wrangler config](wrangler.jsonc) serves the Lab assets. Build with `npm run build`. For a Cloudflare Pages build, the output directory is `apps/playground/dist`. For the Worker on `main`, use the repository’s `npm run deploy` script. Review feature branches with a separate Cloudflare preview.

## Scope and attribution

Atlas Lab supports theme editing, markers, geometry, measurement, geolocation, GeoJSON and diagnostics. Routing and offline tiles are outside the current scope. OpenFreeMap hosts the public vector service, and the fallback uses public OSM raster tiles. Tile and geocoding providers have their own usage and attribution terms.

Atlas source is [MIT licensed](LICENSE). Leaflet uses BSD-2-Clause, MapLibre uses BSD-3-Clause, and OpenStreetMap data is available under ODbL. See the [architecture notes](docs/ARCHITECTURE.md) for provider and application boundaries.
