import {
  type AtlasStyleDocument,type JsonRecord,type JsonValue,type StyleLayerDescriptor,
  type LayerOverride,type StyleGroup
} from "./index";

/**
 * Declarative, pure detail controls for MapLibre style documents.
 * No network, renderer or map instance required.
 */
export const ROAD_TIERS=["motorway","primary","secondary","local","paths"] as const;
export type RoadTier=typeof ROAD_TIERS[number];
/**
 * Two mutually exclusive driving-road controls, plus separate non-driving
 * walking/cycling paths. Internal tiers preserve each preset's finer detail.
 * OSM's 'secondary' class is a main-city connector; residential, lanes and
 * tertiary streets belong to the designer's Secondary Roads control.
 */
export const ROAD_CONTROL_GROUPS=["primaryRoads","secondaryRoads","paths"] as const;
export type RoadControlGroup=typeof ROAD_CONTROL_GROUPS[number];
export const ROAD_GROUP_TIERS:Readonly<Record<RoadControlGroup,readonly RoadTier[]>>={
  primaryRoads:["motorway","primary"],
  secondaryRoads:["secondary","local"],
  paths:["paths"]
};
export const ROAD_CLASS_VALUES:Readonly<Record<RoadTier,readonly string[]>>={
  motorway:["motorway","trunk","freeway","motorway_link","trunk_link","expressway"],
  primary:["primary","secondary","primary_link","secondary_link","highway"],
  secondary:["tertiary","tertiary_link","collector"],
  local:["residential","minor","unclassified","living_street","living","street",
    "street_limited","local","service","track"],
  paths:["path","footway","cycleway","pedestrian","steps","trail","bridleway","walkway"]
};
const roadClassToTier=new Map<string,RoadTier>(
  ROAD_TIERS.flatMap(t=>ROAD_CLASS_VALUES[t].map(klass=>[klass,t] as [string,RoadTier]))
);
export function roadTierForClass(klass:string):RoadTier|null{
  return roadClassToTier.get(klass.toLowerCase())??null;
}
export function roadGroupForClass(klass:string):RoadControlGroup|null{
  const tier=roadTierForClass(klass);
  if(!tier)return null;
  return ROAD_CONTROL_GROUPS.find(g=>ROAD_GROUP_TIERS[g].includes(tier))??null;
}
function isProperty(expr:unknown,key:string):boolean {
  return Array.isArray(expr)&&expr[0]==="get"&&expr[1]===key;
}
/**
 * Read positive class restrictions from provider filters. Filters such as
 * brunnel/tunnel geometry/ramp are unrelated and deliberately ignored.
 * Negative filters never imply a positive class list.
 */
export function roadClassesInFilter(filter:unknown):string[]|null {
  if(!Array.isArray(filter))return null;
  const op=filter[0];
  if(op==="all"){
    const scopes=filter.slice(1).map(roadClassesInFilter).filter((x):x is string[]=>x!==null);
    return scopes.length?scopes.reduce((prev,next)=>prev.filter(x=>next.includes(x))):null;
  }
  if(op==="any"){
    const scopes=filter.slice(1).map(roadClassesInFilter);
    return scopes.length&&scopes.every((x):x is string[]=>x!==null)
      ?[...new Set(scopes.flatMap(x=>x??[]))]:null;
  }
  if(op==="=="&&isProperty(filter[1],"class")&&typeof filter[2]==="string")
    return [filter[2]];
  if(op==="=="&&isProperty(filter[2],"class")&&typeof filter[1]==="string")
    return [filter[1]];
  if(op==="match"&&isProperty(filter[1],"class")&&filter.at(-1)===false){
    const values:string[]=[];
    for(let i=2;i+1<filter.length-1;i+=2){
      if(filter[i+1]!==true)continue;
      const input=filter[i] as unknown;
      const labels=Array.isArray(input)?input:[input];
      for(const label of labels)if(typeof label==="string")values.push(label);
    }
    return [...new Set(values)];
  }
  return null;
}
export const DETAIL_FEATURES=[
  "buildings","water","parks","placeLabels","roadLabels","poi","transit","boundaries","terrain"
] as const;
export type DetailFeature=typeof DETAIL_FEATURES[number];
/** null inherits preset visibility; true/false explicitly show/hide. */
export type DetailLevel={visible:boolean|null;opacity:number};
export type MapDetailSettings={
  roads:Record<RoadTier,number>;
  features:Record<DetailFeature,DetailLevel>;
};
export type DetailDensity="full"|"balanced"|"quiet"|"essential";
/**
 * Sparse manual detail edits survive preset changes. Unedited controls
 * always inherit the newly chosen preset's cartographic profile.
 */
