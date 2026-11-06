import {getAtlasPreset,type AtlasPresetDefinition} from "./presets";
import {isLightMapSurface,LIGHT_ROAD_OPACITY_FLOOR} from "./roadLegibility";
import {
  ROAD_TIERS,DETAIL_FEATURES,createMapDetailSettings,
  type MapDetailSettings,type RoadTier,type DetailFeature,type DetailLevel
} from "./detailControls";

/**
 * Atlas cartographic preset profiles v2.
 *
 * Each preset has its own intended information hierarchy, not just a colour
 * theme. A small family baseline provides consistency; named adjustments
 * determine which routes, labels, transit and features deserve emphasis.
 * Map Detail Controls may override these settings without mutating a preset.
 */
type Family=AtlasPresetDefinition["family"];
type DetailPatch={
  roads?:Partial<Record<RoadTier,number>>;
  features?:Partial<Record<DetailFeature,Partial<DetailLevel>>>;
};
const familyProfiles:Record<Family,DetailPatch>={
  minimal:{roads:{motorway:100,primary:90,secondary:70,local:45,paths:25},
    features:{buildings:{opacity:45},poi:{visible:false},roadLabels:{opacity:75},
      boundaries:{opacity:45},transit:{opacity:65},terrain:{opacity:45}}},
  editorial:{roads:{motorway:95,primary:95,secondary:80,local:65,paths:50},
    features:{buildings:{opacity:70},poi:{opacity:60},boundaries:{opacity:80},
      roadLabels:{opacity:90},terrain:{opacity:65}}},
  nature:{roads:{motorway:70,primary:70,secondary:65,local:65,paths:95},
    features:{buildings:{opacity:50},parks:{opacity:100},terrain:{opacity:100},
      poi:{opacity:60},transit:{opacity:35},boundaries:{opacity:35}}},
  travel:{roads:{motorway:95,primary:95,secondary:90,local:75,paths:70},
    features:{buildings:{opacity:85},poi:{opacity:85},placeLabels:{opacity:100},
      parks:{opacity:95},boundaries:{opacity:60}}},
  retro:{roads:{motorway:95,primary:90,secondary:75,local:55,paths:35},
    features:{buildings:{opacity:65},roadLabels:{opacity:85},poi:{opacity:55},
      transit:{opacity:50},boundaries:{opacity:65}}},
  futuristic:{roads:{motorway:100,primary:95,secondary:60,local:30,paths:15},
    features:{buildings:{opacity:55},roadLabels:{opacity:75},poi:{visible:false},
      boundaries:{opacity:50},parks:{opacity:55},terrain:{opacity:35},
      transit:{opacity:75}}},
  expressive:{roads:{motorway:95,primary:90,secondary:75,local:55,paths:40},
    features:{buildings:{opacity:80},parks:{opacity:85},poi:{opacity:70},
      boundaries:{opacity:60},terrain:{opacity:40}}},
  utility:{roads:{motorway:100,primary:100,secondary:95,local:80,paths:65},
    features:{buildings:{opacity:60},poi:{opacity:75},boundaries:{opacity:75},
      placeLabels:{opacity:100},roadLabels:{opacity:100}}}
};
/**
 * Named priorities are intentionally curated rather than computed from the
 * colour's luminance. Every entry corresponds to a shipped preset, and
 * defaults still cover additions to the collection.
 */
