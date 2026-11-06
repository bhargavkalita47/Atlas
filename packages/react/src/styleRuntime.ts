import type {Map as MapLibreMap} from "maplibre-gl";
import {
  compileAtlasStyle,inspectStyleLayers,type AtlasStyleDocument,
  type JsonRecord,type StyleDiagnostic,type StyleLayerDescriptor,
} from "@atlas/style-core";

/**
 * Maps one Atlas document onto an already loaded MapLibre style using only
 * affected paint/layout/filter/zoom properties. Does not call setStyle, re-add
 * sources, mutate app-owned overlays, reconstruct the map or touch its camera.
 *
 * The baseStyle snapshot MUST be captured at style.load before Atlas overlays.
 * previousStyle is either that snapshot or the last applied compiler output.
 */
export interface RuntimeApplyResult {
  appliedStyle: JsonRecord;
  diagnostics: StyleDiagnostic[];
  propertyChanges: number;
}
type Layer = Record<string,unknown>;
const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const indexLayers=(style:unknown):Map<string,Layer>=>{
  if(!isRecord(style)||!Array.isArray(style.layers))return new Map();
  return new Map(style.layers.filter(isRecord).filter(l=>typeof l.id==="string").map(l=>[l.id as string,l]));
};
export function editableLayerInventory(style:unknown):StyleLayerDescriptor[]{
  return inspectStyleLayers(style).filter(layer=>!layer.id.startsWith("atlas-"));
}
export function applyAtlasStyleDocument(
  map:Pick<MapLibreMap,"setPaintProperty"|"setLayoutProperty"|"setFilter"|"setLayerZoomRange"|"getStyle">,
  baseStyle:unknown,
  document:AtlasStyleDocument,
  previousStyle:unknown=baseStyle,
):RuntimeApplyResult{
  const result=compileAtlasStyle(baseStyle,document);
  const prior=indexLayers(previousStyle);
  const next=indexLayers(result.style);
  let changes=0;
  let failed=false;
  // Preserve MapLibre's natural layer ordering. A future reordering feature
  // will be a separately validated transaction, not an accidental side effect.
  for(const [id,layer] of next){
    const old=prior.get(id);
    if(!old)continue;
    for(const slot of ["paint","layout"] as const){
      const prevProps=isRecord(old[slot])?old[slot]:{};
      const nextProps=isRecord(layer[slot])?layer[slot]:{};
      const keys=new Set([...Object.keys(prevProps),...Object.keys(nextProps)]);
      for(const prop of keys){
        if(equal(prevProps[prop],nextProps[prop]))continue;
        try{
          const value=nextProps[prop]===undefined?null:nextProps[prop];
          if(slot==="paint")map.setPaintProperty(id,prop as Parameters<MapLibreMap["setPaintProperty"]>[1],value as Parameters<MapLibreMap["setPaintProperty"]>[2]);
          else map.setLayoutProperty(id,prop as Parameters<MapLibreMap["setLayoutProperty"]>[1],value as Parameters<MapLibreMap["setLayoutProperty"]>[2]);
          changes++;
        }catch(err){
          failed=true;
          result.diagnostics.push({severity:"warning",code:"PATCH_REJECTED",
            path:id+"."+slot+"."+prop,message:err instanceof Error?err.message:String(err)});
        }
      }
    }
    if(!equal(old.filter,layer.filter)){
      try{
        map.setFilter(id,(layer.filter??null) as Parameters<MapLibreMap["setFilter"]>[1]);
        changes++;
      }catch(err){failed=true;result.diagnostics.push({severity:"warning",code:"FILTER_REJECTED",path:id+".filter",message:String(err)});}
    }
    if(!equal(old.minzoom,layer.minzoom)||!equal(old.maxzoom,layer.maxzoom)){
      try{
        map.setLayerZoomRange(id,typeof layer.minzoom==="number"?layer.minzoom:0,
          typeof layer.maxzoom==="number"?layer.maxzoom:24);
        changes++;
      }catch(err){failed=true;result.diagnostics.push({severity:"warning",code:"ZOOM_REJECTED",path:id+".zoom",message:String(err)});}
    }
  }
  // If MapLibre rejects a property, read back its actual state so the next
  // transaction does not assume an unsuccessful patch was applied.
  return {appliedStyle:failed?map.getStyle() as unknown as JsonRecord:result.style,
    diagnostics:result.diagnostics,propertyChanges:changes};
}
