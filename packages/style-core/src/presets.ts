import {
  type AtlasStyleDocument,type StyleGroup,type StyleLayerDescriptor,
  createEmptyStyleDocument,validateStyleDocument
} from "./index";

/**
 * Curated, zero-key Atlas presets built exclusively on existing v2
 * group colors, opacity, visibility and exact per-layer width overrides.
 * They do not add sources, sprites, fonts, effects, shaders or overlays.
 *
 * A provider base style controls actual available features: the visual
 * result may differ between OpenFreeMap styles and other tile schemas.
 */
type BaseId="positron"|"liberty"|"bright"|"dark";
type CoreGroup="land"|"water"|"parks"|"roads"|"buildings"|"labels";
type Palette=Readonly<Record<CoreGroup,string>&Partial<Record<Exclude<StyleGroup,CoreGroup>,string>>>;
export type AtlasPresetDefinition={
  readonly id:string;
  readonly name:string;
  readonly summary:string;
  readonly family:"minimal"|"editorial"|"expressive"|"utility";
  readonly baseStyle:BaseId;
  readonly palette:Palette;
  readonly settings?:Readonly<{
    roadsOpacity?:number;
    parksOpacity?:number;
    buildingsOpacity?:number;
    labelsOpacity?:number;
    boundariesOpacity?:number;
    poiVisible?:boolean;
    majorRoadWidth?:boolean;
  }>;
};
/**
 * Each swatch is deliberately six-digit hex. Core six colors are present in
 * every preset to preserve compatibility with the existing VectorTheme UI.
 */
export const ATLAS_STYLE_PRESETS:readonly AtlasPresetDefinition[]=[
  {
    id:"minimal-light",name:"Minimal Light",summary:"Quiet streets, airy neutrals.",
    family:"minimal",baseStyle:"positron",
    palette:{land:"#F7F7F5",water:"#DCE9EB",parks:"#E5EDE3",
      roads:"#FFFFFF",buildings:"#E9E9E6",labels:"#535B59",
      boundaries:"#BAC3BE",transit:"#929D9A",poi:"#66716B"},
    settings:{poiVisible:false,boundariesOpacity:.6}
  },
  {
    id:"minimal-dark",name:"Minimal Dark",summary:"Low-glare charcoal city.",
    family:"minimal",baseStyle:"dark",
    palette:{land:"#181C24",water:"#20394A",parks:"#253B32",
      roads:"#495665",buildings:"#303844",labels:"#E0E5EC",
      boundaries:"#677483",transit:"#8792A6",poi:"#B9C6D4"},
    settings:{poiVisible:false,boundariesOpacity:.6}
  },
  {
    id:"paper-ink",name:"Paper & Ink",summary:"Warm editorial atlas.",
    family:"editorial",baseStyle:"positron",
    palette:{land:"#F5F0E4",water:"#BFD9DD",parks:"#CEDDBE",
      roads:"#FFF9ED",buildings:"#DCD0BC",labels:"#45433D",
      boundaries:"#9D9484",transit:"#A18265",poi:"#997253"},
    settings:{roadsOpacity:.9,boundariesOpacity:.75}
  },
  {
    id:"pastel-city",name:"Pastel City",summary:"Lavender, mint and powder blue.",
    family:"expressive",baseStyle:"positron",
    palette:{land:"#F8F5FC",water:"#B8DDF3",parks:"#D2E9D3",
      roads:"#FFFFFF",buildings:"#E5DAF3",labels:"#54546F",
      boundaries:"#BDA9CF",transit:"#B498CB",poi:"#C28DB6"},
    settings:{buildingsOpacity:.92}
  },
  {
    id:"graphite-mono",name:"Graphite Mono",summary:"Neutral greys and ink-black labels.",
    family:"minimal",baseStyle:"positron",
    palette:{land:"#F5F5F4",water:"#D7D9DA",parks:"#E2E3E2",
      roads:"#FFFFFF",buildings:"#D0D2D3",labels:"#30343A",
      boundaries:"#969A9D",transit:"#81858B",poi:"#5C6268"},
    settings:{poiVisible:false,parksOpacity:.85}
  },
  {
    id:"blueprint",name:"Blueprint",summary:"Technical cartography in deep cobalt.",
    family:"expressive",baseStyle:"dark",
    palette:{land:"#102B4B",water:"#174366",parks:"#1E4B63",
      roads:"#80B9DD",buildings:"#2C5978",labels:"#E4F2FF",
      boundaries:"#7AACD4",transit:"#99D8E9",poi:"#B3DDEF"},
    settings:{buildingsOpacity:.72,boundariesOpacity:.85,majorRoadWidth:true}
  },
  {
    id:"electric-night",name:"Electric Night",summary:"Neon contrast on midnight streets.",
    family:"expressive",baseStyle:"dark",
    palette:{land:"#111622",water:"#1D3C65",parks:"#1B403B",
      roads:"#506A96",buildings:"#2F3854",labels:"#E4F0FF",
      boundaries:"#586EA5",transit:"#FFBF75",poi:"#FF90C8"},
    settings:{roadsOpacity:.92,majorRoadWidth:true}
  },
  {
    id:"terra",name:"Terra",summary:"Sand, clay and soft vegetation.",
    family:"editorial",baseStyle:"liberty",
    palette:{land:"#F6EDE0",water:"#B4D9D9",parks:"#D7DEB6",
      roads:"#FFF8ED",buildings:"#E3C7B0",labels:"#5D4C42",
      boundaries:"#BAA18D",transit:"#B08565",poi:"#B36C52"},
    settings:{boundariesOpacity:.72}
  },
  {
    id:"coastal",name:"Coastal",summary:"Sea-glass blues and fresh greens.",
    family:"editorial",baseStyle:"bright",
    palette:{land:"#EDF5F3",water:"#9ACBDC",parks:"#C5E5D5",
      roads:"#FFFFFF",buildings:"#D6E5E8",labels:"#284F5E",
      boundaries:"#9DBCC6",transit:"#568DA6",poi:"#408B91"},
    settings:{parksOpacity:.95}
  },
  {
    id:"high-contrast",name:"High Contrast",summary:"Bold roads and highly visible labels.",
    family:"utility",baseStyle:"dark",
    palette:{land:"#0B101A",water:"#1B527B",parks:"#28543A",
      roads:"#EAF2FA",buildings:"#435367",labels:"#FFFFFF",
      boundaries:"#D5E4F1",transit:"#F6CF6B",poi:"#FFAB66"},
    settings:{boundariesOpacity:1,labelsOpacity:1,majorRoadWidth:true}
  }
] as const;
export type AtlasPresetId=typeof ATLAS_STYLE_PRESETS[number]["id"];

