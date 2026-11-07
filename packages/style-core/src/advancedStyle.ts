import type {AtlasStyleDocument,JsonValue,LayerOverride,StyleLayerDescriptor} from "./index";
import {ROAD_TIERS,ROAD_CLASS_VALUES,DETAIL_FEATURES,classifyRoadLayer,isNonRoadLine,classifyMapFeature,type RoadTier,type DetailFeature} from "./detailControls";

/** Atlas authoring controls, separate from renderer, tile provider and runtime. */
export const LABEL_ROLES=["city","locality","road","poi"] as const;
export type LabelRole=typeof LABEL_ROLES[number];
export type RoadDash="inherit"|"solid"|"dashed";
export type ZoomRange={min:number|null;max:number|null};
export type RoadDesign={
  color:string|null; width:number|null; outlineColor:string|null;
  outlineWidth:number|null; dash:RoadDash; visible:boolean|null;
  zoom:ZoomRange;
};
export type LabelDesign={
  color:string|null; sizeScale:number|null; spacing:number|null;
  fontStack:string[]|null; visible:boolean|null;
  outline:boolean|null; halo:boolean|null; zoom:ZoomRange;
};
export type AdvancedStyleSettings={
  roads:Record<RoadTier,RoadDesign>;
  labels:Record<LabelRole,LabelDesign>;
  features:Record<DetailFeature,ZoomRange>;
};
export function createAdvancedStyleSettings():AdvancedStyleSettings {
  const range=():ZoomRange=>({min:null,max:null});
  return {
    roads:Object.fromEntries(ROAD_TIERS.map(k=>[k,{
      color:null,width:null,outlineColor:null,outlineWidth:null,
      dash:"inherit",visible:null,zoom:range()
    }])) as Record<RoadTier,RoadDesign>,
    labels:Object.fromEntries(LABEL_ROLES.map(k=>[k,{
      color:null,sizeScale:null,spacing:null,fontStack:null,
      visible:null,outline:null,halo:null,zoom:range()
    }])) as Record<LabelRole,LabelDesign>,
    features:Object.fromEntries(DETAIL_FEATURES.map(k=>[k,range()])) as Record<DetailFeature,ZoomRange>
  };
}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const isColor=(v:unknown):v is string=>typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v);
const finite=(n:number,min:number,max:number)=>Number.isFinite(n)&&n>=min&&n<=max;
const token=(id:string)=>id.toLowerCase().replace(/_/g,"-");
const casing=(l:StyleLayerDescriptor)=>/(?:casing|outline|border)/.test(token(l.id));
const roadSelector:JsonValue=["to-string",["coalesce",["get","class"],["get","highway"],["get","type"],""]];
const zoomExpr=(v:unknown):v is JsonValue[]=>
  Array.isArray(v)&&((v[0]==="interpolate"&&Array.isArray(v[2])&&v[2][0]==="zoom")||
    (v[0]==="step"&&Array.isArray(v[1])&&v[1][0]==="zoom"));
