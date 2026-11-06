# Light-map road legibility / preset contrast correction

## Root cause

Many Atlas light presets originally used almost-white road swatches on almost-white
land. A second per-road tint blended them *further toward the land*, while
secondary/local opacity and subpixel strokes faded the result. At common city
zoom levels, some streets were hidden entirely by minimum-zoom rules.

## Changes

All light-land presets now receive a contrast-aware cartographic road palette.
The darkening is computed **after the intended line opacity is composited**
against the preset land colour. The paint starts with its existing road hue and
gradually approaches the preset's label ink as needed, rather than forcing all
themes into a generic charcoal.

Minimum default road opacity, thickness, and common-city visibility thresholds
are applied only to light presets. Motorways remain stronger than primary roads,
and local streets and trails remain subordinate. The road outline/casing
contrast is also increased where a provider already contains casing layers.

This applies to both built-in presets and 4–6-colour palette reskins. The
existing 81-style prewarming system remains unchanged. Pure theme selection
still changes only paint/layout/zoom properties on the same loaded vector map.

**Manual customisation always wins**: changes to individual road colour,
opacity, width or zoom range continue to override the preset. Resetting returns
to the improved preset defaults. Dark themes keep their existing values.

The contrast floor is a **cartographic feature-legibility threshold** and
should not be confused with WCAG text contrast requirements. Effective
visibility still depends on the provider style, feature class, zoom, and device.
