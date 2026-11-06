/**
 * Atlas Style Core: renderer-independent, deterministic and strictly data-only.
 * No React, MapLibre runtime, network, eval, or third-party tile-provider dependency.
 *
 * The v2 document is an authoring format. compileAtlasStyle returns a MapLibre
 * style JSON object; it does not silently modify the base style or external map.
 */
export type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = { [key: string]: JsonValue };
export const STYLE_DOCUMENT_VERSION = 2 as const;
export const STYLE_GROUPS = [
  "land","water","parks","roads","buildings","labels","boundaries",
  "transit","poi","terrain"
] as const;
export type StyleGroup = typeof STYLE_GROUPS[number];
export type LayerType = "background"|"fill"|"line"|"symbol"|"circle"|"heatmap"|"raster"|"hillshade"|"fill-extrusion"|"color-relief"|string;
export interface StyleLayerDescriptor {
  id: string;
  type: LayerType;
  source?: string;
  sourceLayer?: string;
  suggestedGroup: StyleGroup | null;
  /** Heuristic grouping is a suggestion, never an authoritative tile schema. */
  suggestionOnly: true;
}
export interface GroupStyle {
  color?: string;
  opacity?: number;
  visible?: boolean;
}
export interface LayerOverride {
  paint?: JsonRecord;
  layout?: JsonRecord;
  /** null explicitly removes a filter; omitted means leave unchanged. */
  filter?: JsonValue | null;
  minzoom?: number;
  maxzoom?: number;
}
export interface AtlasStyleDocument {
  schemaVersion: typeof STYLE_DOCUMENT_VERSION;
  id: string;
  name: string;
  baseStyle: string;
  groups: Partial<Record<StyleGroup, GroupStyle>>;
  /** Explicit exact layer IDs. Generated suggestions must be reviewed by the author. */
  bindings: Partial<Record<StyleGroup, string[]>>;
  layers: Record<string, LayerOverride>;
  /** Arbitrary editor metadata is retained as JSON, not executed as code. */
  metadata?: JsonRecord;
}
export interface StyleDiagnostic {
  severity: "error"|"warning";
  code: string;
  path: string;
  message: string;
}
export interface CompileResult {
  style: JsonRecord;
  diagnostics: StyleDiagnostic[];
  /** Unique exact layer IDs whose values differ from the supplied base. */
  changedLayerIds: string[];
}
export const MINIMAL_LIGHT_PALETTE = Object.freeze({
  land:"#F7F7F5",
  water:"#DCE9EB",
  parks:"#E5EDE3",
  roads:"#FFFFFF",
  buildings:"#E9E9E6",
  labels:"#535B59",
  /** Additional values reserved for fine-grained road paint rules. */
  roadOutline:"#D4D6D3",
} as const);

const blocked = new Set(["__proto__","constructor","prototype"]);
const validName = (value:string) => value.length > 0 && value.length <= 256 && !blocked.has(value);
const isRecord = (value:unknown):value is Record<string,unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isHex = (value:unknown):value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const isJson = (value:unknown,depth=0):value is JsonValue => {
  if(depth > 60)return false;
  if(value===null || typeof value==="string" || typeof value==="boolean")return true;
  if(typeof value==="number")return Number.isFinite(value);
  if(Array.isArray(value))return value.every(v=>isJson(v,depth+1));
  if(!isRecord(value))return false;
  return Object.entries(value).every(([k,v])=>validName(k)&&isJson(v,depth+1));
};
const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value)) as T;
const error = (code:string,path:string,message:string):StyleDiagnostic => ({severity:"error",code,path,message});
const warning = (code:string,path:string,message:string):StyleDiagnostic => ({severity:"warning",code,path,message});

