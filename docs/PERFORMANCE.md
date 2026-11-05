# Atlas vector performance — measured build results

## What was slow

In the original playground, MapLibre and Leaflet were both bundled into the initial application, despite only one renderer being visible. The WebGL engine also drew at the full device pixel ratio; changing one theme color repainted all categorized layers.

The map's external vector tiles, fonts and style JSON still require network requests, and MapLibre's GPU initialization is intrinsically more involved than displaying raster images. We must not treat a smaller page bundle as proof of a faster fully rendered vector map.

## Production bundle comparison

The figures below come from GitHub Actions Vite **production builds**, not estimated improvements from source code.

| Asset | Before stabilization | After renderer splitting |
| --- | ---: | ---: |
| Initial application JavaScript (minified) | 1,503.31 kB | **269.01 kB** |
| Initial JavaScript gzip | 426.57 kB | **84.52 kB** |
| Initial application CSS (minified) | 111.47 kB | **24.86 kB** |
| Optional MapLibre rendering chunk | Included in initial bundle | 1,078.72 kB (296.45 kB gzip) |
| Optional Leaflet rendering chunk | Included in initial bundle | 155.43 kB (45.59 kB gzip) |
| MapLibre browser worker | 517.23 kB | 517.23 kB |

**Result:** initial JavaScript size fell by approximately 82% uncompressed (80% gzip). This improves time-to-interactive for the application shell, but loading a **vector map** still fetches the optional MapLibre chunk and its worker; total cold vector startup is not reduced by the same percentage.

Baseline: Cloudflare deployment build log dated 2026-11-05 18:00 UTC (the original 1,503.31 kB Vite bundle). Optimized: GitHub Actions verification of commit `5a632c73e`, production Vite output.

## Optimizations added

- Lazy-load each map engine and its corresponding CSS separately.
- Issue an early DNS/TLS connection to `tiles.openfreemap.org` from the playground.
- Balanced vector rendering caps pixel ratio at 1.5 on high-DPI displays. High-quality mode preserves the full device pixel ratio.
- Disable world-copy rendering and tile fading in the vector map.
- Cache MapLibre layer classifications and only update changed style colors.
- Default Atlas Lab to the minimal Positron style; Liberty, Bright and Dark remain selectable.
- Expose `onPerformance` with `style` and `idle` durations in `@atlas/react/vector`; show them in Lab Diagnostics.

## How to measure in your browser

Open the Cloudflare **dev/stabilization** preview once it deploys the current branch, then:

1. Open DevTools **Network**, enable Disable cache, reload, and record JS transfer plus OpenFreeMap style/tile/font timings.
2. Open Atlas Lab **Diagnostics** and read **Vector style ready** and **Vector fully idle** times. These are separate phases; loaded geometry may still arrive after style-ready.
3. Compare Positron vs Liberty from the Style Studio at the same zoom, location and network conditions.
4. Compare Balanced vs High on the same mobile device or dense desktop display, testing pan and zoom responsiveness.
5. Repeat with browser cache enabled, because normal repeat visits should avoid most application and tile downloads.

Browser timings depend on network and device capability, so no universal speedup multiplier is claimed.

## Remaining opportunities

- Build a minimal Atlas-owned vector style with fewer source layers and labels, then compare it against OpenFreeMap presets. It can reference the same keyless OSM-derived tile source.
- Cache immutable vendor chunks across deployments; avoid changes that invalidate the MapLibre chunk unnecessarily.
- Use WebGL GeoJSON layers plus clustering when there are thousands of markers.
- Compare OpenFreeMap tile/glyph latency from different regions. A different permitted tile host or self-hosted archive may help where third-party latency dominates.
- Add repeatable real-device frame-rate and cold/warm-start benchmarks before changing production maps.

Do not merge optimization changes into `main` solely on bundle-size numbers; confirm live map completeness and interactions first.