const refinements:Record<string,DetailPatch>={
  "minimal-light":{roads:{local:35,paths:15},features:{buildings:{opacity:30},transit:{visible:false}}},
  "minimal-dark":{roads:{local:30,paths:10},features:{buildings:{opacity:35},transit:{visible:false}}},
  "paper-ink":{roads:{local:70,paths:55},features:{parks:{opacity:80},boundaries:{opacity:65}}},
  "pastel-city":{roads:{local:65,paths:45},features:{buildings:{opacity:95},poi:{opacity:80}}},
  "graphite-mono":{roads:{local:25,paths:10},features:{buildings:{opacity:35},roadLabels:{opacity:65}}},
  "blueprint":{roads:{local:50,paths:20},features:{boundaries:{opacity:85},buildings:{opacity:45},transit:{opacity:90}}},
  "electric-night":{roads:{local:45,paths:20},features:{transit:{opacity:90},buildings:{opacity:65}}},
  "terra":{roads:{local:70,paths:70},features:{parks:{opacity:100},terrain:{opacity:85}}},
  "coastal":{roads:{local:70,paths:75},features:{water:{opacity:100},parks:{opacity:100}}},
  "high-contrast":{roads:{motorway:100,primary:100,secondary:100,local:95,paths:80},features:{buildings:{opacity:75},placeLabels:{opacity:100},roadLabels:{opacity:100},boundaries:{opacity:90},poi:{opacity:100,visible:null}}},
  "snowfall":{roads:{local:35,paths:25},features:{parks:{opacity:60},buildings:{opacity:30}}},
  "linen":{roads:{secondary:65,local:35},features:{buildings:{opacity:35},boundaries:{opacity:30}}},
  "mist":{roads:{secondary:60,local:30},features:{placeLabels:{opacity:95},buildings:{opacity:25}}},
  "porcelain":{roads:{local:30,paths:10},features:{buildings:{opacity:30},terrain:{visible:false}}},
  "ash-blue":{roads:{secondary:75,local:40},features:{water:{opacity:90},parks:{opacity:65}}},
  "carbon":{roads:{local:25,paths:10},features:{buildings:{opacity:25},roadLabels:{opacity:70}}},
  "chalkboard":{roads:{local:45,paths:20},features:{parks:{opacity:40},boundaries:{opacity:20}}},
  "paper-slate":{roads:{local:55,paths:30},features:{buildings:{opacity:60},boundaries:{opacity:60}}},
  "newspaper":{roads:{local:75,paths:35},features:{boundaries:{opacity:75},roadLabels:{opacity:100}}},
  "museum":{roads:{secondary:70,local:45,paths:20},features:{buildings:{opacity:95},poi:{visible:false}}},
  "architectural":{roads:{local:80,paths:35},features:{buildings:{opacity:100},roadLabels:{opacity:75}}},
  "old-atlas":{roads:{local:55,paths:75},features:{terrain:{opacity:100},parks:{opacity:85}}},
  "alabaster":{roads:{secondary:75,local:50},features:{buildings:{opacity:65},poi:{opacity:40}}},
  "burgundy-print":{roads:{local:70,paths:45},features:{buildings:{opacity:75},boundaries:{opacity:90}}},
  "night-editorial":{roads:{local:40,paths:25},features:{roadLabels:{opacity:95},buildings:{opacity:35}}},
  "cartographer":{roads:{local:60,paths:80},features:{boundaries:{opacity:100},terrain:{opacity:100}}},
  "evergreen":{roads:{motorway:60,primary:65,secondary:50,paths:100},features:{parks:{opacity:100},buildings:{opacity:25}}},
  "alpine":{roads:{motorway:60,local:45,paths:100},features:{terrain:{opacity:100},transit:{visible:false}}},
  "forest-floor":{roads:{motorway:50,primary:55,paths:100},features:{parks:{opacity:100},boundaries:{opacity:20}}},
  "meadow":{roads:{local:60,paths:90},features:{parks:{opacity:100},buildings:{opacity:35}}},
  "spring-bloom":{roads:{local:70,paths:80},features:{parks:{opacity:100},poi:{opacity:75}}},
  "river-basin":{roads:{motorway:60,secondary:55,paths:85},features:{water:{opacity:100},boundaries:{opacity:30}}},
  "desert-sands":{roads:{local:60,paths:100},features:{terrain:{opacity:100},water:{opacity:75}}},
  "savanna":{roads:{local:75,paths:100},features:{parks:{opacity:75},terrain:{opacity:95}}},
  "coral-reef":{roads:{motorway:60,primary:65,paths:80},features:{water:{opacity:100},buildings:{opacity:35}}},
  "tundra":{roads:{local:40,paths:95},features:{terrain:{opacity:100},parks:{opacity:60}}},
  "mediterranean":{roads:{local:80,paths:75},features:{water:{opacity:100},poi:{opacity:95}}},
  "nordic-fjord":{roads:{local:60,paths:90},features:{terrain:{opacity:95},water:{opacity:100}}},
  "tokyo-neon":{roads:{motorway:100,primary:100,secondary:98,local:90,paths:75},
    features:{transit:{opacity:100},poi:{visible:null,opacity:100}}},
  "kyoto-washi":{roads:{secondary:75,local:70,paths:90},features:{parks:{opacity:100},poi:{opacity:70}}},
  "sahara-trek":{roads:{motorway:75,local:60,paths:100},features:{terrain:{opacity:100},transit:{visible:false}}},
  "himalayan":{roads:{motorway:60,paths:100},features:{terrain:{opacity:100},buildings:{opacity:35}}},
  "indian-monsoon":{roads:{local:90,paths:75},features:{water:{opacity:100},poi:{opacity:90}}},
  "tropical-island":{roads:{motorway:70,local:70,paths:95},features:{water:{opacity:100},parks:{opacity:100}}},
  "arctic-ice":{roads:{motorway:60,local:45,paths:90},features:{terrain:{opacity:100},buildings:{opacity:25}}},
  "sepia-archive":{roads:{local:60,paths:55},features:{boundaries:{opacity:90},terrain:{opacity:75}}},
  "vintage-road":{roads:{motorway:100,primary:100,local:70},features:{roadLabels:{opacity:100},poi:{opacity:65}}},
  "seventies-orange":{roads:{local:65,paths:55},features:{parks:{opacity:90},buildings:{opacity:80}}},
  "eighties-grid":{roads:{local:35,paths:10},features:{transit:{opacity:95},buildings:{opacity:45}}},
  "film-noir":{roads:{local:15,paths:0},features:{buildings:{opacity:20},poi:{visible:false},boundaries:{opacity:20}}},
  "analog-crt":{roads:{local:30,paths:10},features:{roadLabels:{opacity:60},transit:{opacity:35}}},
  "art-deco":{roads:{local:40,paths:15},features:{boundaries:{opacity:100},buildings:{opacity:65}}},
  "arcade":{roads:{local:60,paths:30},features:{poi:{opacity:95},transit:{opacity:100}}},
  "cyberpunk":{roads:{local:70,paths:35},features:{transit:{opacity:100},poi:{visible:null,opacity:90}}},
  "synthwave":{roads:{local:55,paths:30},features:{transit:{opacity:95},parks:{opacity:25}}},
  "terminal":{roads:{local:25,paths:10},features:{poi:{visible:false},roadLabels:{opacity:95}}},
  "hologram":{roads:{secondary:80,local:55,paths:30},features:{boundaries:{opacity:90},transit:{opacity:90}}},
  "obsidian":{roads:{local:20,paths:5},features:{buildings:{opacity:30},poi:{visible:false}}},
  "data-grid":{roads:{secondary:95,local:50},features:{boundaries:{opacity:100},roadLabels:{opacity:85}}},
  "quantum-cyan":{roads:{local:45,paths:20},features:{water:{opacity:90},boundaries:{opacity:80}}},
  "circuit-board":{roads:{local:55,paths:30},features:{buildings:{opacity:60},transit:{opacity:80}}},
  "navigation":{roads:{motorway:100,primary:100,secondary:100,local:90,paths:70},features:{buildings:{opacity:25},terrain:{visible:false},poi:{opacity:85}}},
  "transit-map":{roads:{motorway:75,primary:75,secondary:55,local:25,paths:20},features:{transit:{visible:true,opacity:100},buildings:{opacity:20},poi:{opacity:85}}},
  "hiking":{roads:{motorway:45,primary:50,secondary:55,local:70,paths:100},features:{terrain:{opacity:100},parks:{opacity:100},transit:{visible:false}}},
  "cycling":{roads:{motorway:55,primary:70,secondary:80,local:100,paths:100},features:{transit:{opacity:70},buildings:{opacity:40}}},
  "emergency":{roads:{motorway:100,primary:100,secondary:100,local:100,paths:80},features:{buildings:{opacity:30},poi:{opacity:100},roadLabels:{opacity:100}}},
  "maritime":{roads:{motorway:50,primary:55,secondary:45,local:25,paths:20},features:{water:{opacity:100},boundaries:{opacity:90},terrain:{opacity:70}}},
  "aviation":{roads:{motorway:65,primary:65,secondary:50,local:30,paths:15},features:{boundaries:{opacity:100},terrain:{opacity:90}}},
  "survey":{roads:{local:90,paths:85},features:{boundaries:{opacity:100},buildings:{opacity:100},terrain:{opacity:85}}},
  "accessibility-light":{roads:{motorway:100,primary:100,secondary:100,local:100,paths:90},features:{roadLabels:{opacity:100},placeLabels:{opacity:100},poi:{opacity:100}}},
  "accessibility-dark":{roads:{motorway:100,primary:100,secondary:100,local:100,paths:90},features:{roadLabels:{opacity:100},placeLabels:{opacity:100},poi:{opacity:100}}},
  "candy":{roads:{local:75,paths:50},features:{poi:{opacity:95},buildings:{opacity:90}}},
  "bubblegum":{roads:{local:75,paths:55},features:{buildings:{opacity:95},poi:{opacity:90}}},
  "sakura":{roads:{local:65,paths:65},features:{parks:{opacity:100},buildings:{opacity:85}}},
  "lavender-fields":{roads:{local:50,paths:35},features:{buildings:{opacity:75},poi:{opacity:45}}},
  "sunset-city":{roads:{local:75,paths:55},features:{buildings:{opacity:90},water:{opacity:100}}},
  "festival":{roads:{local:90,paths:60},features:{poi:{opacity:100},transit:{opacity:95}}},
  "midnight-violet":{roads:{local:40,paths:20},features:{buildings:{opacity:50},poi:{opacity:60}}},
  "peach":{roads:{local:75,paths:55},features:{buildings:{opacity:90},parks:{opacity:90}}},
  "mint-pop":{roads:{local:65,paths:65},features:{water:{opacity:95},parks:{opacity:100}}},
  "solar-flare":{roads:{local:65,paths:25},features:{transit:{opacity:90},buildings:{opacity:65}}}
};
function applyProfilePatch(target:MapDetailSettings,patch:DetailPatch):void{
  for(const [key,value] of Object.entries(patch.roads??{}))
    target.roads[key as RoadTier]=value;
  for(const [key,delta] of Object.entries(patch.features??{})){
    const feature=key as DetailFeature;
    target.features[feature]={...target.features[feature],...delta};
  }
}
/** Returns a fresh editable copy of the complete cartographic profile. */
export function getAtlasPresetDetailSettings(id:string):MapDetailSettings{
  const preset=getAtlasPreset(id);
  const result=createMapDetailSettings();
  applyProfilePatch(result,familyProfiles[preset.family]);
  const exact=refinements[id];
  if(exact)applyProfilePatch(result,exact);
  // The older ultra-low-opacity hierarchy made thin roads disappear on
  // light land even when their paint colour was correct. Maintain the
  // visual tiers, but give each one a reliably visible lower bound.
  if(isLightMapSurface(preset.palette.land)){
    for(const tier of ROAD_TIERS)
      result.roads[tier]=Math.max(result.roads[tier],LIGHT_ROAD_OPACITY_FLOOR[tier]);
  }
  return result;
}
/** Stable human-readable profile tag, useful for style export and diagnostics. */
export const ATLAS_DETAIL_PROFILE_VERSION=2 as const;
