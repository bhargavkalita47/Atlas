import {validateStyleDocument,type AtlasStyleDocument} from "./index";
import type {MapDetailOverrides} from "./detailControls";
import type {AdvancedOverrides} from "./presetAdvanced";
import type {SemanticOverrides} from "./presetSemantic";
import {ATLAS_STYLE_PRESETS} from "./presets";
import {ROAD_TIERS,DETAIL_FEATURES} from "./detailControls";
import {LABEL_ROLES} from "./advancedStyle";
import {SEMANTIC_KEYS} from "./semanticFeatures";

/**
 * Portable Atlas Lab customization preset, not a tile dataset or a precompiled
 * provider-specific MapLibre style. Integrators can reapply this recipe to the
 * matching Atlas base provider and keep all editing controls functional.
 */
export const ATLAS_THEME_BUNDLE_VERSION=1 as const;
export const ATLAS_VECTOR_BASES=["positron","liberty","bright","dark"] as const;
export type AtlasVectorBase=typeof ATLAS_VECTOR_BASES[number];
export interface AtlasThemeBundle {
  format:"atlas-theme";
  schemaVersion:typeof ATLAS_THEME_BUNDLE_VERSION;
  styleDocumentVersion:2;
  presetId:string;
  vectorStyle:AtlasVectorBase;
  document:AtlasStyleDocument;
  customPalette:string[]|null;
  detailOverrides:MapDetailOverrides;
  advancedOverrides:AdvancedOverrides;
  semanticOverrides:SemanticOverrides;
  view?:{center:{lat:number;lng:number};zoom:number};
}
export type AtlasThemeBundleInput=Omit<AtlasThemeBundle,"format"|"schemaVersion"|"styleDocumentVersion">;