export function suggestLayerGroup(layer:Pick<StyleLayerDescriptor,"id"|"type"|"sourceLayer">):StyleGroup|null{
  const id=layer.id.toLowerCase().replace(/_/g,"-");
  const src=(layer.sourceLayer??"").toLowerCase();
  if(layer.type==="background")return "land";
  if(layer.type==="symbol"){
    if(/poi|amenity|shop|icon/.test(id)||/poi/.test(src))return "poi";
    return /label|text|name|place|road|water/.test(id)||/place|transportation/.test(src)?"labels":null;
  }
  if(/water|ocean|river|lake|sea/.test(id)||/water/.test(src))return "water";
  if(/park|forest|grass|landcover|wood|natural|green/.test(id)||/park|landcover|landuse/.test(src))return "parks";
  if(/building/.test(id)||/building/.test(src))return "buildings";
  if(/boundary|admin|border/.test(id)||/boundary/.test(src))return "boundaries";
  if(/road|street|highway|motorway|transportation|bridge|tunnel/.test(id)||/transportation/.test(src))return "roads";
  if(/rail|transit|subway|metro/.test(id)||/rail|transit/.test(src))return "transit";
  if(/contour|hillshade|terrain/.test(id)||layer.type==="hillshade"||layer.type==="color-relief")return "terrain";
  return null;
}
function inspectBase(style:unknown):{root:Record<string,unknown>;layers:Record<string,unknown>[]} {
  if(!isRecord(style)||style.version!==8||!Array.isArray(style.layers))
    throw new Error("Expected a MapLibre style JSON object (version 8 with layers array).");
  const layers:Record<string,unknown>[]=[];
  const ids=new Set<string>();
  for(const layer of style.layers){
    if(!isRecord(layer)||typeof layer.id!=="string"||!validName(layer.id)||typeof layer.type!=="string")
      throw new Error("Style contains an invalid layer id or type.");
    if(ids.has(layer.id))throw new Error("Style contains duplicate layer id: "+layer.id);
    ids.add(layer.id);
    layers.push(layer);
  }
  if(!isJson(style))throw new Error("Style must contain finite, JSON-compatible values.");
  return {root:style,layers};
}
export function inspectStyleLayers(style:unknown):StyleLayerDescriptor[]{
  const {layers}=inspectBase(style);
  return layers.map(layer=>{
    const id=layer.id as string;
    const type=layer.type as string;
    const source=typeof layer.source==="string"?layer.source:undefined;
    const sourceLayer=typeof layer["source-layer"]==="string"?layer["source-layer"]:undefined;
    return {id,type,source,sourceLayer,suggestedGroup:suggestLayerGroup({id,type,sourceLayer}),suggestionOnly:true as const};
  });
}
export function suggestGroupBindings(style:unknown):Partial<Record<StyleGroup,string[]>>{
  const result:Partial<Record<StyleGroup,string[]>>={};
  for(const layer of inspectStyleLayers(style)){
    if(!layer.suggestedGroup)continue;
    (result[layer.suggestedGroup]??=[]).push(layer.id);
  }
  return result;
}
export function createEmptyStyleDocument(id:string,baseStyle:string,name="Untitled style"):AtlasStyleDocument{
  return {schemaVersion:2,id,name,baseStyle,groups:{},bindings:{},layers:{}};
}
/**
 * Generates *suggested* bindings from the supplied style. Inspect and revise
 * them before production use: source-specific semantics can be different.
 */
