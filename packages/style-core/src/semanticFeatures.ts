import type {AtlasStyleDocument,StyleLayerDescriptor,JsonValue,JsonRecord,LayerOverride} from "./index";

/**
 * Provider-aware Stage 3 cartography. A category describes real OSM vector
 * tile properties, NOT a guess about individual building occupancy.
 */
export const SEMANTIC_FAMILIES=[
  {id:"architecture",name:"Buildings & land use"},
  {id:"nature",name:"Parks & vegetation"},
  {id:"water",name:"Water features"},
  {id:"poi",name:"Points of interest"},
  {id:"boundaries",name:"Administrative boundaries"},
  {id:"transit",name:"Transit & terrain"}
] as const;
export type SemanticFamily=typeof SEMANTIC_FAMILIES[number]["id"];
export const SEMANTIC_FEATURES={
  buildings:{family:"architecture",name:"Building footprints",hint:"All buildings; usage is not identified by this layer"},
  residential:{family:"architecture",name:"Residential areas",hint:"Zoned residential land use, not individual building use"},
  commercial:{family:"architecture",name:"Commercial areas",hint:"Commercial, retail and shopping land use"},
  industrial:{family:"architecture",name:"Industrial areas",hint:"Industrial and factory land use"},
  parks:{family:"nature",name:"Parks",hint:"Parks and public recreation land"},
  forests:{family:"nature",name:"Forests & woodland",hint:"Wooded landcover"},
  grass:{family:"nature",name:"Grass & meadow",hint:"Grassland and meadow landcover"},
  gardens:{family:"nature",name:"Gardens",hint:"Gardens, botanical gardens and allotments where tagged"},
  agriculture:{family:"nature",name:"Agricultural land",hint:"Farms, vineyards, orchards and farmland"},
  waterBodies:{family:"water",name:"Lakes & water bodies",hint:"Water polygons; lakes and coastlines may share a provider layer"},
  rivers:{family:"water",name:"Rivers",hint:"River centreline features"},
  streams:{family:"water",name:"Streams & canals",hint:"Smaller waterways and canals"},
  poiHealth:{family:"poi",name:"Hospitals & health",hint:"Healthcare points of interest"},
  poiEducation:{family:"poi",name:"Schools & education",hint:"Schools, universities and colleges"},
  poiFood:{family:"poi",name:"Restaurants & cafés",hint:"Food and drink places"},
  poiShopping:{family:"poi",name:"Shops & retail",hint:"Retail locations"},
  poiLandmarks:{family:"poi",name:"Landmarks & culture",hint:"Museums, landmarks, tourism and historic sites"},
  poiTransit:{family:"poi",name:"Transport stations",hint:"Rail, bus, airport and transport POIs"},
  countryBorders:{family:"boundaries",name:"Country borders",hint:"Admin level 2"},
  regionBorders:{family:"boundaries",name:"State & region borders",hint:"Admin levels 3–4"},
  localBorders:{family:"boundaries",name:"District & local borders",hint:"Admin levels 5–8"},
  railways:{family:"transit",name:"Rail & metro lines",hint:"Rail, tram and subway lines where mapped"},
  terrain:{family:"transit",name:"Terrain & relief",hint:"Hillshade, contours and terrain overlays"}
} as const;
export type SemanticFeature=keyof typeof SEMANTIC_FEATURES;
export const SEMANTIC_KEYS=Object.keys(SEMANTIC_FEATURES) as SemanticFeature[];
export type FeatureZoom={min:number|null;max:number|null};
export type FeatureDesign={
  color:string|null;opacity:number|null;visible:boolean|null;
  width:number|null;outlineColor:string|null;dash:"inherit"|"solid"|"dashed";
  iconSize:number|null;heightScale:number|null;
  zoom:FeatureZoom;
};
export type SemanticStyleSettings=Record<SemanticFeature,FeatureDesign>;
export type FeatureSupport={layers:number;exact:number;possible:number};
type Layer=Record<string,unknown>;
const isObj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
export function createSemanticFeatureSettings():SemanticStyleSettings{
  return Object.fromEntries(SEMANTIC_KEYS.map(k=>[k,{
    color:null,opacity:null,visible:null,width:null,outlineColor:null,
    dash:"inherit",iconSize:null,heightScale:null,zoom:{min:null,max:null}
  }])) as SemanticStyleSettings;
}
const landuse={
  residential:["residential","neighbourhood","suburb"],
  commercial:["commercial","retail","shopping","mall"],
  industrial:["industrial","factory","garages"],
  parks:["park","recreation_ground","public_park"],
  gardens:["garden","botanical_garden","allotments"],
  agriculture:["farmland","farm","orchard","vineyard","meadow","agriculture"]
} as const;
const landcover={
  forests:["wood","forest","trees"],
  grass:["grass","grassland","meadow"],
  agriculture:["farmland","crop","farm"]
} as const;
const poi={
  poiHealth:["hospital","clinic","doctors","doctor","dentist","pharmacy","healthcare"],
  poiEducation:["school","college","university","kindergarten","library"],
  poiFood:["restaurant","cafe","fast_food","food","bar","pub","bakery","biergarten"],
  poiShopping:["shop","retail","supermarket","grocery","convenience","mall","department_store"],
  poiLandmarks:["attraction","museum","historic","monument","art","theatre","cinema","tourism","viewpoint"],
  poiTransit:["rail","bus","airport","station","subway","tram","ferry","transport"]
} as const;
const waterway={rivers:["river"],streams:["stream","canal","ditch","drain"]} as const;
const source=(layer:StyleLayerDescriptor)=> (layer.sourceLayer??"").replace(/-/g,"_").toLowerCase();
const normalize=(v:string)=>v.replace(/-/g,"_").toLowerCase();
function kinds(layer:StyleLayerDescriptor):SemanticFeature[]{
  if(layer.id.startsWith("atlas-"))return [];
  const src=source(layer),id=normalize(layer.id);
  if(src==="building"&&["fill","fill-extrusion"].includes(layer.type))return ["buildings"];
  if(src==="landuse"&&layer.type==="fill")return ["residential","commercial","industrial","parks","gardens","agriculture"];
  if(src==="park"&&["fill","line"].includes(layer.type))return ["parks"];
  if(src==="landcover"&&layer.type==="fill")return ["forests","grass","agriculture"];
  if(src==="water"&&layer.type==="fill")return ["waterBodies"];
  if(src==="waterway"&&layer.type==="line")return ["rivers","streams"];
  if(src==="poi"&&layer.type==="symbol")return ["poiHealth","poiEducation","poiFood","poiShopping","poiLandmarks","poiTransit"];
  if(src==="aerodrome_label"&&layer.type==="symbol")return ["poiTransit"];
  if(src==="boundary"&&layer.type==="line")return ["countryBorders","regionBorders","localBorders"];
  if(["transportation","transportation_name"].includes(src)&&layer.type==="line"&&
    /(?:^|_)(?:rail|tram|subway|metro|transit)(?:_|$)/.test(id))return ["railways"];
  if(layer.type==="hillshade"||layer.type==="color-relief"||src==="contour"&&layer.type==="line")return ["terrain"];
  return [];
}
function classValues(src:string,key:SemanticFeature):readonly string[]|null{
  if(src==="landuse")return (landuse as Record<string,readonly string[]>)[key]??null;
  if(src==="landcover")return (landcover as Record<string,readonly string[]>)[key]??null;
  if(src==="waterway")return (waterway as Record<string,readonly string[]>)[key]??null;
  if(src==="poi")return (poi as Record<string,readonly string[]>)[key]??null;
  return null;
}
function classScope(expr:unknown):string[]|null{
  if(!Array.isArray(expr))return null;
  if(expr[0]==="all"){
    const parts=expr.slice(1).map(classScope).filter((x):x is string[]=>x!==null);
    return parts.length?parts.reduce((a,b)=>a.filter(x=>b.includes(x))):null;
  }
  if(expr[0]==="any"){
    const parts=expr.slice(1).map(classScope);
    return parts.length&&parts.every(x=>x!==null)?[...new Set(parts.flatMap(x=>x??[]))]:null;
  }
  if(expr[0]==="=="&&Array.isArray(expr[1])&&expr[1][0]==="get"&&
    ["class","subclass"].includes(expr[1][1])&&typeof expr[2]==="string")return [expr[2]];
  if(expr[0]==="match"&&Array.isArray(expr[1])&&expr[1][0]==="get"&&
    ["class","subclass"].includes(expr[1][1])&&expr.at(-1)===false){
    const out:string[]=[];
    for(let i=2;i<expr.length-1;i+=2)if(expr[i+1]===true){
      const a=Array.isArray(expr[i])?expr[i]:[expr[i]];
      for(const c of a)if(typeof c==="string")out.push(c);
    }
    return out;
  }
  return null;
}
function adminScope(expr:unknown):number[]|null{
  if(!Array.isArray(expr))return null;
  if(expr[0]==="all"){
    const parts=expr.slice(1).map(adminScope).filter((x):x is number[]=>x!==null);
    return parts.length?parts.reduce((a,b)=>a.filter(x=>b.includes(x))):null;
  }
  if(expr[0]==="=="&&Array.isArray(expr[1])&&expr[1][0]==="get"&&expr[1][1]==="admin_level"){
    const n=Number(expr[2]);return Number.isFinite(n)?[n]:null;
  }
  return null;
}
function selector(layer:StyleLayerDescriptor,key:SemanticFeature):JsonValue{
  const src=source(layer);
  if(src==="building"||src==="water"||src==="park"||src==="aerodrome_label"||
    key==="terrain"||key==="railways")return true;
  if(src==="boundary"){
    const level:JsonValue=["to-number",["get","admin_level"],0];
    if(key==="countryBorders")return ["==",level,2];
    if(key==="regionBorders")return ["all",[">=",level,3],["<=",level,4]];
    return ["all",[">=",level,5],["<=",level,8]];
  }
  const values=classValues(src,key);
  if(!values)return false;
  const vals=[...values];
  return ["any",
    ["in",["coalesce",["get","class"],""],["literal",vals]],
    ["in",["coalesce",["get","subclass"],""],["literal",vals]]
  ];
}
function relevant(layer:StyleLayerDescriptor,base?:Layer):SemanticFeature[]{
  let all=kinds(layer);
  if(!all.length)return all;
  const scope=classScope(base?.filter);
  if(scope!==null)all=all.filter(k=>{
    const values=classValues(source(layer),k);
    return !values||scope.some(c=>values.includes(c));
  });
  const levels=adminScope(base?.filter);
  if(levels!==null)all=all.filter(k=>{
    if(k==="countryBorders")return levels.includes(2);
    if(k==="regionBorders")return levels.some(l=>l>=3&&l<=4);
    if(k==="localBorders")return levels.some(l=>l>=5&&l<=8);
    return true;
  });
  return all;
}
function index(baseStyle:unknown):Map<string,Layer>{
  if(!isObj(baseStyle)||!Array.isArray(baseStyle.layers))return new Map();
  return new Map(baseStyle.layers.filter(isObj).filter(x=>typeof x.id==="string").map(x=>[x.id as string,x]));
}
export function inspectSemanticCoverage(layers:readonly StyleLayerDescriptor[],baseStyle:unknown):
  Record<SemanticFeature,FeatureSupport>{
  const result=Object.fromEntries(SEMANTIC_KEYS.map(k=>[k,{layers:0,exact:0,possible:0}])) as Record<SemanticFeature,FeatureSupport>;
  const originals=index(baseStyle);
  for(const l of layers){
    const base=originals.get(l.id);
    for(const key of relevant(l,base)){
      result[key].layers++;
      const src=source(l),filtered=classScope(base?.filter)??adminScope(base?.filter);
      const certain=filtered!==null||src==="building"||src==="water"||src==="park"||
        src==="aerodrome_label"||key==="terrain"||key==="railways";
      if(certain)result[key].exact++;else result[key].possible++;
    }
  }
  return result;
}
export function validateSemanticFeatureSettings(s:SemanticStyleSettings):string[]{
  const errors:string[]=[];
  const color=(v:unknown)=>v===null||typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v);
  const number=(v:unknown,min:number,max:number)=>v===null||typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
  for(const key of SEMANTIC_KEYS){
    const row=s[key];if(!row){errors.push("Missing feature "+key);continue;}
    if(!color(row.color)||!color(row.outlineColor))errors.push(key+" invalid colour");
    if(!number(row.opacity,0,100)||!number(row.width,.25,30)||!number(row.iconSize,.5,3)||
       !number(row.heightScale,.25,3))errors.push(key+" invalid scale");
    if(row.visible!==null&&typeof row.visible!=="boolean")errors.push(key+" invalid visibility");
    if(!["inherit","solid","dashed"].includes(row.dash))errors.push(key+" invalid dash");
    const z=row.zoom;
    if(!z||!number(z.min,0,22)||!number(z.max,1,24)||
       z.min!==null&&z.max!==null&&z.min>=z.max)errors.push(key+" invalid zoom");
  }
  return errors;
}
function zoomOutput(base:JsonValue,fn:(v:JsonValue)=>JsonValue):JsonValue{
  if(Array.isArray(base)&&base[0]==="interpolate"&&Array.isArray(base[2])&&base[2][0]==="zoom"){
    const arr:JsonValue[]=base.slice(0,3);
    for(let i=3;i<base.length;i+=2)arr.push(base[i]!,fn(base[i+1]!));
    return arr;
  }
  if(Array.isArray(base)&&base[0]==="step"&&Array.isArray(base[1])&&base[1][0]==="zoom"){
    const arr:JsonValue[]=[...base.slice(0,2),fn(base[2]!)];
    for(let i=3;i<base.length;i+=2)arr.push(base[i]!,fn(base[i+1]!));
    return arr;
  }
  return fn(base);
}
function hasZoom(v:unknown):boolean{
  return JSON.stringify(v).includes('"zoom"');
}
function opacityLayerKey(l:StyleLayerDescriptor):string[]{
  if(l.type==="fill")return ["fill-opacity"];
  if(l.type==="line")return ["line-opacity"];
  if(l.type==="fill-extrusion")return ["fill-extrusion-opacity"];
  if(l.type==="symbol")return ["text-opacity","icon-opacity"];
  if(l.type==="hillshade")return ["hillshade-exaggeration"];
  return [];
}
function paint(doc:AtlasStyleDocument,id:string,key:string,v:JsonValue):void{
  const old=doc.layers[id]??{};
  doc.layers[id]={...old,paint:{...(old.paint??{}),[key]:v}};
}
function layout(doc:AtlasStyleDocument,id:string,key:string,v:JsonValue):void{
  const old=doc.layers[id]??{};
  doc.layers[id]={...old,layout:{...(old.layout??{}),[key]:v}};
}
function prior(doc:AtlasStyleDocument,base:Layer,l:StyleLayerDescriptor,prop:string,otherwise:JsonValue):JsonValue{
  const written=doc.layers[l.id]?.paint?.[prop];
  if(written!==undefined)return clone(written);
  const group=l.suggestedGroup?doc.groups[l.suggestedGroup]:undefined;
  if(prop.endsWith("-color")&&group?.color&&
     !prop.includes("outline")&&!prop.includes("halo"))return group.color;
  if(prop.endsWith("-opacity")&&group?.opacity!==undefined)return group.opacity;
  if(isObj(base.paint)&&base.paint[prop]!==undefined)return clone(base.paint[prop] as JsonValue);
  return otherwise;
}
function conditionally(base:JsonValue,layer:StyleLayerDescriptor,entries:Array<[SemanticFeature,JsonValue]>):JsonValue{
  if(!entries.length)return base;
  return zoomOutput(base,stop=>{
    const cases:JsonValue[]=["case"];
    for(const [k,value] of entries)cases.push(selector(layer,k),value);
    cases.push(stop);
    return cases;
  });
}
const fullChange=(s:FeatureDesign)=>s.color!==null||s.opacity!==null||s.visible!==null||s.width!==null||
  s.outlineColor!==null||s.dash!=="inherit"||s.iconSize!==null||s.heightScale!==null||
  s.zoom.min!==null||s.zoom.max!==null;