const isRecord=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const isHex=(v:unknown):v is string=>typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v);
const known=(value:string,options:readonly string[])=>options.includes(value);
const safeKeys=(value:unknown,depth=0):boolean=>{
  if(depth>30)return false;
  if(Array.isArray(value))return value.length<=10000&&value.every(item=>safeKeys(item,depth+1));
  if(isRecord(value))return Object.entries(value).length<=10000&&Object.entries(value).every(([key,item])=>
    key!=="__proto__"&&key!=="constructor"&&key!=="prototype"&&key.length<=256&&safeKeys(item,depth+1));
  return value===null||typeof value==="boolean"||(typeof value==="number"&&Number.isFinite(value))||
    (typeof value==="string"&&value.length<=10000);
};
const allowedKeys=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).every(k=>keys.includes(k));
const objectKeys=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>isRecord(v)&&allowedKeys(v,keys);
const isPercent=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100;
const isZoom=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=24;
const isZoomOrNull=(v:unknown)=>v===null||isZoom(v);
const isHexOrNull=(v:unknown)=>v===null||isHex(v);
function checkOverrides(bundle:Record<string,unknown>):boolean{
  const detail=bundle.detailOverrides;
  if(!objectKeys(detail,["roads","features"])||
    !objectKeys(detail.roads,ROAD_TIERS)||
    !objectKeys(detail.features,DETAIL_FEATURES))return false;
  if(Object.values(detail.roads).some(v=>!isPercent(v)))return false;
  if(Object.values(detail.features).some(v=>
    !objectKeys(v,["visible","opacity"])||
    (v.visible!==undefined&&v.visible!==null&&typeof v.visible!=="boolean")||
    (v.opacity!==undefined&&!isPercent(v.opacity))))return false;

  const advanced=bundle.advancedOverrides;
  if(!objectKeys(advanced,["roads","labels","features"])||
    !objectKeys(advanced.roads,ROAD_TIERS)||
    !objectKeys(advanced.labels,LABEL_ROLES)||
    !objectKeys(advanced.features,DETAIL_FEATURES))return false;
  const roadKeys=["color","width","outlineColor","outlineWidth","dash","visible","zoom"];
  const labelKeys=["color","sizeScale","spacing","fontStack","visible","outline","halo","zoom"];
  for(const [kind,items,keys] of [
    ["roads",advanced.roads,roadKeys],
    ["labels",advanced.labels,labelKeys],
    ["features",advanced.features,["min","max"]]
  ] as const){
    for(const v of Object.values(items)){
      if(!objectKeys(v,keys))return false;
      if(kind==="features"&&Object.values(v).some(x=>!isZoomOrNull(x)))return false;
      if(kind!=="features"){
        if(v.zoom!==undefined&&(!objectKeys(v.zoom,["min","max"])||Object.values(v.zoom).some(x=>!isZoomOrNull(x))))return false;
        if(v.color!==undefined&&!isHexOrNull(v.color))return false;
        if(v.outlineColor!==undefined&&!isHexOrNull(v.outlineColor))return false;
        if(v.visible!==undefined&&v.visible!==null&&typeof v.visible!=="boolean")return false;
        if(v.fontStack!==undefined&&v.fontStack!==null&&(!Array.isArray(v.fontStack)||v.fontStack.some(x=>typeof x!=="string"||x.length>256)))return false;
      }
    }
  }
  const semantic=bundle.semanticOverrides;
  if(!objectKeys(semantic,SEMANTIC_KEYS))return false;
  for(const v of Object.values(semantic)){
    if(!objectKeys(v,["color","opacity","visible","width","outlineColor","dash","iconSize","heightScale","zoom"]))return false;
    if(v.color!==undefined&&!isHex(v.color))return false;
    if(v.outlineColor!==undefined&&!isHex(v.outlineColor))return false;
    if(v.visible!==undefined&&typeof v.visible!=="boolean")return false;
    if(v.zoom!==undefined&&(!objectKeys(v.zoom,["min","max"])||Object.values(v.zoom).some(x=>!isZoom(x))))return false;
  }
  return true;
}
export function validateAtlasThemeBundle(value:unknown):string[]{
  if(!isRecord(value))return ["Expected a JSON object."];
  const errors:string[]=[];
  if(!allowedKeys(value,["format","schemaVersion","styleDocumentVersion","presetId","vectorStyle","document","customPalette","detailOverrides","advancedOverrides","semanticOverrides","view"]))
    errors.push("Unrecognized top-level fields.");
  if(value.format!=="atlas-theme"||value.schemaVersion!==1||value.styleDocumentVersion!==2)
    errors.push("Unsupported Atlas theme export version.");
  if(typeof value.presetId!=="string"||!ATLAS_STYLE_PRESETS.some(p=>p.id===value.presetId))
    errors.push("Unknown Atlas preset.");
  if(typeof value.vectorStyle!=="string"||!known(value.vectorStyle,ATLAS_VECTOR_BASES))
    errors.push("Unknown Atlas vector base.");
  if(!safeKeys(value))errors.push("Invalid or unsafe JSON values.");
  if(value.customPalette!==null && (!Array.isArray(value.customPalette)||
     value.customPalette.length<4||value.customPalette.length>6||!value.customPalette.every(isHex)))
    errors.push("Palette must contain four to six hex colors or null.");
  if(validateStyleDocument(value.document).some(d=>d.severity==="error"))
    errors.push("Invalid Atlas style document.");
  if(!checkOverrides(value))errors.push("Invalid or unknown style control overrides.");
  if(value.view!==undefined){
    const v=value.view;
    if(!objectKeys(v,["center","zoom"])||!objectKeys(v.center,["lat","lng"])||
       typeof v.center.lat!=="number"||v.center.lat < -90||v.center.lat > 90||
       typeof v.center.lng!=="number"||v.center.lng < -180||v.center.lng > 180||
       typeof v.zoom!=="number"||v.zoom<0||v.zoom>24)
      errors.push("Invalid map view.");
  }
  if(isRecord(value.document)&&typeof value.vectorStyle==="string"&&value.document.baseStyle!==value.vectorStyle)
    errors.push("Style document baseStyle must match the selected vector base.");
  return errors;
}
export function createAtlasThemeBundle(input:AtlasThemeBundleInput):AtlasThemeBundle{
  const bundle:AtlasThemeBundle={
    format:"atlas-theme",schemaVersion:1,styleDocumentVersion:2,
    ...(JSON.parse(JSON.stringify(input)) as AtlasThemeBundleInput)
  };
  const errors=validateAtlasThemeBundle(bundle);
  if(errors.length)throw new Error(errors.join(" "));
  return bundle;
}
export function parseAtlasThemeBundle(raw:string):AtlasThemeBundle{
  if(raw.length>2_000_000)throw new Error("Theme file exceeds the 2 MB limit.");
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw new Error("Theme file is not valid JSON.");}
  const errors=validateAtlasThemeBundle(value);
  if(errors.length)throw new Error(errors.join(" "));
  return value as AtlasThemeBundle;
}
export function stringifyAtlasThemeBundle(bundle:AtlasThemeBundle):string{
  const errors=validateAtlasThemeBundle(bundle);
  if(errors.length)throw new Error(errors.join(" "));
  return JSON.stringify(bundle,null,2)+"\n";
}