export function createMinimalLightDocument(baseStyle:unknown,baseStyleId:string):AtlasStyleDocument{
  const bindings=suggestGroupBindings(baseStyle);
  const {roadOutline,...colors}=MINIMAL_LIGHT_PALETTE;
  void roadOutline;
  return {
    schemaVersion:2,id:"minimal-light",name:"Minimal Light",baseStyle:baseStyleId,
    groups:Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,{color}])) as AtlasStyleDocument["groups"],
    bindings,layers:{},
    metadata:{preset:"minimal-light",bindingMode:"suggested-review-required"}
  };
}
export function validateStyleDocument(value:unknown):StyleDiagnostic[]{
  const out:StyleDiagnostic[]=[];
  if(!isRecord(value))return [error("DOCUMENT","$","Expected an object.")];
  const doc=value;
  if(doc.schemaVersion!==2)out.push(error("SCHEMA_VERSION","schemaVersion","Expected schemaVersion 2."));
  for(const key of ["id","name","baseStyle"]){
    if(typeof doc[key]!=="string"||!validName(doc[key] as string))out.push(error("IDENTIFIER",key,"Expected a nonempty safe string of at most 256 characters."));
  }
  if(!isRecord(doc.groups))out.push(error("GROUPS","groups","Expected group definitions."));
  else for(const [group,v] of Object.entries(doc.groups)){
    if(!STYLE_GROUPS.includes(group as StyleGroup)||!isRecord(v)){
      out.push(error("GROUP","groups."+group,"Unknown group or invalid settings."));continue;
    }
    if(v.color!==undefined&&!isHex(v.color))out.push(error("COLOR","groups."+group+".color","Use a six-digit hexadecimal color."));
    if(v.visible!==undefined&&typeof v.visible!=="boolean")out.push(error("VISIBLE","groups."+group+".visible","Expected boolean."));
    if(v.opacity!==undefined&&(typeof v.opacity!=="number"||!Number.isFinite(v.opacity)||v.opacity<0||v.opacity>1))
      out.push(error("OPACITY","groups."+group+".opacity","Expected opacity in [0,1]."));
  }
  if(!isRecord(doc.bindings))out.push(error("BINDINGS","bindings","Expected bindings object."));
  else for(const [group,ids] of Object.entries(doc.bindings)){
    if(!STYLE_GROUPS.includes(group as StyleGroup)||!Array.isArray(ids)||ids.some(id=>typeof id!=="string"||!validName(id)))
      out.push(error("BINDING","bindings."+group,"Expected a known group and array of safe layer IDs."));
  }
  if(!isRecord(doc.layers))out.push(error("LAYERS","layers","Expected layer overrides object."));
  else for(const [id,override] of Object.entries(doc.layers)){
    if(!validName(id)||!isRecord(override)){
      out.push(error("LAYER","layers."+id,"Invalid layer ID or override."));continue;
    }
    for(const key of ["paint","layout"]){
      if(override[key]===undefined)continue;
      if(!isRecord(override[key])||!isJson(override[key]))
        out.push(error("PROPERTY", "layers."+id+"."+key, "Expected a JSON-compatible property dictionary."));
    }
    if(override.filter!==undefined&&!isJson(override.filter))
      out.push(error("FILTER","layers."+id+".filter","Expected a JSON filter or null."));
    for(const key of ["minzoom","maxzoom"]){
      if(override[key]!==undefined&&(typeof override[key]!=="number"||!Number.isFinite(override[key])||override[key]<0||override[key]>24))
        out.push(error("ZOOM","layers."+id+"."+key,"Expected zoom between 0 and 24."));
    }
    if(typeof override.minzoom==="number"&&typeof override.maxzoom==="number"&&override.minzoom>override.maxzoom)
      out.push(error("ZOOM_RANGE","layers."+id,"minzoom must not exceed maxzoom."));
  }
  if(doc.metadata!==undefined&&!isJson(doc.metadata))out.push(error("METADATA","metadata","Metadata must be JSON-compatible."));
  return out;
}
const colorKey:Record<string,string|undefined>={
  background:"background-color",fill:"fill-color",line:"line-color",symbol:"text-color",
  circle:"circle-color","fill-extrusion":"fill-extrusion-color"
};
const opacityKey:Record<string,string|undefined>={
  background:"background-opacity",fill:"fill-opacity",line:"line-opacity",symbol:"text-opacity",
  circle:"circle-opacity",raster:"raster-opacity","fill-extrusion":"fill-extrusion-opacity"
};
function layerRecords(layer:Record<string,unknown>,key:"paint"|"layout"):Record<string,unknown>{
  if(!isRecord(layer[key]))layer[key]={};
  return layer[key] as Record<string,unknown>;
}
export function compileAtlasStyle(baseStyle:unknown,document:AtlasStyleDocument):CompileResult{
  const diagnostics=validateStyleDocument(document);
  if(diagnostics.some(d=>d.severity==="error"))throw new Error("Invalid Atlas style document: "+diagnostics.filter(d=>d.severity==="error").map(d=>d.path).join(", "));
  const base=inspectBase(baseStyle);
  const style=clone(base.root) as JsonRecord;
  const layers=style.layers as unknown as Record<string,unknown>[];
  const byId=new Map(layers.map(layer=>[layer.id as string,layer]));
  const changed=new Set<string>();
  // Group defaults apply only to explicitly bound IDs. They never invent layers.
  for(const group of STYLE_GROUPS){
    const settings=document.groups[group];
    if(!settings)continue;
    for(const id of document.bindings[group]??[]){
      const layer=byId.get(id);
      if(!layer){
        diagnostics.push(warning("MISSING_BINDING","bindings."+group,"Layer not found in this style: "+id));
        continue;
      }
      const type=layer.type as string;
      let touched=false;
      const paint=layerRecords(layer,"paint");
      const colorProperty=colorKey[type];
      if(settings.color!==undefined&&colorProperty){
        paint[colorProperty]=settings.color;touched=true;
      }else if(settings.color!==undefined){
        diagnostics.push(warning("UNSUPPORTED_COLOR","groups."+group,"Layer "+id+" type "+type+" has no basic colour property."));
      }
      const opacityProperty=opacityKey[type];
      if(settings.opacity!==undefined&&opacityProperty){paint[opacityProperty]=settings.opacity;touched=true;}
      if(settings.visible!==undefined){layerRecords(layer,"layout").visibility=settings.visible?"visible":"none";touched=true;}
      if(touched)changed.add(id);
    }
  }
  // Individual layer overrides win over group defaults. Unknown properties
  // are retained for the renderer/spec validator rather than silently dropped.
  for(const id of Object.keys(document.layers).sort()){
    const override=document.layers[id]!;
    const layer=byId.get(id);
    if(!layer){
      diagnostics.push(warning("MISSING_LAYER","layers."+id,"Layer not found in this base style."));
      continue;
    }
    for(const slot of ["paint","layout"] as const){
      if(!override[slot])continue;
      const target=layerRecords(layer,slot);
      for(const prop of Object.keys(override[slot]).sort())target[prop]=clone(override[slot][prop]!);
      changed.add(id);
    }
    if(override.filter!==undefined){
      if(override.filter===null)delete layer.filter;
      else layer.filter=clone(override.filter);
      changed.add(id);
    }
    if(override.minzoom!==undefined){layer.minzoom=override.minzoom;changed.add(id);}
    if(override.maxzoom!==undefined){layer.maxzoom=override.maxzoom;changed.add(id);}
  }
  // Exclude no-op layer patches when an override matches its base value.
  const baseById=new Map(base.layers.map(layer=>[layer.id as string,layer]));
  const changedLayerIds=layers.filter(layer=>changed.has(layer.id as string)&&
    JSON.stringify(layer)!==JSON.stringify(baseById.get(layer.id as string))).map(layer=>layer.id as string);
  return {style,diagnostics,changedLayerIds};
}
export function migrateLegacyColorTheme(value:unknown,baseStyle:unknown,baseStyleId:string):AtlasStyleDocument {
  if(!isRecord(value)||value.version!==1||value.renderer!=="maplibre"||!isRecord(value.colors))
    throw new Error("Expected Atlas legacy v1 vector color theme.");
  const document=createEmptyStyleDocument("imported-v1-theme",baseStyleId,"Imported Atlas theme");
  document.bindings=suggestGroupBindings(baseStyle);
  for(const group of ["land","water","parks","roads","buildings","labels"] as const){
    if(!isHex(value.colors[group]))throw new Error("Invalid legacy theme color: "+group);
    document.groups[group]={color:value.colors[group]};
  }
  document.metadata={migratedFrom:1,bindingMode:"suggested-review-required"};
  return document;
}
export function parseAtlasStyleDocument(raw:string):AtlasStyleDocument {
  if(raw.length>2_000_000)throw new Error("Style document exceeds 2 MB.");
  const value:unknown=JSON.parse(raw);
  const diagnostics=validateStyleDocument(value);
  if(diagnostics.some(d=>d.severity==="error"))throw new Error("Invalid Atlas style document: "+diagnostics.map(d=>d.path).join(", "));
  return value as AtlasStyleDocument;
}
export function stringifyAtlasStyleDocument(document:AtlasStyleDocument):string{
  const diagnostics=validateStyleDocument(document);
  if(diagnostics.some(d=>d.severity==="error"))throw new Error("Invalid Atlas style document.");
  const canonical=(value:JsonValue):JsonValue => Array.isArray(value)?value.map(canonical):
    value!==null&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k]!)])):
    value;
  return JSON.stringify(canonical(document as unknown as JsonValue),null,2);
}

