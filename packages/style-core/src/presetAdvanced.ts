import {getAtlasPreset,type AtlasPresetDefinition} from "./presets";
import {getAtlasPresetDetailSettings} from "./presetDetails";
import {ensureLightRoadContrast,isLightMapSurface} from "./roadLegibility";
import {createAdvancedStyleSettings,LABEL_ROLES,
  type AdvancedStyleSettings,type RoadDesign,type LabelDesign,type ZoomRange,type LabelRole
} from "./advancedStyle";
import {ROAD_TIERS,DETAIL_FEATURES,type RoadTier,type DetailFeature} from "./detailControls";

/** Curated cartographic design profile version 3: road paint, type and zoom. */
export const ATLAS_ADVANCED_PROFILE_VERSION=4 as const;

export type AdvancedPaletteOverrides=Partial<Record<"land"|"roads"|"labels"|"water"|"parks"|"buildings",string>>;
export type AdvancedOverrides={
  roads:Partial<Record<RoadTier,Partial<Omit<RoadDesign,"zoom">>&{zoom?:Partial<ZoomRange>}>>;
  labels:Partial<Record<LabelRole,Partial<Omit<LabelDesign,"zoom">>&{zoom?:Partial<ZoomRange>}>>;
  features:Partial<Record<DetailFeature,Partial<ZoomRange>>>;
};
export function createAdvancedOverrides():AdvancedOverrides {
  return {roads:{},labels:{},features:{}};
}
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const eq=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function mergeAdvancedOverrides(baseline:AdvancedStyleSettings,overrides:AdvancedOverrides):AdvancedStyleSettings {
  const result=clone(baseline);
  for(const tier of ROAD_TIERS){
    const changes=overrides.roads[tier];
    if(changes)result.roads[tier]={...result.roads[tier],...changes,
      zoom:{...result.roads[tier].zoom,...changes.zoom}};
  }
  for(const role of LABEL_ROLES){
    const changes=overrides.labels[role];
    if(changes)result.labels[role]={...result.labels[role],...changes,
      zoom:{...result.labels[role].zoom,...changes.zoom}};
  }
  for(const key of DETAIL_FEATURES)
    if(overrides.features[key])result.features[key]={...result.features[key],...overrides.features[key]};
  return result;
}
export function deriveAdvancedOverrides(baseline:AdvancedStyleSettings,desired:AdvancedStyleSettings):AdvancedOverrides{
  const result=createAdvancedOverrides();
  for(const tier of ROAD_TIERS){
    const from=baseline.roads[tier],to=desired.roads[tier];
    const diff:Partial<RoadDesign>={};
    for(const key of ["color","width","outlineColor","outlineWidth","dash","visible"] as const)
      if(!eq(from[key],to[key]))(diff as Record<string,unknown>)[key]=clone(to[key]);
    const z:Partial<ZoomRange>={};
    if(from.zoom.min!==to.zoom.min)z.min=to.zoom.min;
    if(from.zoom.max!==to.zoom.max)z.max=to.zoom.max;
    if(Object.keys(z).length)diff.zoom=z as ZoomRange;
    if(Object.keys(diff).length)result.roads[tier]=diff;
  }
  for(const role of LABEL_ROLES){
    const from=baseline.labels[role],to=desired.labels[role];
    const diff:Partial<LabelDesign>={};
    for(const key of ["color","sizeScale","spacing","fontStack","visible","outline","halo"] as const)
      if(!eq(from[key],to[key]))(diff as Record<string,unknown>)[key]=clone(to[key]);
    const z:Partial<ZoomRange>={};
    if(from.zoom.min!==to.zoom.min)z.min=to.zoom.min;
    if(from.zoom.max!==to.zoom.max)z.max=to.zoom.max;
    if(Object.keys(z).length)diff.zoom=z as ZoomRange;
    if(Object.keys(diff).length)result.labels[role]=diff;
  }
  for(const key of DETAIL_FEATURES){
    const z:Partial<ZoomRange>={};
    if(baseline.features[key].min!==desired.features[key].min)z.min=desired.features[key].min;
    if(baseline.features[key].max!==desired.features[key].max)z.max=desired.features[key].max;
    if(Object.keys(z).length)result.features[key]=z;
  }
  return result;
}

