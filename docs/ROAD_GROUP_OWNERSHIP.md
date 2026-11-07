# Primary and Secondary Roads: mutually exclusive source classes

## User-facing controls
Atlas Lab now exposes **Primary Roads** and **Secondary Roads** as the main
driving-road controls, plus independent walking and cycling paths. Each group's
opacity, colour, width, visibility and zoom may be adjusted without also
editing the opposite group. Fine-grained per-tier controls remain available
for the 81 presets.

- Primary Roads = motorway/trunk/expressway + OSM primary and **OSM secondary**
  (major city arterial roads, regardless of city).
- Secondary Roads = OSM tertiary/collector + residential, minor, unclassified,
  street, street_limited, living streets, service roads, tracks and bylanes.
- Walking/cycling paths = pedestrian, path, footway, trail, cycleway and steps.
- Railways, transit, piers, ferries and unknown features are not assigned
  blindly to a driving-road group.

The names **Primary Roads** and **Secondary Roads** are user-facing design
categories, *not* a 1:1 match for the names of OpenStreetMap road classes.
OSM `secondary` is a substantial arterial class and therefore belongs to
the Primary Roads design group; OSM `tertiary` belongs to Secondary Roads.

## Provider layer ownership
OpenFreeMap Dark and Positron each include `highway_major_inner` and
`highway_major_casing` layers filtered to `primary`, `secondary`,
`tertiary`, `trunk` together. The controls must not colour/fade those entire
layers based on their IDs. Atlas now inspects positive `class` restrictions in
provider filters before deciding if the layer is homogeneous. Mixed layers use
per-feature MapLibre expressions for opacity/paint, preserving their original
filters and underlying geographic data. The same logic covers Liberty's
secondary/tertiary mixed lanes and Bright's combined link layers.

Class mapping is defined in one shared table, used by both map-detail opacity
and the advanced road styling compiler to avoid divergence. Existing casing
layers follow the same per-feature distinction as inner road strokes.

Some complex provider-defined zoom-opacity expressions cannot be masked by
class without rebuilding/splitting the layer; Atlas reports the limitation
instead of silently hiding the whole shared layer. No tile sources or
MapLibre instances are replaced during normal styling.

## Verification
Fixture snapshots from the OpenFreeMap repository cover its Dark, Positron,
Bright and Liberty transportation line layer filters. Unit tests verify
class ownership and paint/opacity isolation on mixed road/casing layers.
Browser tests ensure Primary/Secondary changes update only their intended
internal presets and do not remount the map.

Work is restricted to `dev/style-studio` (not `main`).