export type MapDetailOverrides={
  roads:Partial<Record<RoadTier,number>>;
  features:Partial<Record<DetailFeature,Partial<DetailLevel>>>;
};
export function mergeMapDetailOverrides(
  baseline:MapDetailSettings,overrides:MapDetailOverrides
):MapDetailSettings{
  const result=JSON.parse(JSON.stringify(baseline)) as MapDetailSettings;
  Object.assign(result.roads,overrides.roads);
  for(const key of DETAIL_FEATURES)
    Object.assign(result.features[key],overrides.features[key]??{});
  return result;
}
export function deriveMapDetailOverrides(
  baseline:MapDetailSettings,desired:MapDetailSettings
):MapDetailOverrides{
  const result:MapDetailOverrides={roads:{},features:{}};
  for(const tier of ROAD_TIERS)
    if(desired.roads[tier]!==baseline.roads[tier])
      result.roads[tier]=desired.roads[tier];
  for(const key of DETAIL_FEATURES){
    const old=baseline.features[key],next=desired.features[key];
    const diff:Partial<DetailLevel>={};
    if(old.visible!==next.visible)diff.visible=next.visible;
    if(old.opacity!==next.opacity)diff.opacity=next.opacity;
    if(Object.keys(diff).length)result.features[key]=diff;
  }
  return result;
}

export function createMapDetailSettings(density:DetailDensity="full"):MapDetailSettings{
  const roads=Object.fromEntries(ROAD_TIERS.map(key=>[key,100])) as Record<RoadTier,number>;
  const features=Object.fromEntries(DETAIL_FEATURES.map(key=>[key,{visible:null,opacity:100}])) as Record<DetailFeature,DetailLevel>;
  if(density==="balanced"){
    roads.local=80;roads.paths=65;
    features.poi={visible:null,opacity:65};
    features.buildings={visible:null,opacity:80};
    features.boundaries={visible:null,opacity:65};
  }else if(density==="quiet"){
    roads.secondary=75;roads.local=35;roads.paths=15;
    features.poi={visible:false,opacity:100};
    features.buildings={visible:null,opacity:35};
    features.roadLabels={visible:null,opacity:70};
    features.boundaries={visible:false,opacity:100};
    features.transit={visible:false,opacity:100};
  }else if(density==="essential"){
    roads.secondary=45;roads.local=0;roads.paths=0;
    for(const key of ["poi","buildings","roadLabels","boundaries","transit","terrain"] as const)
      features[key]={visible:false,opacity:100};
    features.parks={visible:null,opacity:60};
  }
  return {roads,features};
}
function safePercent(n:number):number{
  if(!Number.isFinite(n))throw new Error("Opacity must be a finite number.");
  return Math.min(100,Math.max(0,n))/100;
}
function tokenLayer(id:string):string{
  return id.toLowerCase().replace(/([a-z])([A-Z])/g,"$1-$2").replace(/_/g,"-");
}
/**
 * A road layer with several distinct OSM classes must be styled per feature.
 * Source filter constraints outrank names: OpenFreeMap's highway_major_inner
 * includes primary, secondary, tertiary AND trunk, despite the single ID.
 */
