# Tokyo Neon preset — design revert

On November 7, 2026 the Tokyo Neon-specific contrast, opacity, line-width,
and zoom modifications introduced during the November 6 road-visibility fix
were reverted.

The theme now uses its original curated 81-preset settings, including local
road opacity 75%, paths 40%, local road width 1.3px, and the original Travel
family zoom profile. The existing typography, palette and colour reskinning
behaviour remains in place.

**Separate fix retained:** OpenFreeMap layer IDs such as `highway_minor` and
`highway_path` are classified as local roads and paths respectively, instead
of being confused with major road layers merely because their IDs contain the
generic word `highway`. This shared classification correction affects the
road-controls system, not the Tokyo Neon theme's authored values.

Regression coverage uses original OpenFreeMap Dark/Positron road-layer
fixtures, checks classification and confirms the preset's original settings.

No production integration or changes to `main` are part of this revert.