/** Keep zoom at the top level of MapLibre paint expressions. */
function onZoomOutputs(base:JsonValue,fn:(output:JsonValue)=>JsonValue):JsonValue {
  if(!zoomExpr(base))return fn(base);
  if(base[0]==="interpolate"){
    const out:JsonValue[]=base.slice(0,3);
    for(let i=3;i<base.length;i+=2){out.push(base[i]!);out.push(fn(base[i+1]!));}
    return out;
  }
  const out:JsonValue[]=base.slice(0,2);
  out.push(fn(base[2]!));
  for(let i=3;i<base.length;i+=2){out.push(base[i]!);out.push(fn(base[i+1]!));}
  return out;
}
function matchRoad<T extends JsonValue>(
  original:JsonValue,choose:(tier:RoadTier,originalStop:JsonValue)=>T|null
):JsonValue {
  return onZoomOutputs(original,stop=>{
    const entries:JsonValue[]=[];
    for(const tier of ROAD_TIERS){
      const value=choose(tier,stop);
      if(value!==null)entries.push([...ROAD_CLASS_VALUES[tier]],value);
    }
    return entries.length?["match",roadSelector,...entries,stop]:stop;
  });
}
function sourceValue(
  doc:AtlasStyleDocument,base:Record<string,unknown>|undefined,
  layer:StyleLayerDescriptor,slot:"paint"|"layout",key:string,otherwise:JsonValue
):JsonValue {
  const written=doc.layers[layer.id]?.[slot]?.[key];
  if(written!==undefined)return copy(written);
  if(slot==="paint"){
    const group=layer.suggestedGroup?doc.groups[layer.suggestedGroup]:undefined;
    if(key==="line-color"&&group?.color)return group.color;
    if(key==="text-color"&&group?.color)return group.color;
  }
  const obj=base?.[slot];
  if(record(obj)&&obj[key]!==undefined)return copy(obj[key]) as JsonValue;
  return otherwise;
}
function put(doc:AtlasStyleDocument,id:string,slot:"paint"|"layout",key:string,value:JsonValue):void{
  const old:LayerOverride=doc.layers[id]??{};
  doc.layers[id]={...old,[slot]:{...(old[slot]??{}),[key]:value}};
}
function layerIndex(baseStyle:unknown):Map<string,Record<string,unknown>>{
  if(!record(baseStyle)||!Array.isArray(baseStyle.layers))return new Map();
  return new Map(baseStyle.layers.filter(record).filter(l=>typeof l.id==="string").map(l=>[l.id as string,l]));
}
function applyZoom(doc:AtlasStyleDocument,id:string,base:Record<string,unknown>|undefined,zoom:ZoomRange):void {
  if(zoom.min===null&&zoom.max===null)return;
  const originalMin=typeof base?.minzoom==="number"?base.minzoom:0;
  const originalMax=typeof base?.maxzoom==="number"?base.maxzoom:24;
  const min=zoom.min===null?originalMin:Math.max(originalMin,zoom.min);
  const max=zoom.max===null?originalMax:Math.min(originalMax,zoom.max);
  if(!finite(min,0,24)||!finite(max,0,24)||min>=max)return;
  const previous=doc.layers[id]??{};
  doc.layers[id]={...previous,minzoom:min,maxzoom:max};
}
/**
 * Source style layer IDs are heuristic. Never class SVG/UI overlays as roads.
 * Symbol glyph presence is checked from the real style when available.
 */