export function classifyRoadLayer(layer:StyleLayerDescriptor,baseLayer?:unknown):RoadTier|null{
  if(layer.type!=="line"||layer.suggestedGroup!=="roads")return null;
  const id=tokenLayer(layer.id);
  if(/rail|tram|subway|metro|transit|cablecar|ferry|pier/.test(id))return null;
  const filter=isRecord(baseLayer)?baseLayer.filter:undefined;
  const classes=roadClassesInFilter(filter);
  if(classes!==null){
    const mapped=classes.map(roadTierForClass);
    if(mapped.length===0||mapped.some(t=>t===null))return null;
    return mapped.every(t=>t===mapped[0])?mapped[0]!:null;
  }
  // Names containing mixed category tokens must NEVER be assigned wholesale.
  if(/(?:secondary[-_]tertiary|tertiary[-_]secondary|major|(?:^|-)link(?:$|-))/.test(id))
    return null;
  if(/(?:^|-)(?:motorway|trunk|freeway|expressway)(?:$|-)/.test(id))return "motorway";
  if(/(?:^|-)(?:path|trail|footway|cycleway|pedestrian|steps|walkway)(?:$|-)/.test(id))return "paths";
  if(/(?:^|-)(?:residential|minor|local|living|street|unclassified|service|track)(?:$|-)/.test(id))return "local";
  if(/(?:^|-)(?:tertiary|collector)(?:$|-)/.test(id))return "secondary";
  if(/(?:^|-)(?:primary|secondary)(?:$|-)/.test(id))return "primary";
  return null;
}
/** Class-filtered non-road lines such as piers are not road controls. */
export function isNonRoadLine(layer:StyleLayerDescriptor,baseLayer?:unknown):boolean{
  const id=tokenLayer(layer.id);
  if(/(?:^|-)(?:rail|tram|subway|metro|transit|cablecar|ferry|pier)(?:$|-)/.test(id))return true;
  const classes=roadClassesInFilter(isRecord(baseLayer)?baseLayer.filter:undefined);
  return classes!==null&&classes.every(x=>roadTierForClass(x)===null);
}
export function classifyMapFeature(layer:StyleLayerDescriptor):DetailFeature|null{
  if(layer.type==="background")return null; // Always retain the background.
  const id=tokenLayer(layer.id);
  const src=(layer.sourceLayer??"").toLowerCase().replace(/_/g,"-");
  if(layer.type==="line"&&/rail|tram|subway|metro|transit/.test(id))return "transit";
  if(layer.type==="symbol"){
    if(layer.suggestedGroup==="poi"||/poi|amenity|shop|icon/.test(id)||/poi/.test(src))return "poi";
    if(/road|street|highway|transport|route/.test(id)||/transportation-name|road-name/.test(src))
      return "roadLabels";
    return layer.suggestedGroup==="labels"?"placeLabels":null;
  }
  const group:StyleGroup|null=layer.suggestedGroup;
  if(group==="roads")return null;
  if(group==="buildings"||group==="water"||group==="parks"||group==="poi"||
     group==="transit"||group==="boundaries"||group==="terrain")return group;
  return null;
}
const propertyByType:Record<string,readonly string[]>={
  background:["background-opacity"],fill:["fill-opacity"],line:["line-opacity"],
  symbol:["text-opacity","icon-opacity"],circle:["circle-opacity"],
  raster:["raster-opacity"],"fill-extrusion":["fill-extrusion-opacity"]
};
function isRecord(v:unknown):v is Record<string,unknown>{
  return !!v&&typeof v==="object"&&!Array.isArray(v);
}
/** Original data expressions are retained if no change is requested. */
function underlyingOpacity(
  baseLayer:Record<string,unknown>|undefined,
  doc:AtlasStyleDocument,
  layer:StyleLayerDescriptor,
  property:string
):JsonValue {
  const existing=doc.layers[layer.id]?.paint?.[property];
  const groupOpacity=layer.suggestedGroup?doc.groups[layer.suggestedGroup]?.opacity:undefined;
  const paint=isRecord(baseLayer?.paint)?baseLayer.paint:{};
  const valid=(v:unknown):v is JsonValue=>typeof v==="number"||Array.isArray(v);
  const seed=valid(existing)?existing
    :typeof groupOpacity==="number"?groupOpacity
    :valid(paint[property])?paint[property]:1;
  return JSON.parse(JSON.stringify(seed)) as JsonValue;
}
/**
 * Multiplication is applied inside top-level zoom interpolation/step stops,
 * keeping ["zoom"] in its legal top-level expression position. This retains
 * the provider's zoom-driven visibility instead of flattening it.
 */