/** Return a fresh document; never change the provider style or allocate map layers. */
export function applySemanticFeatureControls(
  original:AtlasStyleDocument,layers:readonly StyleLayerDescriptor[],
  settings:SemanticStyleSettings,baseStyle?:unknown
):AtlasStyleDocument{
  const issues=validateSemanticFeatureSettings(settings);
  if(issues.length)throw new Error("Invalid semantic feature controls: "+issues.join("; "));
  if(!baseStyle||!Object.values(settings).some(fullChange))return original;
  const doc=clone(original),originals=index(baseStyle),warnings:string[]=[];
  for(const layer of layers){
    const base=originals.get(layer.id);
    if(!base)continue;
    const candidates=relevant(layer,base);
    const keys=candidates.filter(k=>fullChange(settings[k]));
    if(!keys.length)continue;
    const upstreamHidden=doc.groups[layer.suggestedGroup!]?.visible===false||
      doc.layers[layer.id]?.layout?.visibility==="none"||
      isObj(base.layout)&&base.layout.visibility==="none";
    const restoring=Boolean(upstreamHidden&&keys.some(k=>settings[k].visible===true));
    if(restoring)layout(doc,layer.id,"visibility","visible");
    const colourProp=layer.type==="fill"?"fill-color":layer.type==="line"?"line-color":
      layer.type==="fill-extrusion"?"fill-extrusion-color":layer.type==="symbol"?"text-color":null;
    if(colourProp){
      const edits=keys.filter(k=>settings[k].color!==null).map(k=>[k,settings[k].color!] as [SemanticFeature,JsonValue]);
      if(edits.length){
        const value=prior(doc,base,layer,colourProp,"#74899B");
        paint(doc,layer.id,colourProp,conditionally(value,layer,edits));
      }
    }
    const widthProp=layer.type==="line"?"line-width":null;
    if(widthProp){
      const edits=keys.filter(k=>settings[k].width!==null).map(k=>[k,settings[k].width!] as [SemanticFeature,JsonValue]);
      if(edits.length)paint(doc,layer.id,widthProp,conditionally(prior(doc,base,layer,widthProp,1),layer,edits));
    }
    if(layer.type==="fill"&&keys.some(k=>settings[k].outlineColor!==null)){
      const edits=keys.filter(k=>settings[k].outlineColor!==null)
        .map(k=>[k,settings[k].outlineColor!] as [SemanticFeature,JsonValue]);
      paint(doc,layer.id,"fill-outline-color",
        conditionally(prior(doc,base,layer,"fill-outline-color","#64748B"),layer,edits));
    }
    for(const prop of opacityLayerKey(layer)){
      if(layer.type==="symbol"&&prop==="text-opacity"&&
        !(isObj(base.layout)&&base.layout["text-field"]!==undefined))continue;
      if(layer.type==="symbol"&&prop==="icon-opacity"&&
        !(isObj(base.layout)&&base.layout["icon-image"]!==undefined))continue;
      // When a category is explicitly shown inside a hidden provider/preset
      // symbol layer, reveal the container but mask all other classes.
      const edits=restoring?candidates:keys.filter(k=>settings[k].opacity!==null||
        settings[k].visible!==null||settings[k].zoom.min!==null||settings[k].zoom.max!==null);
      if(!edits.length)continue;
      const originalValue=prior(doc,base,layer,prop,1);
      if(hasZoom(originalValue)&&!(Array.isArray(originalValue)&&
        (originalValue[0]==="step"||originalValue[0]==="interpolate"))){
        warnings.push("Zoom-based opacity not editable for "+layer.id);
        continue;
      }
      const steps=new Set<number>([0]);
      for(const k of edits)for(const z of [settings[k].zoom.min,settings[k].zoom.max])
        if(z!==null)steps.add(z);
      const stops=[...steps].sort((a,b)=>a-b);
      // Zoom can appear only as the direct input of a top-level
      // interpolate/step. Do not nest provider zoom expressions inside
      // another step just to force a per-class visibility threshold.
      if(stops.length>1&&hasZoom(originalValue)){
        warnings.push("Per-feature zoom thresholds require a numeric opacity in "+layer.id);
      }
      const safeStops=hasZoom(originalValue)?[0]:stops;
      const outputAt=(z:number):JsonValue=>zoomOutput(originalValue,stop=>{
        const statements:JsonValue[]=[];
        for(const k of edits){
          const cfg=settings[k];
          const disabled=cfg.visible===false||
            restoring&&cfg.visible!==true||
            cfg.zoom.min!==null&&z<cfg.zoom.min||
            cfg.zoom.max!==null&&z>=cfg.zoom.max;
          const altered:JsonValue=disabled?0:cfg.opacity===null?stop:
            typeof stop==="number"?Number((stop*cfg.opacity/100).toFixed(5)):
              ["*",stop,cfg.opacity/100];
          if(altered===stop)continue;
          statements.push(selector(layer,k),altered);
        }
        if(!statements.length)return restoring?0:stop;
        return ["case",...statements,restoring?0:stop];
      });
      const result:JsonValue=safeStops.length===1?outputAt(0):
        ["step",["zoom"],outputAt(0),...safeStops.slice(1).flatMap(z=>[z,outputAt(z)])];
      paint(doc,layer.id,prop,result);
    }
    if(layer.type==="symbol"&&isObj(base.layout)&&base.layout["icon-image"]!==undefined){
      const edits=keys.filter(k=>settings[k].iconSize!==null);
      if(edits.length){
        const originalSize=(doc.layers[layer.id]?.layout?.["icon-size"]??(
          isObj(base.layout)&&base.layout["icon-size"]!==undefined?
            clone(base.layout["icon-size"] as JsonValue):1
        )) as JsonValue;
        // icon-size is a layout property, and can be zoom/data driven.
        const value=zoomOutput(originalSize,stop=>{
          const values:JsonValue[]=[];
          for(const k of edits)values.push(selector(layer,k),
            typeof stop==="number"?stop*settings[k].iconSize!:
              ["*",stop,settings[k].iconSize!]);
          return ["case",...values,stop];
        });
        layout(doc,layer.id,"icon-size",value);
      }
    }
    if(layer.type==="fill-extrusion"&&isObj(base.paint)&&base.paint["fill-extrusion-height"]!==undefined){
      const cfg=settings.buildings;
      if(keys.includes("buildings")&&cfg.heightScale!==null){
        const sourceValue=prior(doc,base,layer,"fill-extrusion-height",0);
        if(!hasZoom(sourceValue))paint(doc,layer.id,"fill-extrusion-height",
          ["*",sourceValue,cfg.heightScale]);
        else warnings.push("Height scaling skipped for zoom-dependent "+layer.id);
      }
    }
    if(layer.type==="line"&&!(isObj(base.paint)&&base.paint["line-pattern"]!==undefined)){
      const edits=keys.filter(k=>settings[k].dash!=="inherit");
      if(edits.length){
        const old=prior(doc,base,layer,"line-dasharray",[1,0.001]);
        const fallback:Array<JsonValue>=Array.isArray(old)&&old.every(x=>typeof x==="number")
          ?["literal",old]:[old];
        const cases:JsonValue[]=["case"];
        for(const k of edits)cases.push(selector(layer,k),
          ["literal",settings[k].dash==="dashed"?[2,1.6]:[1,.001]]);
        paint(doc,layer.id,"line-dasharray",[...cases,...fallback]);
      }
    }
  }
  doc.metadata={...doc.metadata,semanticFeatureVersion:1,
    semanticFeatureControls:clone(settings) as unknown as JsonValue,
    ...(warnings.length?{semanticFeatureWarnings:warnings}: {})
  };
  return doc;
}