type Family=AtlasPresetDefinition["family"];
type FamilyShape={
  widths:Record<RoadTier,number>;
  city:number;locality:number;roadText:number;poi:number;
  spacing:number;
  casing:boolean;
  pathDash:boolean;
  zoom:{primary:number;secondary:number;local:number;paths:number;buildings:number;poi:number};
};
const families:Record<Family,FamilyShape>={
  minimal:{widths:{motorway:3,primary:2.25,secondary:1.5,local:.85,paths:.6},
    city:1.05,locality:.92,roadText:.84,poi:.8,spacing:.015,casing:false,pathDash:false,
    zoom:{primary:7,secondary:10,local:13,paths:15,buildings:14,poi:15}},
  editorial:{widths:{motorway:3.6,primary:2.75,secondary:1.9,local:1.2,paths:.85},
    city:1.12,locality:1,roadText:.95,poi:.92,spacing:.025,casing:true,pathDash:false,
    zoom:{primary:6,secondary:9,local:12,paths:14,buildings:13,poi:14}},
  nature:{widths:{motorway:2.25,primary:1.85,secondary:1.4,local:1,paths:1.5},
    city:1.06,locality:.98,roadText:.86,poi:.9,spacing:.015,casing:false,pathDash:true,
    zoom:{primary:7,secondary:9,local:12,paths:11,buildings:15,poi:14}},
  travel:{widths:{motorway:4.2,primary:3.1,secondary:2.3,local:1.45,paths:1},
    city:1.18,locality:1.05,roadText:1.1,poi:1.02,spacing:.012,casing:true,pathDash:false,
    zoom:{primary:6,secondary:9,local:11,paths:13,buildings:13,poi:13}},
  retro:{widths:{motorway:3.7,primary:2.7,secondary:1.75,local:1.1,paths:.8},
    city:1.12,locality:.98,roadText:.95,poi:.85,spacing:.06,casing:true,pathDash:true,
    zoom:{primary:6,secondary:10,local:12,paths:14,buildings:13,poi:14}},
  futuristic:{widths:{motorway:4,primary:2.7,secondary:1.55,local:.75,paths:.5},
    city:1.17,locality:.9,roadText:.86,poi:.85,spacing:.075,casing:false,pathDash:false,
    zoom:{primary:6,secondary:10,local:14,paths:16,buildings:14,poi:16}},
  expressive:{widths:{motorway:3.8,primary:2.8,secondary:2.05,local:1.25,paths:.8},
    city:1.17,locality:1.02,roadText:.96,poi:1.06,spacing:.032,casing:true,pathDash:false,
    zoom:{primary:6,secondary:9,local:12,paths:13,buildings:12,poi:13}},
  utility:{widths:{motorway:4.4,primary:3.4,secondary:2.5,local:1.65,paths:1.15},
    city:1.2,locality:1.08,roadText:1.12,poi:1,spacing:0,casing:true,pathDash:false,
    zoom:{primary:5,secondary:8,local:10,paths:12,buildings:12,poi:12}}
};
type Patch={
  road?:Partial<Record<RoadTier,Partial<RoadDesign>>>;
  label?:Partial<Record<LabelRole,Partial<LabelDesign>>>;
  feature?:Partial<Record<DetailFeature,Partial<ZoomRange>>>;
};
/** Character-defining exceptions layered over the family and detail profile. */
const special:Record<string,Patch>={
  "minimal-light":{road:{local:{width:.7},paths:{width:.5}},label:{poi:{visible:false},city:{spacing:.025}}},
  "minimal-dark":{road:{local:{width:.6},paths:{width:.45}},label:{poi:{visible:false},city:{sizeScale:1.12}}},
  "paper-ink":{road:{primary:{width:2.6},local:{width:1.2}},label:{city:{spacing:.055}}},
  "pastel-city":{road:{local:{width:1.4}},label:{locality:{sizeScale:1.08},poi:{sizeScale:1.08}}},
  "graphite-mono":{road:{local:{width:.6}},label:{road:{sizeScale:.8},poi:{visible:false}}},
  "blueprint":{road:{primary:{width:null},motorway:{width:null},local:{width:.9}},label:{city:{spacing:.08}}},
  "electric-night":{road:{motorway:{width:4.8},primary:{width:3.2}},label:{city:{spacing:.09}}},
  "terra":{road:{paths:{width:1.35}},label:{city:{spacing:.025}}},
  "coastal":{road:{paths:{width:1.1}},label:{city:{sizeScale:1.14}}},
  "high-contrast":{road:{motorway:{width:5},primary:{width:4},secondary:{width:3},local:{width:1.8}},
    label:{city:{sizeScale:1.4},locality:{sizeScale:1.2},road:{sizeScale:1.16},poi:{visible:null}}},
  "snowfall":{road:{local:{width:.6}},label:{city:{spacing:.05}}},
  "linen":{road:{local:{width:.6}},label:{city:{sizeScale:1.15}}},
  "mist":{road:{local:{width:.55},paths:{width:.45}},label:{road:{sizeScale:.72}}},
  "porcelain":{road:{secondary:{width:1.25},local:{width:.55}},label:{city:{sizeScale:1.08}}},
  "architectural":{road:{local:{width:1.45}},feature:{buildings:{min:11}}},
  "old-atlas":{road:{paths:{dash:"dashed"}},label:{city:{spacing:.09}}},
  "cartographer":{road:{paths:{width:1.4}},label:{city:{spacing:.055}}},
  "evergreen":{road:{motorway:{width:1.7},paths:{width:1.8,zoom:{min:10,max:null}}},label:{road:{sizeScale:.78}}},
  "alpine":{road:{paths:{width:1.85,dash:"dashed"}},feature:{terrain:{min:7}}},
  "forest-floor":{road:{paths:{width:1.8}},label:{poi:{visible:false}}},
  "desert-sands":{road:{paths:{width:1.7,dash:"dashed"}},feature:{terrain:{min:7}}},
  "himalayan":{road:{motorway:{width:1.9},paths:{width:2,dash:"dashed"}},feature:{terrain:{min:6}}},
  "sahara-trek":{road:{paths:{width:1.8,dash:"dashed"}}},
  "tokyo-neon":{road:{motorway:{width:4.7},local:{width:1.3}},label:{city:{spacing:.095}}},
  "kyoto-washi":{road:{paths:{width:1.25}},label:{city:{spacing:.05}}},
  "night-editorial":{label:{city:{spacing:.09},road:{sizeScale:.95}}},
  "film-noir":{road:{local:{width:.5},paths:{width:.4}},label:{road:{sizeScale:.75},poi:{visible:false}}},
  "analog-crt":{road:{local:{width:.65}},label:{city:{spacing:.13},road:{sizeScale:.75}}},
  "eighties-grid":{road:{motorway:{width:4.5},local:{width:.5}},label:{city:{spacing:.12}}},
  "terminal":{road:{local:{width:.6}},label:{city:{spacing:.14},road:{sizeScale:.8}}},
  "hologram":{road:{motorway:{width:4.4}},label:{city:{spacing:.12}}},
  "obsidian":{road:{local:{width:.5},paths:{width:.35}},label:{poi:{visible:false}}},
  "data-grid":{road:{secondary:{width:2.6}},label:{road:{sizeScale:1.04}}},
  "circuit-board":{road:{primary:{width:3.6}},label:{city:{spacing:.095}}},
  "navigation":{road:{motorway:{width:5.4},primary:{width:4.1},secondary:{width:3.1},local:{width:2},paths:{width:1.2}},
    label:{road:{sizeScale:1.28},city:{sizeScale:1.15}},feature:{buildings:{min:15}}},
  "transit-map":{road:{motorway:{width:2.2},primary:{width:1.8},secondary:{width:1.25},local:{width:.7}},
    label:{road:{sizeScale:.8}},feature:{transit:{min:7}}},
  "hiking":{road:{motorway:{width:1.5},primary:{width:1.3},local:{width:1},paths:{width:2.1,dash:"dashed",zoom:{min:9,max:null}}},
    label:{road:{sizeScale:.77},poi:{sizeScale:1.14}},feature:{terrain:{min:7}}},
  "cycling":{road:{motorway:{width:1.7},primary:{width:1.6},local:{width:1.85},paths:{width:2.1,dash:"dashed"}},
    label:{road:{sizeScale:1.1}}},
  "emergency":{road:{motorway:{width:5.5},primary:{width:4.2},secondary:{width:3},local:{width:2.2}},
    label:{city:{sizeScale:1.35},road:{sizeScale:1.24}},feature:{buildings:{min:15}}},
  "maritime":{road:{motorway:{width:1.5},primary:{width:1.3},local:{width:.6}},feature:{water:{min:0}}},
  "aviation":{road:{motorway:{width:2},primary:{width:1.5},local:{width:.6}},label:{city:{sizeScale:1.28}}},
  "survey":{road:{primary:{width:2.8},local:{width:1.6},paths:{width:1.3}},feature:{boundaries:{min:5}}},
  "accessibility-light":{road:{motorway:{width:5.3},primary:{width:4.3},local:{width:2}},
    label:{city:{sizeScale:1.4},locality:{sizeScale:1.2},road:{sizeScale:1.25}}},
  "accessibility-dark":{road:{motorway:{width:5.3},primary:{width:4.3},local:{width:2}},
    label:{city:{sizeScale:1.4},locality:{sizeScale:1.2},road:{sizeScale:1.25}}},
  "festival":{road:{local:{width:1.75}},label:{poi:{sizeScale:1.24},city:{sizeScale:1.2}}},
  "synthwave":{road:{motorway:{width:4.8},primary:{width:3.1},local:{width:.85}},label:{city:{spacing:.12}}},
  "cyberpunk":{road:{motorway:{width:5},local:{width:1.1}},label:{city:{spacing:.11}}},
  "solar-flare":{road:{motorway:{width:4.8}},label:{city:{spacing:.095}}},
  "midnight-violet":{road:{local:{width:.75}},label:{city:{spacing:.1}}}
};
function mix(a:string,b:string,fraction:number):string{
  const t=Math.max(0,Math.min(1,fraction));
  const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);
  const result=[16,8,0].map(shift=>{
    const v1=(x>>shift)&255,v2=(y>>shift)&255;
    return Math.round(v1+(v2-v1)*t).toString(16).padStart(2,"0");
  });
  return "#"+result.join("").toUpperCase();
}
function round(v:number,step:number):number{return Math.round(v/step)*step;}
function patch(target:AdvancedStyleSettings,delta:Patch):void{
  for(const [tier,v] of Object.entries(delta.road??{})){
    const key=tier as RoadTier;
    target.roads[key]={...target.roads[key],...v,zoom:{...target.roads[key].zoom,...v.zoom}};
  }
  for(const [role,v] of Object.entries(delta.label??{})){
    const key=role as LabelRole;
    target.labels[key]={...target.labels[key],...v,zoom:{...target.labels[key].zoom,...v.zoom}};
  }
  for(const [feature,v] of Object.entries(delta.feature??{})){
    const key=feature as DetailFeature;
    target.features[key]={...target.features[key],...v};
  }
}
export function getAtlasPresetAdvancedSettings(id:string,paletteOverride:AdvancedPaletteOverrides={}):AdvancedStyleSettings {
  const preset=getAtlasPreset(id);
  const colors={...preset.palette,...paletteOverride};
  const family=families[preset.family],detail=getAtlasPresetDetailSettings(id);
  const result=createAdvancedStyleSettings();
  const tiers:RoadTier[]=[...ROAD_TIERS];
  for(const [index,tier] of tiers.entries()){
    const info=detail.roads[tier];
    const item=result.roads[tier];
    const blend=index===0?.08:index===1?.12:index===2?.24:index===3?.36:.47;
    const proposed=mix(colors.roads,colors.land,blend+(100-info)/600);
    const light=isLightMapSurface(colors.land);
    // Important: test contrast after transparency, not just the base swatch.
    // Previously near-white roads disappeared against near-white land.
    // Preserve the themed hue while drawing it toward readable ink.
    const effectiveOpacity=info/100*(preset.settings?.roadsOpacity??1);
    item.color=ensureLightRoadContrast(
      proposed,colors.land,colors.labels,effectiveOpacity,tier
    );
    // Width has a cap but responds to the preset's own curated emphasis.
    item.width=round(family.widths[tier]*(0.88+info/750),.05);
    if(light){
      // Subpixel strokes are practically invisible on 1x screens, even with
      // improved colour. Strengthen the footprint without making the map bold.
      const minimum=[3,2.25,1.65,1.05,.85][index]!;
      item.width=Math.max(item.width,minimum);
    }
    if(family.casing&&index<3){
      item.outlineColor=mix(colors.land,colors.labels,light?.43:.22);
      item.outlineWidth=round(item.width+(light?.9:1.15),.05);
    }
    if(tier==="paths"&&family.pathDash)item.dash="dashed";
  }
  const z=family.zoom;
  result.roads.primary.zoom.min=z.primary;
  result.roads.secondary.zoom.min=detail.roads.secondary<=60?z.secondary+1:z.secondary;
  result.roads.local.zoom.min=detail.roads.local<=30?z.local+2:
    detail.roads.local<=60?z.local+1:z.local;
  result.roads.paths.zoom.min=detail.roads.paths<=30?z.paths+1:z.paths;
  result.roads.motorway.zoom.min=5;
  if(isLightMapSurface(colors.land)){
    // Normal city zoom should already show the connecting street network.
    // More granular paths still enter later to protect map density.
    result.roads.primary.zoom.min=Math.min(result.roads.primary.zoom.min??7,7);
    result.roads.secondary.zoom.min=Math.min(result.roads.secondary.zoom.min??9,9);
    result.roads.local.zoom.min=Math.min(result.roads.local.zoom.min??12,12);
    result.roads.paths.zoom.min=Math.min(result.roads.paths.zoom.min??14,14);
  }
  const baseSize:Record<LabelRole,number>={
    city:family.city,locality:family.locality,road:family.roadText,poi:family.poi
  };
  for(const role of LABEL_ROLES){
    const item=result.labels[role];
    item.sizeScale=baseSize[role];
    item.color=role==="city"?colors.labels:
      mix(colors.labels,colors.land,role==="road"?.18:role==="poi"?.13:.10);
    item.spacing=role==="city"?family.spacing:
      role==="locality"?round(family.spacing*.5,.005):null;
    // The theme's typography now owns its outline/halo aesthetic.
    // Keep Tokyo Neon's original halo behavior from the requested revert.
    if(id!=="tokyo-neon"){
      const crisp=["editorial","travel","retro","utility"].includes(preset.family)||
        preset.family==="expressive"&&id!=="electric-night";
      const glow=preset.family==="futuristic"||
        preset.family==="expressive"&&isLightMapSurface(colors.land)===false;
      item.outline=crisp;
      item.halo=glow&&(role==="city"||role==="locality"||role==="road");
      if(preset.family==="minimal"||preset.family==="nature"){
        item.outline=false;item.halo=false;
      }
      if(id==="blueprint"){item.outline=true;item.halo=false;}
      if(id==="high-contrast"||id==="accessibility-dark"||id==="accessibility-light"){
        item.outline=true;item.halo=false;
      }
    }
  }
  result.labels.city.zoom.min=5;
  result.labels.locality.zoom.min=preset.family==="minimal"?11:9;
  result.labels.road.zoom.min=preset.family==="futuristic"?13:11;
  result.labels.poi.zoom.min=detail.features.poi.opacity<=65?15:z.poi;
  result.features.buildings.min=detail.features.buildings.opacity<=35?z.buildings+1:z.buildings;
  result.features.poi.min=z.poi;
  result.features.roadLabels.min=10;
  result.features.boundaries.min=preset.family==="minimal"?7:5;
  result.features.terrain.min=preset.family==="nature"?7:9;
  const specific=special[id];
  if(specific)patch(result,specific);
  if(isLightMapSurface(colors.land)){
    // Preset-specific width reductions still need to remain visible.
    const minimum:Record<RoadTier,number>={motorway:3,primary:2.25,secondary:1.65,local:1.05,paths:.85};
    for(const tier of ROAD_TIERS){
      const row=result.roads[tier];
      if(row.width!==null)row.width=Math.max(row.width,minimum[tier]);
      if(row.zoom.min!==null){
        const cap:Record<RoadTier,number>={motorway:5,primary:7,secondary:9,local:12,paths:14};
        row.zoom.min=Math.min(row.zoom.min,cap[tier]);
      }
    }
  }
  return result;
}
