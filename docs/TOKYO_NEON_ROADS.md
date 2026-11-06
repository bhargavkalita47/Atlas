# Tokyo Neon — Roads invisible in the dark-map preview

The Studio's Tokyo Neon theme previously used the Travel-family road hierarchy
without a Tokyo-specific contrast or density correction. After its road colours
were mixed toward the very dark land colour, the actual on-screen contrast of
local roads was only about 1.6:1; service/path roads were closer to 1.2:1 after
their 40% opacity. This looked like missing road tiles.

The Tokyo Neon preset now has a distinct high-contrast violet road hierarchy.
It enhances motorways, primary/secondary connections, local roads and paths;
sets readable widths, brings local roads into the z10+ city view and increases
local/path opacity. Brightness is drawn from the current theme's label/road
colours, so custom palettes still work. Manually edited road settings remain
higher priority than the preset.

Unit coverage includes real layer IDs, filters and paint structure from
OpenFreeMap Dark and Positron styles. No world tiles are downloaded during
testing. Fixes remain in Atlas Lab and `dev/style-studio`; the cached vector
base is not replaced and CivicWatch/Shikshak are unchanged.

If roads are absent even under other presets when viewing the geographical
city of Tokyo, inspect tile network errors separately; the Tokyo Neon theme
cannot repair a missing provider tile.
