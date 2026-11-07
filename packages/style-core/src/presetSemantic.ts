import {getAtlasPreset,type AtlasPresetDefinition} from "./presets";
import {
  createSemanticFeatureSettings,SEMANTIC_KEYS,
  type SemanticFeature,type SemanticStyleSettings,type FeatureDesign,type FeatureZoom
} from "./semanticFeatures";

/**
 * Atlas semantic cartography recipe v1. Every one of the 81 curated themes
 * receives its own feature palette, opacity hierarchy and provider-aware
 * optional detailing. This is a design recipe, not a new tile source.
 */
export const ATLAS_SEMANTIC_PROFILE_VERSION=1 as const;
export type SemanticPaletteOverride=Partial<Record<
  "land"|"water"|"parks"|"roads"|"buildings"|"labels"|"boundaries"|"transit"|"poi",string
>>;
export type SemanticFeatureOverride=Partial<Omit<FeatureDesign,"zoom">>&{
  zoom?:Partial<FeatureZoom>;
};
export type SemanticOverrides=Partial<Record<SemanticFeature,SemanticFeatureOverride>>;
export const createSemanticOverrides=():SemanticOverrides=>({});
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function mergeSemanticOverrides(base:SemanticStyleSettings,overrides:SemanticOverrides):SemanticStyleSettings{
  const next=clone(base);
  for(const key of SEMANTIC_KEYS){
    const change=overrides[key];
    if(change)next[key]={...next[key],...change,zoom:{...next[key].zoom,...change.zoom}};
  }
  return next;
}
export function deriveSemanticOverrides(base:SemanticStyleSettings,desired:SemanticStyleSettings):SemanticOverrides{
  const result=createSemanticOverrides();
  for(const key of SEMANTIC_KEYS){
    const before=base[key],after=desired[key];
    const diff:SemanticFeatureOverride={};
    for(const prop of ["color","opacity","visible","width","outlineColor","dash","iconSize","heightScale"] as const){
      if(!same(before[prop],after[prop]))
        (diff as Record<string,unknown>)[prop]=clone(after[prop]);
    }
    const zoom:Partial<FeatureZoom>={};
    if(before.zoom.min!==after.zoom.min)zoom.min=after.zoom.min;
    if(before.zoom.max!==after.zoom.max)zoom.max=after.zoom.max;
    if(Object.keys(zoom).length)diff.zoom=zoom;
    if(Object.keys(diff).length)result[key]=diff;
  }
  return result;
}
function mix(a:string,b:string,fraction:number):string{
  const weight=Math.min(1,Math.max(0,fraction));
  const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);
  return "#"+[16,8,0].map(shift=>{
    const first=(x>>shift)&255,last=(y>>shift)&255;
    return Math.round(first+(last-first)*weight).toString(16).padStart(2,"0");
  }).join("").toUpperCase();
}
function luminance(hex:string):number{
  const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const linear=channels.map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
  return linear[0]!*.2126+linear[1]!*.7152+linear[2]!*.0722;
}
type Family=AtlasPresetDefinition["family"];
type Recipe={
  buildings:number;landuse:number;nature:number;water:number;
  rivers:number;paths:number;poi:number;boundaries:number;transit:number;
  strokes:number;poiScale:number;cityDetail:number;outline:boolean;
  boundaryDash:"inherit"|"dashed";
};
const family:Record<Family,Recipe>={
  minimal:  {buildings:55,landuse:58,nature:70,water:90,rivers:70,paths:50,poi:42,boundaries:40,transit:43,strokes:.7,poiScale:.83,cityDetail:14,outline:false,boundaryDash:"inherit"},
  editorial:{buildings:82,landuse:72,nature:86,water:95,rivers:84,paths:68,poi:67,boundaries:75,transit:64,strokes:1,poiScale:.96,cityDetail:12,outline:true,boundaryDash:"inherit"},
  nature:   {buildings:53,landuse:72,nature:99,water:100,rivers:97,paths:91,poi:74,boundaries:48,transit:38,strokes:1.25,poiScale:.98,cityDetail:13,outline:false,boundaryDash:"inherit"},
  travel:   {buildings:75,landuse:78,nature:91,water:100,rivers:94,paths:78,poi:90,boundaries:63,transit:84,strokes:1.3,poiScale:1.13,cityDetail:11,outline:true,boundaryDash:"inherit"},
  retro:    {buildings:80,landuse:80,nature:86,water:94,rivers:82,paths:71,poi:64,boundaries:85,transit:66,strokes:1,poiScale:.94,cityDetail:13,outline:true,boundaryDash:"dashed"},
  futuristic:{buildings:75,landuse:55,nature:66,water:95,rivers:75,paths:54,poi:72,boundaries:67,transit:87,strokes:1.1,poiScale:1.08,cityDetail:14,outline:false,boundaryDash:"dashed"},
  expressive:{buildings:91,landuse:85,nature:94,water:100,rivers:91,paths:75,poi:89,boundaries:78,transit:79,strokes:1.15,poiScale:1.16,cityDetail:12,outline:true,boundaryDash:"inherit"},
  utility:  {buildings:67,landuse:70,nature:80,water:100,rivers:96,paths:78,poi:92,boundaries:86,transit:95,strokes:1.5,poiScale:1.2,cityDetail:10,outline:true,boundaryDash:"inherit"}
};
type FeaturePatch=Partial<Omit<FeatureDesign,"zoom">>&{zoom?:Partial<FeatureZoom>};
const named:Record<string,Partial<Record<SemanticFeature,FeaturePatch>>>={
  "minimal-light":{buildings:{opacity:42},poiFood:{visible:false},poiShopping:{visible:false},localBorders:{opacity:23}},
  "minimal-dark":{buildings:{opacity:47},poiFood:{visible:false},poiShopping:{visible:false},localBorders:{opacity:19}},
  "pastel-city":{gardens:{opacity:96},buildings:{opacity:88},poiFood:{iconSize:1.12},poiShopping:{iconSize:1.08}},
  "graphite-mono":{buildings:{opacity:36},poiFood:{visible:false},poiShopping:{visible:false},localBorders:{opacity:22}},
  "terra":{terrain:{opacity:92},agriculture:{opacity:89},grass:{opacity:93},streams:{width:1.45}},
  "high-contrast":{buildings:{opacity:87},poiHealth:{opacity:100,iconSize:1.3},poiTransit:{opacity:100,iconSize:1.3},localBorders:{opacity:80,width:1.2}},
  "carbon":{buildings:{opacity:43},forests:{opacity:59},localBorders:{opacity:18}},
  "linen":{residential:{opacity:52},gardens:{opacity:64},streams:{opacity:48}},
  "mist":{buildings:{opacity:28},streams:{opacity:43},forests:{opacity:53},localBorders:{opacity:18}},
  "porcelain":{buildings:{opacity:45},poiFood:{visible:false},poiShopping:{visible:false},gardens:{opacity:64}},
  "ash-blue":{waterBodies:{opacity:97},rivers:{opacity:93},forests:{opacity:60},poiLandmarks:{opacity:50}},
  "chalkboard":{parks:{opacity:53},buildings:{opacity:52},countryBorders:{opacity:29,dash:"dashed"},poiShopping:{visible:false}},
  "paper-slate":{buildings:{opacity:65},regionBorders:{opacity:71},poiLandmarks:{opacity:58}},
  "snowfall":{waterBodies:{opacity:88},buildings:{opacity:53},streams:{opacity:57}},
  "museum":{buildings:{opacity:94,outlineColor:"#8C9294"},poiLandmarks:{opacity:91,iconSize:1.13}},
  "alabaster":{buildings:{opacity:70},gardens:{opacity:72},localBorders:{opacity:33},poiShopping:{opacity:36}},
  "burgundy-print":{poiLandmarks:{opacity:91,iconSize:1.1},countryBorders:{opacity:89},gardens:{opacity:78}},
  "night-editorial":{buildings:{opacity:44},railways:{opacity:57},regionBorders:{opacity:61},poiFood:{opacity:47}},
  "architectural":{buildings:{opacity:95},countryBorders:{width:1.7},regionBorders:{width:1.1}},
  "old-atlas":{countryBorders:{width:2.1,dash:"dashed"},localBorders:{opacity:37}},
  "newspaper":{buildings:{opacity:76},countryBorders:{width:2,dash:"dashed"}},
  "paper-ink":{gardens:{opacity:77},poiLandmarks:{opacity:78}},
  "cartographer":{countryBorders:{width:2.3},regionBorders:{width:1.3}},
  "alpine":{forests:{opacity:100},terrain:{opacity:100},rivers:{width:2.4}},
  "evergreen":{forests:{opacity:100},parks:{opacity:95},streams:{opacity:87}},
  "forest-floor":{forests:{opacity:100},agriculture:{opacity:75},streams:{width:1.7}},
  "meadow":{grass:{opacity:100},gardens:{opacity:100},forests:{opacity:91}},
  "spring-bloom":{gardens:{opacity:100},parks:{opacity:100},poiLandmarks:{opacity:84}},
  "river-basin":{rivers:{width:3.25,opacity:100},streams:{width:1.8},waterBodies:{opacity:100}},
  "coral-reef":{waterBodies:{opacity:100},rivers:{width:1.65},poiLandmarks:{opacity:88}},
  "desert-sands":{agriculture:{opacity:47},forests:{opacity:50},terrain:{opacity:100}},
  "savanna":{grass:{opacity:99},agriculture:{opacity:90},forests:{opacity:57}},
  "tundra":{forests:{opacity:52},terrain:{opacity:100},waterBodies:{opacity:95}},
  "coastal":{waterBodies:{opacity:100},rivers:{width:2.5},poiLandmarks:{iconSize:1.13}},
  "mediterranean":{waterBodies:{opacity:100},poiLandmarks:{opacity:100},parks:{opacity:88}},
  "nordic-fjord":{waterBodies:{opacity:100},forests:{opacity:100},rivers:{width:2.25}},
  "tropical-island":{waterBodies:{opacity:100},gardens:{opacity:100},poiFood:{opacity:98}},
  "arctic-ice":{waterBodies:{opacity:100},streams:{opacity:60},forests:{opacity:62}},
  "himalayan":{terrain:{opacity:100},forests:{opacity:96},rivers:{width:2.4}},
  "sahara-trek":{terrain:{opacity:100},agriculture:{opacity:50},rivers:{width:1.6}},
  "indian-monsoon":{waterBodies:{opacity:100},rivers:{width:2.8},streams:{width:1.65}},
  "kyoto-washi":{gardens:{opacity:98},poiLandmarks:{opacity:96},forests:{opacity:89}},
  "tokyo-neon":{buildings:{opacity:84},poiTransit:{iconSize:1.2},railways:{opacity:91}},
  "film-noir":{buildings:{opacity:75},localBorders:{opacity:15},poiFood:{opacity:45}},
  "sepia-archive":{countryBorders:{dash:"dashed",opacity:92},regionBorders:{dash:"dashed"}},
  "vintage-road":{countryBorders:{width:1.9},railways:{opacity:68}},
  "seventies-orange":{agriculture:{opacity:91},gardens:{opacity:95},poiFood:{iconSize:1.08},railways:{opacity:45}},
  "art-deco":{buildings:{opacity:91},countryBorders:{opacity:91,width:2.1}},
  "eighties-grid":{railways:{opacity:92},countryBorders:{dash:"dashed"}},
  "analog-crt":{poiFood:{opacity:48},poiTransit:{opacity:79},railways:{width:1.6}},
  "arcade":{poiLandmarks:{iconSize:1.36},poiFood:{iconSize:1.2}},
  "cyberpunk":{poiTransit:{iconSize:1.3,opacity:100},railways:{width:2.15},poiFood:{opacity:94}},
  "synthwave":{poiLandmarks:{iconSize:1.25},railways:{width:1.9},countryBorders:{dash:"dashed"}},
  "blueprint":{buildings:{outlineColor:"#8AB5D0",opacity:90,heightScale:1.15},regionBorders:{width:1.3}},
  "electric-night":{poiTransit:{iconSize:1.3},railways:{opacity:100},poiLandmarks:{opacity:92}},
  "terminal":{railways:{width:1.3,opacity:100},poiShopping:{opacity:45}},
  "data-grid":{railways:{width:1.5},countryBorders:{dash:"dashed",width:2}},
  "quantum-cyan":{waterBodies:{opacity:100},railways:{width:1.7}},
  "hologram":{buildings:{opacity:63},railways:{opacity:96},poiTransit:{iconSize:1.24}},
  "obsidian":{buildings:{opacity:36},localBorders:{opacity:18},poiFood:{visible:false},poiShopping:{visible:false},railways:{opacity:44}},
  "circuit-board":{railways:{width:2.1},forests:{opacity:65}},
  "navigation":{buildings:{opacity:54},poiTransit:{iconSize:1.33,opacity:100},poiHealth:{iconSize:1.22},localBorders:{opacity:24}},
  "transit-map":{railways:{width:3.5,opacity:100},poiTransit:{iconSize:1.55,opacity:100},poiShopping:{opacity:45},poiFood:{opacity:48}},
  "hiking":{forests:{opacity:100},terrain:{opacity:100},poiLandmarks:{iconSize:1.4},rivers:{width:2.7},railways:{opacity:26}},
  "cycling":{parks:{opacity:98},railways:{opacity:33},poiTransit:{iconSize:1.25},rivers:{width:2.4}},
  "emergency":{poiHealth:{opacity:100,iconSize:1.5,visible:true},poiFood:{visible:false},poiShopping:{visible:false},countryBorders:{width:2.2}},
  "maritime":{waterBodies:{opacity:100},rivers:{width:3.75,opacity:100},streams:{width:1.5},poiTransit:{opacity:100},buildings:{opacity:35}},
  "aviation":{countryBorders:{width:2.2,opacity:100},regionBorders:{width:1.6},poiTransit:{iconSize:1.5},buildings:{opacity:38}},
  "survey":{countryBorders:{width:2.65,opacity:100},regionBorders:{width:2.05,opacity:95},localBorders:{width:1.15,opacity:88}},
  "accessibility-light":{buildings:{opacity:74},countryBorders:{width:2.3},poiHealth:{iconSize:1.5,opacity:100},poiTransit:{iconSize:1.5}},
  "accessibility-dark":{buildings:{opacity:76},countryBorders:{width:2.3},poiHealth:{iconSize:1.5,opacity:100},poiTransit:{iconSize:1.5}},
  "festival":{poiFood:{iconSize:1.36,opacity:100},poiLandmarks:{iconSize:1.5,opacity:100},poiShopping:{opacity:98}},
  "bubblegum":{gardens:{opacity:100},poiFood:{iconSize:1.22,opacity:95},poiShopping:{iconSize:1.16}},
  "peach":{gardens:{opacity:96},waterBodies:{opacity:100},poiLandmarks:{iconSize:1.14},residential:{opacity:71}},
  "mint-pop":{parks:{opacity:100},grass:{opacity:95},poiHealth:{iconSize:1.15},poiTransit:{iconSize:1.15}},
  "sakura":{gardens:{opacity:100},parks:{opacity:98},poiLandmarks:{opacity:94}},
  "candy":{gardens:{opacity:100},poiFood:{iconSize:1.28},poiShopping:{iconSize:1.25}},
  "lavender-fields":{gardens:{opacity:100},grass:{opacity:97},forests:{opacity:82}},
  "sunset-city":{waterBodies:{opacity:100},poiFood:{opacity:97},gardens:{opacity:94}},
  "midnight-violet":{poiLandmarks:{opacity:99},railways:{width:1.6}},
  "solar-flare":{poiFood:{iconSize:1.28},railways:{opacity:90}}
};
function applyPatches(settings:SemanticStyleSettings,delta:Partial<Record<SemanticFeature,FeaturePatch>>):void{
  for(const key of SEMANTIC_KEYS){
    const patch=delta[key];
    if(patch)settings[key]={...settings[key],...patch,
      zoom:{...settings[key].zoom,...patch.zoom}};
  }
}
/**
 * Build a semantic profile from the selected preset's own colours. Palette
 * reskins supply the same semantic swatches, so no previous theme colours
 * leak into custom palettes or when switching to another preset.
 */