function scaleOpacity(base:JsonValue,scale:JsonValue):JsonValue{
  if(typeof scale==="number"&&scale===1)return base;
  if(typeof base==="number"&&typeof scale==="number")
    return Number((base*scale).toFixed(5));
  const zoomInput=Array.isArray(base)?base[base[0]==="step"?1:2]:null;
  if(Array.isArray(base)&&Array.isArray(zoomInput)&&zoomInput[0]==="zoom"){
    if(base[0]==="interpolate"){
      const result:JsonValue[]=base.slice(0,3);
      for(let i=3;i+1<base.length;i+=2)
        result.push(base[i]!,scaleOpacity(base[i+1]!,scale));
      return result;
    }
    if(base[0]==="step"){
      const result:JsonValue[]=base.slice(0,2);
      if(base.length>=3)result.push(scaleOpacity(base[2]!,scale));
      for(let i=3;i+1<base.length;i+=2)
        result.push(base[i]!,scaleOpacity(base[i+1]!,scale));
      return result;
    }
  }
  return ["*",base,scale];
}
function roadOpacityExpression(roads:Record<RoadTier,number>,base:JsonValue):JsonValue{
  const selector:JsonValue=["to-string",["coalesce",["get","class"],["get","highway"],["get","type"],""]];
  const parts:JsonValue[]=[];
  if(typeof base==="number"){
    for(const tier of ROAD_TIERS)
      parts.push([...ROAD_CLASS_VALUES[tier]],Number((base*safePercent(roads[tier])).toFixed(5)));
    // Unknown classes inherit the untouched base style opacity.
    return ["match",selector,...parts,base];
  }
  // If the base opacity is a provider expression, preserve its zoom/function
  // structure by multiplying it by a per-feature road-class factor.
  for(const tier of ROAD_TIERS)
    parts.push([...ROAD_CLASS_VALUES[tier]],safePercent(roads[tier]));
  return scaleOpacity(base,["match",selector,...parts,1]);
}
function copy<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
function baseLayerIndex(baseStyle:unknown):Map<string,Record<string,unknown>>{
  if(!isRecord(baseStyle)||!Array.isArray(baseStyle.layers))return new Map();
  return new Map(baseStyle.layers.filter(isRecord).filter(l=>typeof l.id==="string").map(l=>[l.id as string,l]));
}
/**
 * Layers are exact IDs from the currently loaded provider style. Existing
 * individual layer overrides win for properties NOT touched by a detail control.
 * This generates an ordinary portable v2 style document, not a runtime hook.
 *
 * Detail opacity replaces zoom-dependent opacity expressions when modified;
 * the original is recovered from the base style when returned to 100%.
 */
export function applyMapDetailControls(
  document:AtlasStyleDocument,
  layers:readonly StyleLayerDescriptor[],
  settings:MapDetailSettings,
  baseStyle?:unknown
):AtlasStyleDocument {
  const next=copy(document);
  const originals=baseLayerIndex(baseStyle);
  let changed=0;
  for(const layer of layers){
    if(layer.id.startsWith("atlas-"))continue;
    const feature=classifyMapFeature(layer);
    const road=layer.type==="line"&&layer.suggestedGroup==="roads"&&feature!=="transit";
    if(!road&&!feature)continue;
    const prior:LayerOverride=next.layers[layer.id]??{};
    const override:LayerOverride={...prior,paint:{...prior.paint},layout:{...prior.layout}};
    if(road){
      const base=originals.get(layer.id);
      if(isNonRoadLine(layer,base))continue;
      const direct=classifyRoadLayer(layer,base);
      const hasChange=ROAD_TIERS.some(tier=>settings.roads[tier]!==100);
      if(!hasChange)continue;
      if(direct&&settings.roads[direct]===100)continue;
      const baseOpacity=underlyingOpacity(originals.get(layer.id),next,layer,"line-opacity");
      if(direct){
        override.paint!["line-opacity"]=scaleOpacity(baseOpacity,safePercent(settings.roads[direct]));
      }else{
        // Shared vector road layer. Match actual OSM road class (or highway
        // equivalent) per feature; never fade the entire layer together.
        override.paint!["line-opacity"]=roadOpacityExpression(settings.roads,baseOpacity);
      }
      changed++;
    }else if(feature){
      const level=settings.features[feature];
      if(!level)continue;
      if(level.visible!==null){
        override.layout!.visibility=level.visible?"visible":"none";
        changed++;
      }
      if(level.opacity!==100){
        for(const property of propertyByType[layer.type]??[]){
          const factor=underlyingOpacity(originals.get(layer.id),next,layer,property);
          override.paint![property]=scaleOpacity(factor,safePercent(level.opacity));
          changed++;
        }
      }
    }
    if(Object.keys(override.paint??{}).length===0)delete override.paint;
    if(Object.keys(override.layout??{}).length===0)delete override.layout;
    if(override.paint||override.layout||override.filter!==undefined||override.minzoom!==undefined||override.maxzoom!==undefined)
      next.layers[layer.id]=override;
  }
  if(changed){
    next.metadata={...next.metadata,
      detailControlsVersion:1,
      detailControls:{
        roads:Object.fromEntries(ROAD_TIERS.map(t=>[t,settings.roads[t]])),
        features:Object.fromEntries(DETAIL_FEATURES.map(k=>[k,settings.features[k]]))
      }
    };
  }
  return next;
}
