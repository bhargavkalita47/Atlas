import {
  type AtlasStyleDocument,type StyleGroup,type StyleLayerDescriptor,
  createEmptyStyleDocument,validateStyleDocument
} from "./index";
import {applyMapDetailControls} from "./detailControls";
import {getAtlasPresetDetailSettings,ATLAS_DETAIL_PROFILE_VERSION} from "./presetDetails";
import {applyAdvancedStyleControls} from "./advancedStyle";
import {getAtlasPresetAdvancedSettings,ATLAS_ADVANCED_PROFILE_VERSION} from "./presetAdvanced";
import {applySemanticFeatureControls} from "./semanticFeatures";
import {getAtlasPresetSemanticSettings,ATLAS_SEMANTIC_PROFILE_VERSION} from "./presetSemantic";

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
  readonly family:"minimal"|"editorial"|"expressive"|"utility"|"nature"|"travel"|"retro"|"futuristic";
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

// Curated companion themes: these are palette-and-rule variations over the
// four available vector styles, not extra tile providers or downloadable data.
type MoreSeed=readonly [
  id:string,name:string,summary:string,family:AtlasPresetDefinition["family"],
  baseStyle:BaseId,land:string,water:string,parks:string,roads:string,
  buildings:string,labels:string,accent:string
];
const ADDITIONAL_SEEDS:readonly MoreSeed[]=[
  ["snowfall","Snowfall","Snow-white streets and glacial blues","minimal","positron","#FAFBFC","#DCECF6","#E7F0ED","#FFFFFF","#E9EFF3","#354858","#91A8BB"],
  ["linen","Linen","Soft ivory and muted taupe","minimal","positron","#F7F3EA","#DCE7E5","#E5EADC","#FFFDF7","#E5DED1","#514C45","#B29E83"],
  ["mist","Morning Mist","Fog, stone and quiet green","minimal","positron","#EFF2F0","#CCDCE0","#DBE7DE","#FFFFFF","#DEE3E2","#45565A","#7C9C96"],
  ["porcelain","Porcelain","Gallery-white map with cool ink","minimal","positron","#FCFCFA","#DDE8EE","#E8EEE9","#FFFFFF","#E2E4EA","#273743","#859FB8"],
  ["ash-blue","Ash Blue","Desaturated blue and mineral grey","minimal","positron","#EEF1F5","#BED5E4","#D5E0DB","#FAFCFF","#D6DCE5","#3E5265","#6D88A7"],
  ["carbon","Carbon","Almost-black minimal street atlas","minimal","dark","#13171B","#283A47","#263530","#4C555F","#292F35","#E4E7E9","#8798A2"],
  ["chalkboard","Chalkboard","Dark chalk and cream contours","minimal","dark","#1C2528","#334A50","#30483B","#70817D","#3A4340","#F0EADC","#B6BAA6"],
  ["paper-slate","Paper Slate","Warm grey surfaces and precise roads","minimal","positron","#F0EFEC","#D4DFE3","#DEE3D9","#FAF9F6","#D8D9D4","#45494B","#90979D"],
  ["newspaper","Newspaper","Ink-black lettering on newsprint","editorial","positron","#EEE8DC","#CDD9D8","#D7DDCC","#F7F1E6","#D2C7B7","#292726","#A65E4A"],
  ["museum","Museum","Precise architectural neutral palette","editorial","liberty","#F5F2ED","#C9D8DB","#E0E6DC","#FFFFFF","#D6CDC5","#3C4145","#8D9CA3"],
  ["architectural","Architectural","Blueprint details on off-white","editorial","liberty","#F7F7F2","#C3D3E4","#E5EAD9","#FFFFFF","#D1D4D7","#1C3448","#597F9D"],
  ["old-atlas","Old Atlas","Antique parchment with muted terrain","editorial","liberty","#EFE3C5","#AEC7C7","#D2D6AE","#F6EBD2","#D5C19E","#5E4C38","#8C7456"],
  ["alabaster","Alabaster","Elegant pale stone and warm ink","editorial","positron","#FCF8F0","#D5E0DA","#DFE3CE","#FFFFFF","#E1D7C9","#50483C","#A89B87"],
  ["burgundy-print","Burgundy Print","Wine-ink accents and cream canvas","editorial","positron","#F6EDEB","#CCDCE0","#E1DDD0","#FCF7F5","#DFC9C8","#51353F","#9B5367"],
  ["night-editorial","Night Editorial","Smoky navy with pale type","editorial","dark","#24252D","#364A55","#343E39","#66636B","#45414B","#F5EDE8","#B5A3A7"],
  ["cartographer","Cartographer","Traditional scholarly map language","editorial","liberty","#EDE9DA","#B8CFD6","#D5DCC6","#F9F6E9","#D6C9B6","#414842","#A77D61"],
  ["evergreen","Evergreen","Deep woodland and jade waterways","nature","dark","#172923","#244B4D","#36553C","#5E7B6F","#2D4033","#E8EEE1","#8AB497"],
  ["alpine","Alpine","Mountain snow with pine green","nature","liberty","#EDF0EA","#BFD8E8","#AEC7AF","#FFFDFB","#D4DBD3","#3E5451","#6F9A8B"],
  ["forest-floor","Forest Floor","Rich moss, bark and rain","nature","liberty","#EAE6D9","#91B9AF","#BCC5A0","#F5F1E7","#CDBEA6","#4E5644","#8A755C"],
  ["meadow","Meadow","Fresh grass and sunlit streams","nature","bright","#F0F5E5","#B4DDE4","#CAE7B0","#FFFFF0","#DFE7CE","#475A46","#8CA95D"],
  ["spring-bloom","Spring Bloom","Blossoms against leaf-green parks","nature","bright","#FCF4F3","#C1E4E8","#D3E7C6","#FFFFFF","#F1D7DE","#65565B","#D787A6"],
  ["river-basin","River Basin","Wide water and reed-lined banks","nature","liberty","#E5F0E9","#8FC8D3","#AED8C0","#F7FBF6","#C7E1D5","#2E5962","#579FAD"],
  ["desert-sands","Desert Sands","Open dunes and warm clay paths","nature","liberty","#F3E1BE","#A7D1DA","#D8D6A9","#FFF3D9","#D9BC91","#70543C","#C48861"],
  ["savanna","Savanna","Sun-gold grass and earthy roads","nature","bright","#F3E8CD","#BED6C8","#CDD6A0","#FFF9E7","#DFCFAB","#685541","#AF8D4D"],
  ["coral-reef","Coral Reef","Lagoon turquoise with coral details","nature","bright","#EAF8F3","#68C5D5","#C2E9D9","#FAFFFC","#DBE8DD","#23576B","#E88A79"],
  ["tundra","Tundra","Subarctic mineral palette","nature","positron","#EDF0EB","#C6DFE8","#D2DDCE","#FFFFFF","#D9E2DF","#3E545D","#8EAAB4"],
  ["mediterranean","Mediterranean","Azure coast and terracotta towns","travel","bright","#F8F0DA","#8AC7EA","#D3E1BC","#FFFCF2","#E8C7AE","#486170","#D88B68"],
  ["nordic-fjord","Nordic Fjord","Fjord blue and spruce forests","travel","liberty","#E9EEF1","#A4C4D5","#BACFC4","#FCFCFB","#D3DCE0","#384E64","#7398A9"],
  ["tokyo-neon","Tokyo Neon","Ultraviolet city after dark","travel","dark","#15152D","#303D75","#2D4F48","#6D5EA0","#3B3560","#F5DAF8","#EF77DE"],
  ["kyoto-washi","Kyoto Washi","Rice paper and bamboo greens","travel","positron","#F3EEE2","#CADBD6","#C5D6B2","#FFF8EE","#E0D2BB","#544E44","#A65D4C"],
  ["sahara-trek","Sahara Trek","Saffron dunes and desert shadows","travel","liberty","#F3DEBC","#AFC6CB","#D9CF9B","#FCF1DD","#E6BD85","#68513B","#C98C40"],
  ["himalayan","Himalayan","Snow, slate and cedar","travel","liberty","#EFF3F4","#B4D5E5","#CCD9CB","#FFFFFF","#D8E2E5","#395669","#7EA3AE"],
  ["indian-monsoon","Indian Monsoon","Storm cloud blues and rain greens","travel","bright","#E8F0E9","#8BBBD3","#BCD5B8","#F8FAF5","#D3E2DA","#31566C","#557FA1"],
  ["tropical-island","Tropical Island","Palm greens and ocean aquamarine","travel","bright","#EFF8E6","#6FCAD4","#A9E0BC","#FFFDF2","#D8E8D1","#245A62","#3DA8A7"],
  ["arctic-ice","Arctic Ice","Frozen blue and polar whites","travel","positron","#F4F9FD","#ABD9F2","#DFEAEC","#FFFFFF","#E0EDF3","#37566B","#81B7D4"],
  ["sepia-archive","Sepia Archive","Historic map in old photograph sepia","retro","liberty","#EEE0C6","#BCB49F","#C7C9AB","#F7E9CF","#D1BA95","#5D4734","#987252"],
  ["vintage-road","Vintage Road","Classic highway atlas hues","retro","liberty","#F7E5C8","#AACCD6","#CED5A9","#FFF9E7","#E6CBA7","#514D44","#D0785B"],
  ["seventies-orange","Seventies Orange","Burnt orange and avocado green","retro","bright","#F3DEC0","#ADC8B9","#B9C69C","#FBF0D2","#E4BE91","#654E37","#DC8245"],
  ["eighties-grid","Eighties Grid","Retro cyan and violet city lines","retro","dark","#211A3C","#304F75","#2D504D","#966DC2","#413264","#F3D9FF","#FF84CA"],
  ["film-noir","Film Noir","Deep shadow and silver roads","retro","dark","#15161B","#323C4A","#303836","#7D838B","#44474F","#F2EFEB","#B5BEC8"],
  ["analog-crt","Analog CRT","Amber phosphor dark-mode maps","retro","dark","#201E1B","#41392F","#38402E","#8D7345","#3C352B","#F5DAAA","#DCA65B"],
  ["art-deco","Art Deco","Gold geometric accents on ink","retro","dark","#1E2834","#354E56","#34443C","#AE9562","#3E4A53","#F8E6BD","#D1AF66"],
  ["arcade","Arcade","Playful retro arcade neon","retro","dark","#1D2037","#2D4C6F","#30514B","#D16DB3","#483B62","#FFF0B8","#FABA4B"],
  ["cyberpunk","Cyberpunk","Electric magenta and cyan downtown","futuristic","dark","#141528","#205575","#1A4945","#46C9DD","#35325A","#F6E6FF","#FF64C8"],
  ["synthwave","Synthwave","Neon sunset over midnight grid","futuristic","dark","#211332","#324B86","#3A365A","#CF70C6","#5A3F74","#FFDFD9","#F99161"],
  ["terminal","Terminal","Monochrome terminal green on charcoal","futuristic","dark","#0D1E1A","#23534D","#1B4B32","#5ABF8B","#1F392C","#CFFFE3","#76E6AA"],
  ["hologram","Hologram","Translucent icy blue interface","futuristic","dark","#10243B","#1D507A","#254E55","#7CC6EC","#30556E","#F0F8FF","#8FE0FF"],
  ["obsidian","Obsidian","Dark stone and subdued metallic violet","futuristic","dark","#15151D","#373348","#323A3F","#696E88","#363544","#E8E5F2","#ACA2CF"],
  ["data-grid","Data Grid","Precise cobalt and teal detail","futuristic","dark","#10233B","#20516E","#24534C","#6BB3D2","#2A4B62","#E6F6FF","#61D2C2"],
  ["quantum-cyan","Quantum Cyan","Iridescent deep-sea technicity","futuristic","dark","#0D1F2A","#17596B","#27504C","#42BFD2","#27495B","#E0FBFF","#56DDC8"],
  ["circuit-board","Circuit Board","Emerald circuits and muted earth","futuristic","dark","#122A28","#235F57","#255643","#62A493","#2E5046","#E1F4EC","#8ACBA7"],
  ["navigation","Navigation","Bright routes and readable hierarchy","utility","bright","#F5F7F8","#BCDCE9","#D3E7D6","#FFFFFF","#E2E7E9","#263B4B","#267EC1"],
  ["transit-map","Transit Map","Transit blue and clean legibility","utility","bright","#F3F6FA","#CAE0EF","#D5E5DF","#FFFFFF","#DFE4EB","#283F63","#376DAE"],
  ["hiking","Hiking","Woodland trails and terrain-friendly tones","utility","liberty","#F1F0E5","#BBD4D4","#C8D8AF","#FFFDF4","#DCD7C9","#485D48","#729461"],
  ["cycling","Cycling","Mint routes and clear urban streets","utility","bright","#F2F9F5","#BEDFDE","#CBE9D3","#FFFFFF","#DBE7E3","#2A5350","#40A585"],
  ["emergency","Emergency","High-visibility roads and alerts","utility","bright","#F7F7F3","#B7D8E5","#D6E7D3","#FFFFFF","#DAE0E1","#222B35","#D25145"],
  ["maritime","Maritime","Navy hydrographic chart aesthetic","utility","bright","#E6F1F4","#88BFD9","#D8E7DC","#FAFFFF","#CDDCE4","#244B64","#3B7D9D"],
  ["aviation","Aviation","Air navigation blue, grey and yellow","utility","bright","#F4F6F3","#CEE3ED","#DFE8DE","#FFFFFF","#E2E5EA","#314860","#E4AC51"],
  ["survey","Survey","Precise boundary-first map palette","utility","liberty","#F1F0EC","#D1DEE1","#E2E4D7","#FFFFFF","#DAD8D1","#2E3A42","#B06B4C"],
  ["accessibility-light","Accessible Light","High-value contrast on light paper","utility","positron","#FFFFFF","#C3E0EB","#CEE5D2","#FFFFFF","#CDD3D7","#1B2933","#1F6693"],
  ["accessibility-dark","Accessible Dark","Light labels and strong edges on dark","utility","dark","#10161C","#244A60","#29543B","#D4DDE5","#3C4A55","#FFFFFF","#F1B65E"],
  ["candy","Candy","Confectionery pink and cyan colours","expressive","bright","#FFF1FA","#B8E8F6","#D7EAC8","#FFFFFF","#F4D1E9","#7D4E75","#EF93C4"],
  ["bubblegum","Bubblegum","Bubblegum pink and powder lavender","expressive","bright","#FCF0FA","#C4E6F3","#E2ECD8","#FFFFFF","#EED3F0","#75536F","#E697CD"],
  ["sakura","Sakura","Rose petals and cool rivers","expressive","bright","#FFF4F7","#D2E4ED","#D8E8D5","#FFFFFF","#F1D6E4","#725C67","#E4A0BC"],
  ["lavender-fields","Lavender Fields","Purple shadows and mint grass","expressive","positron","#F6F2FC","#BFD9EF","#D6E2D0","#FFFFFF","#DED6F1","#5C5573","#9D85CE"],
  ["sunset-city","Sunset City","Apricot, coral and ocean blue","expressive","bright","#FFF2E9","#A9D5E9","#DBE2BC","#FFFFFF","#F5D0BF","#765044","#E4846D"],
  ["festival","Festival","Bright pops of colour for events","expressive","bright","#FAF6F0","#9FD8E8","#CAE6C2","#FFFFFF","#EAD5E7","#4F4659","#DD7C78"],
  ["midnight-violet","Midnight Violet","Purple midnight city atmosphere","expressive","dark","#231934","#353A75","#36564C","#7764B5","#4A3965","#F6EEFF","#C596EA"],
  ["peach","Peach","Warm peach cobblestones and blue water","expressive","positron","#FFF5EC","#C4DDE6","#DBE8CE","#FFFFFF","#F4DED4","#71584D","#ECA784"],
  ["mint-pop","Mint Pop","Fresh turquoise and pale mint outlines","expressive","bright","#EFFCF8","#A7E2E2","#BEE9D7","#FFFFFF","#D2EBE7","#346D65","#62BEAB"],
  ["solar-flare","Solar Flare","Hot amber and burnt copper on dark","expressive","dark","#282018","#4A4C4A","#414E36","#B68A56","#4D3B2D","#FFF1D6","#F5A75F"],
];
const ADDITIONAL_PRESETS:readonly AtlasPresetDefinition[]=ADDITIONAL_SEEDS.map(
  ([id,name,summary,family,baseStyle,land,water,parks,roads,buildings,labels,accent])=>({
    id,name,summary,family,baseStyle,
    palette:{land,water,parks,roads,buildings,labels,boundaries:accent,transit:accent,poi:accent},
    settings:family==="minimal"?{poiVisible:false,boundariesOpacity:.7}:
      family==="utility"?{boundariesOpacity:.85,majorRoadWidth:/^(navigation|transit-map|emergency|accessibility-)/.test(id)}:
      family==="futuristic"?{buildingsOpacity:.82,majorRoadWidth:true}:undefined,
  })
);

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
  },
  ...ADDITIONAL_PRESETS
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
export type AtlasPresetDocumentOptions={
  /** Exclude the curated detail defaults for a custom Studio overlay. */
  includeDetails?:boolean;
  /** When available, retain a provider's original opacity expressions. */
  baseStyle?:unknown;
};
export function createAtlasPresetDocument(
  id:string,
  layers:readonly StyleLayerDescriptor[]=[],
  options:AtlasPresetDocumentOptions={}
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
    // Dark-map glyphs are intentionally crisp: no outline and no blur.
    // Neutralize source provider halos for text-bearing symbols, including
    // any labels whose heuristic semantic group is unknown.
    if(preset.baseStyle==="dark"&&layer.type==="symbol"){
      const before=doc.layers[layer.id]??{};
      doc.layers[layer.id]={...before,paint:{...before.paint,
        "text-halo-width":0,"text-halo-blur":0,
        "text-halo-color":"rgba(0, 0, 0, 0)"
      }};
    }
  }
  doc.metadata={
    preset:id,presetDetailVersion:ATLAS_DETAIL_PROFILE_VERSION,
    presetAdvancedVersion:ATLAS_ADVANCED_PROFILE_VERSION,
    presetSemanticVersion:ATLAS_SEMANTIC_PROFILE_VERSION,
    bindingMode:"suggested-review-required",
    note:"Features and exact layer matches depend on the provider's actual style."
  };
  const invalid=validateStyleDocument(doc).filter(d=>d.severity==="error");
  if(invalid.length)throw new Error("Invalid builtin preset: "+id);
  // Built-in preset documents are complete and portable by default.
  // Atlas Lab uses includeDetails:false, then applies the selected profile
  // and any manual sparse overrides once against its live provider base.
  if(options.includeDetails===false)return doc;
  const details=applyMapDetailControls(doc,layers,getAtlasPresetDetailSettings(id),options.baseStyle);
  const advanced=applyAdvancedStyleControls(details,layers,getAtlasPresetAdvancedSettings(id),options.baseStyle);
  return applySemanticFeatureControls(advanced,layers,getAtlasPresetSemanticSettings(id),options.baseStyle);
}