const presetLookup=new Map(ATLAS_STYLE_PRESETS.map(p=>[p.id,p]));
export function getAtlasPreset(id:string):AtlasPresetDefinition{
  const value=presetLookup.get(id);
  if(!value)throw new Error("Unknown Atlas style preset: "+id);
  return value;
}
export function getAtlasPresetCoreColors(id:string):Record<CoreGroup,string>{
  const p=getAtlasPreset(id).palette;
  return {land:p.land,water:p.water,parks:p.parks,roads:p.roads,buildings:p.buildings,labels:p.labels};
}
function majorRoad(layer:StyleLayerDescriptor):boolean{
  if(layer.type!=="line"||layer.suggestedGroup!=="roads")return false;
  return /(?:^|[-_])(?:motorway|trunk|primary|highway)(?:$|[-_])/.test(layer.id.toLowerCase()) &&
    !/(?:casing|outline|bridge|tunnel|shield|label|symbol)/.test(layer.id.toLowerCase());
}
export function createAtlasPresetDocument(
  id:string,
  layers:readonly StyleLayerDescriptor[]=[]
):AtlasStyleDocument{
  const preset=getAtlasPreset(id);
  const doc=createEmptyStyleDocument(preset.id,preset.baseStyle,preset.name);
  for(const [group,color] of Object.entries(preset.palette)){
    doc.groups[group as StyleGroup]={color};
  }
  const settings=preset.settings;
  if(settings?.roadsOpacity!==undefined)doc.groups.roads={...doc.groups.roads,opacity:settings.roadsOpacity};
  if(settings?.parksOpacity!==undefined)doc.groups.parks={...doc.groups.parks,opacity:settings.parksOpacity};
  if(settings?.buildingsOpacity!==undefined)doc.groups.buildings={...doc.groups.buildings,opacity:settings.buildingsOpacity};
  if(settings?.labelsOpacity!==undefined)doc.groups.labels={...doc.groups.labels,opacity:settings.labelsOpacity};
  if(settings?.boundariesOpacity!==undefined)doc.groups.boundaries={...doc.groups.boundaries,opacity:settings.boundariesOpacity};
  if(settings?.poiVisible!==undefined)doc.groups.poi={...doc.groups.poi,visible:settings.poiVisible};
  // The inventory is intentionally exact-ID based; never extrapolate from an
  // arbitrary provider's layer naming if it has not been inspected.
  for(const layer of layers){
    const group=layer.suggestedGroup;
    if(!group)continue;
    (doc.bindings[group]??=[]).push(layer.id);
    if(settings?.majorRoadWidth && majorRoad(layer)){
      doc.layers[layer.id]={
        paint:{"line-width":["interpolate",["linear"],["zoom"],5,0.6,10,1.4,15,3.5,19,8]}
      };
    }
  }
  doc.metadata={
    preset:id,bindingMode:"suggested-review-required",
    note:"Features and exact layer matches depend on the provider's actual style."
  };
  const invalid=validateStyleDocument(doc).filter(d=>d.severity==="error");
  if(invalid.length)throw new Error("Invalid builtin preset: "+id);
  return doc;
}