export function classifyLabelRole(layer:StyleLayerDescriptor,baseLayer?:Record<string,unknown>):LabelRole|null{
  if(layer.type!=="symbol"||layer.id.startsWith("atlas-"))return null;
  const layout=baseLayer?.layout;
  if(record(layout)&&layout["text-field"]===undefined)return null;
  const id=token(layer.id),src=token(layer.sourceLayer??"");
  if(layer.suggestedGroup==="poi"||/poi|amenity|shop/.test(id)||/poi/.test(src))return "poi";
  if(/road|street|highway|route|transportation-name/.test(id)||/road|transportation-name/.test(src))return "road";
  if(/city|capital|town|state|country|nation|province/.test(id))return "city";
  if(/suburb|locality|neighbo[u]?rhood|village|hamlet|district|quarter/.test(id))return "locality";
  if(layer.suggestedGroup==="labels"||/place/.test(src))return "locality";
  return null;
}
export function availableProviderFonts(baseStyle:unknown):string[][]{
  const result:string[][]=[];const seen=new Set<string>();
  for(const layer of layerIndex(baseStyle).values()){
    if(layer.type!=="symbol")continue;
    const layout=record(layer.layout)?layer.layout:{};
    if(!Array.isArray(layout["text-font"]))continue;
    const fonts=layout["text-font"];
    if(!fonts.length||!fonts.every(x=>typeof x==="string"&&x.length>0))continue;
    const key=JSON.stringify(fonts);
    if(!seen.has(key)){seen.add(key);result.push(fonts as string[]);}
  }
  return result;
}
function validZoomRange(z:ZoomRange):boolean{
  return (z.min===null||finite(z.min,0,22))&&(z.max===null||finite(z.max,1,24))&&
    (z.min===null||z.max===null||z.min<z.max);
}
export function validateAdvancedStyleSettings(settings:AdvancedStyleSettings):string[]{
  const errors:string[]=[];
  for(const tier of ROAD_TIERS){
    const s=settings.roads[tier];
    if((s.color!==null&&!isColor(s.color))||(s.outlineColor!==null&&!isColor(s.outlineColor)))errors.push(tier+": invalid road color");
    if((s.width!==null&&!finite(s.width,.25,24))||(s.outlineWidth!==null&&!finite(s.outlineWidth,.25,32)))errors.push(tier+": invalid road width");
    if(!["inherit","solid","dashed"].includes(s.dash)||!validZoomRange(s.zoom))errors.push(tier+": invalid dash or zoom");
  }
  for(const role of LABEL_ROLES){
    const s=settings.labels[role];
    if(s.color!==null&&!isColor(s.color))errors.push(role+": invalid label color");
    if((s.sizeScale!==null&&!finite(s.sizeScale,.5,2.5))||(s.spacing!==null&&!finite(s.spacing,-.1,.4)))errors.push(role+": invalid label size/spacing");
    if(s.fontStack!==null&&(!s.fontStack.length||!s.fontStack.every(x=>typeof x==="string"&&x.length<128)))errors.push(role+": invalid font stack");
    if(!validZoomRange(s.zoom))errors.push(role+": invalid label zoom");
    if((s.outline!==null&&typeof s.outline!=="boolean")||
      (s.halo!==null&&typeof s.halo!=="boolean"))errors.push(role+": invalid halo/outline");
  }
  for(const key of DETAIL_FEATURES)if(!validZoomRange(settings.features[key]))errors.push(key+": invalid feature zoom");
  return errors;
}
/**
 * Safe, synchronous style document compiler for Atlas Lab. It only changes
 * paint/layout/zoom on layers already present in the supplied provider style.
 * Outlines apply to existing casing/outline layers; no fake casing is drawn.
 * Direct road tiers can be hidden with layout and zoom min/max. For shared
 * numeric-opacity road layers, per-class visibility and minZoom become an
 * above/below-zoom step expression without rebuilding the map.
 */