export {ATLAS_STYLE_PRESETS,getAtlasPreset,getAtlasPresetCoreColors,createAtlasPresetDocument} from "./presets";
export {getAtlasPresetDetailSettings,ATLAS_DETAIL_PROFILE_VERSION} from "./presetDetails";
export type {AtlasPresetDefinition,AtlasPresetId,AtlasPresetDocumentOptions} from "./presets";

export {PALETTE_MIN_COLORS,PALETTE_MAX_COLORS,normalizeHexColor,validatePaletteSeeds,parseHexPalette,deriveSemanticPalette,mixPaletteColors,contrastRatio,relativeLuminance,reskinAtlasPreset} from "./palette";
export type {SemanticPalette,PaletteSlots} from "./palette";

export {ROAD_TIERS,DETAIL_FEATURES,createMapDetailSettings,classifyRoadLayer,classifyMapFeature,applyMapDetailControls,mergeMapDetailOverrides,deriveMapDetailOverrides} from "./detailControls";
export type {RoadTier,DetailFeature,DetailLevel,DetailDensity,MapDetailSettings,MapDetailOverrides} from "./detailControls";

export {LABEL_ROLES,createAdvancedStyleSettings,availableProviderFonts,classifyLabelRole,validateAdvancedStyleSettings,applyAdvancedStyleControls} from "./advancedStyle";
export type {LabelRole,RoadDash,RoadDesign,LabelDesign,ZoomRange,AdvancedStyleSettings} from "./advancedStyle";

export {ATLAS_ADVANCED_PROFILE_VERSION,getAtlasPresetAdvancedSettings,createAdvancedOverrides,deriveAdvancedOverrides,mergeAdvancedOverrides} from "./presetAdvanced";
export type {AdvancedPaletteOverrides,AdvancedOverrides} from "./presetAdvanced";
