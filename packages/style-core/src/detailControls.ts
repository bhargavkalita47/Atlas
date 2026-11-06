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
export const DETAIL_FEATURES=[
  "buildings","water","parks","placeLabels","roadLabels","poi","transit","boundaries","terrain"
] as const;
export type DetailFeature=typeof DETAIL_FEATURES[number];
export type DetailLevel={visible:boolean;opacity:number};
export type MapDetailSettings={
  roads:Record<RoadTier,number>;
  features:Record<DetailFeature,DetailLevel>;
};
export type DetailDensity="full"|"balanced"|"quiet"|"essential";
export function createMapDetailSettings(density:DetailDensity="full"):MapDetailSettings{
  const roads=Object.fromEntries(ROAD_TIERS.map(key=>[key,100])) as Record<RoadTier,number>;
  const features=Object.fromEntries(DETAIL_FEATURES.map(key=>[key,{visible:true,opacity:100}])) as Record<DetailFeature,DetailLevel>;
  if(density==="balanced"){
    roads.local=80;roads.paths=65;
    features.poi={visible:true,opacity:65};
    features.buildings={visible:true,opacity:80};
    features.boundaries={visible:true,opacity:65};
  }else if(density==="quiet"){
    roads.secondary=75;roads.local=35;roads.paths=15;
    features.poi={visible:false,opacity:100};
    features.buildings={visible:true,opacity:35};
    features.roadLabels={visible:true,opacity:70};
    features.boundaries={visible:false,opacity:100};
    features.transit={visible:false,opacity:100};
  }else if(density==="essential"){
    roads.secondary=45;roads.local=0;roads.paths=0;
    for(const key of ["poi","buildings","roadLabels","boundaries","transit","terrain"] as const)
      features[key]={visible:false,opacity:100};
    features.parks={visible:true,opacity:60};
  }
  return {roads,features};
}
const hex=(value:unknown):value is string=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value);
function safePercent(n:number):number{
  if(!Number.isFinite(n))throw new Error("Opacity must be a finite number.");
  return Math.min(100,Math.max(0,n))/100;
}
function tokenLayer(id:string):string{
  return id.toLowerCase().replace(/([a-z])([A-Z])/g,"$1-$2").replace(/_/g,"-");
}
/** A definite classification in the layer ID is safer than guessing feature data. */
export function classifyRoadLayer(layer:StyleLayerDescriptor):RoadTier|null{
  if(layer.type!=="line"||layer.suggestedGroup!=="roads")return null;
  const id=tokenLayer(layer.id);
  if(/(?:^|[- ])(?:motorway|trunk|freeway|expressway)(?:$|[- ])/.test(id))return "motorway";
  if(/(?:^|[- ])(?:primary|highway|major)(?:$|[- ])/.test(id))return "primary";
  if(/(?:^|[- ])(?:secondary|tertiary|collector)(?:$|[- ])/.test(id))return "secondary";
  if(/(?:^|[- ])(?:service|track|path|trail|footway|cycleway|pedestrian|steps|walkway)(?:$|[- ])/.test(id))return "paths";
  if(/(?:^|[- ])(?:residential|minor|local|living|street|unclassified)(?:$|[- ])/.test(id))return "local";
  return null;
}
function featureFor(layer:StyleLayerDescriptor):DetailFeature|null{
  if(layer.type==="background")return null; // Always retain the background.
  const id=tokenLayer(layer.id);
  const src=(layer.sourceLayer??"").toLowerCase().replace(/_/g,"-");
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
):number {
  const existing=doc.layers[layer.id]?.paint?.[property];
  const groupOpacity=layer.suggestedGroup?doc.groups[layer.suggestedGroup]?.opacity:undefined;
  const paint=isRecord(baseLayer?.paint)?baseLayer.paint:{};
  const seed=typeof existing==="number"?existing
    :typeof groupOpacity==="number"?groupOpacity
    :typeof paint[property]==="number"?paint[property]:1;
  return Math.min(1,Math.max(0,seed));
}
const roadValues:Readonly<Record<RoadTier,readonly string[]>>={
  motorway:["motorway","trunk","freeway","motorway_link","trunk_link","expressway"],
  primary:["primary","primary_link","highway"],
  secondary:["secondary","tertiary","secondary_link","tertiary_link","collector"],
  local:["residential","minor","unclassified","living_street","living","street","local"],
  paths:["service","track","path","footway","cycleway","pedestrian","steps","trail","bridleway"]
};
function roadOpacityExpression(roads:Record<RoadTier,number>,base:number):JsonValue{
  const selectors:JsonValue[]=[];
  for(const tier of ROAD_TIERS)selectors.push([...roadValues[tier]],Number((base*safePercent(roads[tier])).toFixed(4)));
  // Unknown feature classes retain their original, category-wide opacity.
  return ["match",
    ["to-string",["coalesce",["get","class"],["get","highway"],["get","type"],""]],
    ...selectors,base
  ] as JsonValue;
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
    const road=layer.type==="line"&&layer.suggestedGroup==="roads";
    const feature=featureFor(layer);
    if(!road&&!feature)continue;
    const prior:LayerOverride=next.layers[layer.id]??{};
    const override:LayerOverride={...prior,paint:{...prior.paint},layout:{...prior.layout}};
    if(road){
      const direct=classifyRoadLayer(layer);
      const hasChange=ROAD_TIERS.some(tier=>settings.roads[tier]!==100);
      if(!hasChange)continue;
      const baseOpacity=underlyingOpacity(originals.get(layer.id),next,layer,"line-opacity");
      if(direct){
        override.paint!["line-opacity"]=Number((baseOpacity*safePercent(settings.roads[direct])).toFixed(4));
      }else{
        // Shared vector road layer. Match actual OSM road class (or highway
        // equivalent) per feature; never fade the entire layer together.
        override.paint!["line-opacity"]=roadOpacityExpression(settings.roads,baseOpacity);
      }
      changed++;
    }else if(feature){
      const level=settings.features[feature];
      if(!level)continue;
      if(!level.visible){
        override.layout!.visibility="none";
        changed++;
      }
      if(level.opacity!==100){
        for(const property of propertyByType[layer.type]??[]){
          const factor=underlyingOpacity(originals.get(layer.id),next,layer,property);
          override.paint![property]=Number((factor*safePercent(level.opacity)).toFixed(4));
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