export function applyAdvancedStyleControls(
  original:AtlasStyleDocument,layers:readonly StyleLayerDescriptor[],
  settings:AdvancedStyleSettings,baseStyle?:unknown
):AtlasStyleDocument{
  const problems=validateAdvancedStyleSettings(settings);
  if(problems.length)throw new Error("Invalid Atlas advanced controls: "+problems.join("; "));
  const doc=copy(original),bases=layerIndex(baseStyle);
  const providerFonts=new Set(availableProviderFonts(baseStyle).map(x=>JSON.stringify(x)));
  const warned:string[]=[];
  for(const layer of layers){
    if(layer.id.startsWith("atlas-"))continue;
    const base=bases.get(layer.id);
    const feature=classifyMapFeature(layer);
    const road=layer.type==="line"&&layer.suggestedGroup==="roads"&&feature!=="transit";
    if(road){
      if(isNonRoadLine(layer,base))continue;
      const tier=classifyRoadLayer(layer,base),isOutline=casing(layer);
      const relevant=ROAD_TIERS.filter(t=>{
        const v=settings.roads[t];
        return (isOutline?(v.outlineColor!==null||v.outlineWidth!==null):(v.color!==null||v.width!==null||v.visible!==null||v.zoom.min!==null||v.zoom.max!==null||v.dash!=="inherit"));
      });
      if(!relevant.length)continue;
      const cases=tier?[tier]:ROAD_TIERS;
      const design=tier?settings.roads[tier]:null;
      const active=cases.filter(t=>relevant.includes(t));
      if(!active.length)continue;
      const colorKey="line-color",widthKey="line-width";
      const colors=cases.some(t=>isOutline?settings.roads[t].outlineColor!==null:settings.roads[t].color!==null);
      const widths=cases.some(t=>isOutline?settings.roads[t].outlineWidth!==null:settings.roads[t].width!==null);
      if(colors){
        const baseColor=sourceValue(doc,base,layer,"paint",colorKey,"#777777");
        const chosen=(t:RoadTier)=>isOutline?settings.roads[t].outlineColor:settings.roads[t].color;
        const value=tier?chosen(tier):null;
        put(doc,layer.id,"paint",colorKey,value??matchRoad(baseColor,t=>chosen(t)));
      }
      if(widths){
        const baseWidth=sourceValue(doc,base,layer,"paint",widthKey,1);
        const chosen=(t:RoadTier)=>isOutline?settings.roads[t].outlineWidth:settings.roads[t].width;
        const value=tier?chosen(tier):null;
        put(doc,layer.id,"paint",widthKey,value??matchRoad(baseWidth,t=>chosen(t)));
      }
      if(tier){
        if(design!.visible!==null)put(doc,layer.id,"layout","visibility",design!.visible?"visible":"none");
        applyZoom(doc,layer.id,base,design!.zoom);
        if(!isOutline&&design!.dash!=="inherit"&&!(record(base?.paint)&&base.paint["line-pattern"])){
          put(doc,layer.id,"paint","line-dasharray",design!.dash==="dashed"?["literal",[2,1.5]]:["literal",[1,.001]]);
        }
      }else{
        const needsOpacity=ROAD_TIERS.some(t=>settings.roads[t].visible===false||settings.roads[t].zoom.min!==null||settings.roads[t].zoom.max!==null);
        if(needsOpacity){
          const baseOpacity=sourceValue(doc,base,layer,"paint","line-opacity",1);
          if(typeof baseOpacity==="number"||(Array.isArray(baseOpacity)&&!JSON.stringify(baseOpacity).includes('"zoom"'))){
            const points=new Set<number>([0]);
            for(const t of ROAD_TIERS)for(const z of [settings.roads[t].zoom.min,settings.roads[t].zoom.max])if(z!==null)points.add(z);
            const stops=[...points].sort((a,b)=>a-b);
            const at=(z:number):JsonValue=>matchRoad(baseOpacity,(t,old)=>{
              const row=settings.roads[t];
              const disabled=row.visible===false||(row.zoom.min!==null&&z<row.zoom.min)||(row.zoom.max!==null&&z>=row.zoom.max);
              return disabled?0:null;
            });
            let output:JsonValue=at(0);
            if(stops.length>1){
              const expr:JsonValue[]=["step",["zoom"],at(0)];
              for(const z of stops.slice(1)){expr.push(z,at(z));}
              output=expr;
            }
            put(doc,layer.id,"paint","line-opacity",output);
          }else warned.push("Zoom-class gating skipped for provider expression in "+layer.id);
        }
        const hasDash=!isOutline&&ROAD_TIERS.some(t=>settings.roads[t].dash!=="inherit");
        if(hasDash&&!(record(base?.paint)&&base.paint["line-pattern"])){
          // MapLibre GL JS 6.x supports data-driven line-dasharray; every
          // returned array must be wrapped with literal in an expression.
          const entries:JsonValue[]=[];
          for(const t of ROAD_TIERS){
            const dash=settings.roads[t].dash;
            if(dash!=="inherit")entries.push([...ROAD_CLASS_VALUES[t],["literal",dash==="dashed"?[2,1.5]:[1,.001]]]);
          }
          const baseDash=sourceValue(doc,base,layer,"paint","line-dasharray",[1,.001]);
          const unchanged=Array.isArray(baseDash)&&baseDash.every(x=>typeof x==="number")
            ?["literal",baseDash]:baseDash;
          put(doc,layer.id,"paint","line-dasharray",["match",roadSelector,...entries,unchanged]);
        }
      }
      continue;
    }
    if(feature)applyZoom(doc,layer.id,base,settings.features[feature]);
    const role=classifyLabelRole(layer,base);
    if(!role)continue;
    const label=settings.labels[role];
    const baseMin=(doc.layers[layer.id]?.minzoom??(typeof base?.minzoom==="number"?base.minzoom:0));
    const baseMax=(doc.layers[layer.id]?.maxzoom??(typeof base?.maxzoom==="number"?base.maxzoom:24));
    applyZoom(doc,layer.id,{...base,minzoom:baseMin,maxzoom:baseMax},label.zoom);
    if(label.visible!==null)put(doc,layer.id,"layout","visibility",label.visible?"visible":"none");
    if(label.color!==null)put(doc,layer.id,"paint","text-color",label.color);
    if(label.outline!==null||label.halo!==null){
      const currentWidth=sourceValue(doc,base,layer,"paint","text-halo-width",0);
      const width=typeof currentWidth==="number"?currentWidth:0;
      // A crisp outline is the zero-blur version of MapLibre text halo.
      // "Soft halo" adds blur and the minimum width it needs to render.
      // Explicit overrides may re-enable a halo on dark themes; Preset
      // leaves existing dark-theme zero-width halo settings untouched.
      if(label.outline===false&&label.halo!==true){
        put(doc,layer.id,"paint","text-halo-width",0);
        put(doc,layer.id,"paint","text-halo-blur",0);
      }else{
        if(label.outline===true||label.halo===true){
          put(doc,layer.id,"paint","text-halo-width",
            label.outline===true&&label.halo===true?1.6:
            label.halo===true?1.3:Math.max(.85,width));
          const currentColor=doc.groups.land?.color??"#F5F6F8";
          put(doc,layer.id,"paint","text-halo-color",currentColor);
        }
        if(label.halo===true)put(doc,layer.id,"paint","text-halo-blur",1.15);
        else if(label.halo===false||label.outline===true)
          put(doc,layer.id,"paint","text-halo-blur",0);
      }
    }
    if(label.sizeScale!==null){
      const originalSize=sourceValue(doc,base,layer,"layout","text-size",16);
      const size=onZoomOutputs(originalSize,stop=>typeof stop==="number"?
        Number((stop*label.sizeScale!).toFixed(3)):["*",stop,label.sizeScale!]);
      put(doc,layer.id,"layout","text-size",size);
    }
    if(label.spacing!==null)put(doc,layer.id,"layout","text-letter-spacing",label.spacing);
    if(label.fontStack!==null){
      const key=JSON.stringify(label.fontStack);
      if(providerFonts.has(key))put(doc,layer.id,"layout","text-font",copy(label.fontStack));
      else warned.push("Unavailable provider font ignored: "+label.fontStack.join(", "));
    }
  }
  const hasEdits=Object.values(settings.roads).some(v=>v.color||v.width||v.outlineColor||v.outlineWidth||v.dash!=="inherit"||v.visible!==null||v.zoom.min!==null||v.zoom.max!==null)||
    Object.values(settings.labels).some(v=>v.color||v.sizeScale||v.spacing!==null||v.fontStack||v.visible!==null||v.outline!==null||v.halo!==null||v.zoom.min!==null||v.zoom.max!==null)||
    Object.values(settings.features).some(v=>v.min!==null||v.max!==null);
  if(hasEdits){
    doc.metadata={...doc.metadata,advancedStyleVersion:1,
      advancedStyleControls:copy(settings) as unknown as JsonValue,
      ...(warned.length?{advancedStyleWarnings:warned}:{})
    };
  }
  return doc;
}