export function getAtlasPresetSemanticSettings(id:string,override:SemanticPaletteOverride={}):SemanticStyleSettings{
  const preset=getAtlasPreset(id),p={...preset.palette,...override};
  const spec=family[preset.family];
  const result=createSemanticFeatureSettings();
  const land=p.land,water=p.water,parks=p.parks,buildings=p.buildings,labels=p.labels;
  const accent=p.poi??p.labels,boundary=p.boundaries??p.labels,transit=p.transit??p.roads;
  const dark=luminance(land)<.24;
  const quiet=dark?.26:.38;
  const fill=(k:SemanticFeature,color:string,opacity:number)=>{
    result[k].color=color;result[k].opacity=opacity;
  };
  const line=(k:SemanticFeature,color:string,opacity:number,width:number)=>{
    fill(k,color,opacity);result[k].width=width;
  };
  fill("buildings",mix(buildings,land,quiet*.25),spec.buildings);
  // The family outline setting is intentional: minimal/nature maps avoid
  // forced building outlines; architectural/utility maps explicitly draw them.
  if(spec.outline)result.buildings.outlineColor=mix(buildings,labels,dark?.30:.17);
  fill("residential",mix(buildings,land,quiet),spec.landuse);
  fill("commercial",mix(buildings,accent,dark?.33:.28),Math.min(100,spec.landuse+7));
  fill("industrial",mix(buildings,labels,dark?.23:.15),Math.max(0,spec.landuse-4));
  fill("parks",parks,spec.nature);
  fill("forests",mix(parks,labels,dark?.24:.19),spec.nature);
  fill("grass",mix(parks,land,dark?.26:.31),Math.max(0,spec.nature-5));
  fill("gardens",mix(parks,accent,dark?.28:.24),Math.min(100,spec.nature+1));
  fill("agriculture",mix(parks,buildings,.42),Math.max(0,spec.nature-15));
  fill("waterBodies",water,spec.water);
  line("rivers",mix(water,labels,dark?.20:.14),spec.rivers,Number((2.05*spec.strokes).toFixed(2)));
  line("streams",mix(water,land,dark?.26:.21),spec.paths,Number((1.1*spec.strokes).toFixed(2)));
  const poiColor:Record<"poiHealth"|"poiEducation"|"poiFood"|"poiShopping"|"poiLandmarks"|"poiTransit",string>={
    poiHealth:mix(accent,labels,.16),poiEducation:mix(p.transit??accent,labels,.24),
    poiFood:mix(accent,buildings,.23),poiShopping:mix(accent,p.parks,.16),
    poiLandmarks:mix(accent,labels,.08),poiTransit:mix(transit,labels,.14)
  };
  // Category-specific label density: transport and healthcare enter earlier
  // than restaurants/retail, while landmarks stay visible for travel maps.
  // Provider layer limits still win; Atlas never fabricates missing POIs.
  const poiOffsets:Record<keyof typeof poiColor,number>={
    poiHealth:-2,poiEducation:0,poiFood:1,poiShopping:2,
    poiLandmarks:preset.family==="travel"?-2:0,poiTransit:-3
  };
  for(const k of Object.keys(poiColor) as (keyof typeof poiColor)[]){
    fill(k,poiColor[k],spec.poi);
    result[k].iconSize=spec.poiScale;
    result[k].zoom.min=Math.max(7,Math.min(19,spec.cityDetail+poiOffsets[k]));
  }
  if(preset.family==="minimal"){
    result.poiFood.visible=false;
    result.poiShopping.visible=false;
    result.poiLandmarks.visible=false;
  }
  const boundaries:Record<"countryBorders"|"regionBorders"|"localBorders",number>={
    countryBorders:1.65,regionBorders:1.05,localBorders:.65
  };
  for(const key of Object.keys(boundaries) as (keyof typeof boundaries)[]){
    const kind=key==="countryBorders"?0:key==="regionBorders"?1:2;
    line(key,mix(boundary,labels,(dark?.16:.12)+kind*.11),
      Math.max(14,spec.boundaries-kind*18),Number((boundaries[key]*spec.strokes).toFixed(2)));
    result[key].dash=spec.boundaryDash;
  }
  line("railways",mix(transit,labels,dark?.16:.12),spec.transit,
    Number((1.45*spec.strokes).toFixed(2)));
  line("terrain",mix(parks,labels,dark?.15:.23),
    Math.max(10,spec.nature-15),Number((.8*spec.strokes).toFixed(2)));
  if(preset.family==="nature")result.terrain.dash="dashed";
  // Give the new category-level zoom editors meaningful defaults without
  // overriding the provider's original zoom bounds or shared road layers.
  const buildingZoom:Record<Family,number>={
    minimal:15,editorial:12,nature:15,travel:13,
    retro:13,futuristic:14,expressive:12,utility:12
  };
  result.buildings.zoom.min=buildingZoom[preset.family];
  result.commercial.zoom.min=preset.family==="utility"?11:preset.family==="minimal"?15:13;
  result.industrial.zoom.min=preset.family==="utility"?12:14;
  result.gardens.zoom.min=preset.family==="nature"||preset.family==="travel"?11:13;
  result.localBorders.zoom.min=preset.family==="editorial"||preset.family==="utility"?8:11;
  result.railways.zoom.min=preset.family==="utility"||preset.family==="futuristic"?9:11;
  if(preset.family==="futuristic"&&dark)result.buildings.heightScale=1.18;
  if(preset.family==="editorial"&&id==="architectural")result.buildings.heightScale=1.15;
  applyPatches(result,named[id]??{});
  return result;
}
