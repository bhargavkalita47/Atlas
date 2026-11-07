import {describe,expect,it} from "vitest";
import {ATLAS_STYLE_PRESETS,createAtlasPresetDocument} from "./presets";
import {ATLAS_DETAIL_PROFILE_VERSION,getAtlasPresetDetailSettings} from "./presetDetails";
import {compileAtlasStyle,inspectStyleLayers,validateStyleDocument} from "./index";
const style=()=>({
  version:8,sources:{osm:{type:"vector",url:"https://example.test/tiles.json"}},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#fff"}},
    {id:"road-primary",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#aaa","line-opacity":0.9}},
    {id:"road-residential",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#bbb","line-opacity":0.7}},
    {id:"water",type:"fill",source:"osm","source-layer":"water",paint:{"fill-color":"#aabbee"}},
    {id:"building",type:"fill",source:"osm","source-layer":"building",paint:{"fill-opacity":0.9}},
    {id:"place-label",type:"symbol",source:"osm","source-layer":"place",paint:{"text-halo-color":"#222222","text-halo-width":3,"text-halo-blur":2}},
    {id:"road-label",type:"symbol",source:"osm","source-layer":"transportation_name",paint:{"text-halo-width":2,"text-halo-blur":1}},
  ]
});
describe("Atlas 81 curated detail profiles v2",()=>{
  it("covers every shipped preset with bounded independently editable values",()=>{
    expect(ATLAS_STYLE_PRESETS.length).toBe(81);
    expect(ATLAS_DETAIL_PROFILE_VERSION).toBe(2);
    for(const preset of ATLAS_STYLE_PRESETS){
      const profile=getAtlasPresetDetailSettings(preset.id);
      expect(Object.values(profile.roads)).toHaveLength(5);
      expect(Object.values(profile.features)).toHaveLength(9);
      expect(Object.values(profile.roads).every(n=>n>=0&&n<=100)).toBe(true);
      expect(Object.values(profile.features).every(f=>f.opacity>=0&&f.opacity<=100)).toBe(true);
      profile.roads.local=0;
      expect(getAtlasPresetDetailSettings(preset.id).roads.local).not.toBe(0);
    }
  });
  it("gives meaningful differences to navigation, hiking and futuristic designs",()=>{
    const hiking=getAtlasPresetDetailSettings("hiking");
    const navigation=getAtlasPresetDetailSettings("navigation");
    const synthwave=getAtlasPresetDetailSettings("synthwave");
    expect(hiking.roads.paths).toBe(100);
    expect(hiking.roads.motorway).toBeLessThan(navigation.roads.motorway);
    expect(navigation.features.buildings.opacity).toBeLessThan(50);
    expect(synthwave.features.parks.opacity).toBeLessThan(50);
    expect(synthwave.roads.local).toBeLessThan(navigation.roads.local);
  });
  it("exports full per-preset detail settings and clear dark glyphs",()=>{
    const base=style(),layers=inspectStyleLayers(base);
    for(const preset of ATLAS_STYLE_PRESETS){
      const doc=createAtlasPresetDocument(preset.id,layers,{baseStyle:base});
      expect(validateStyleDocument(doc)).toEqual([]);
      const painted=compileAtlasStyle(base,doc).style;
      const texts=(painted.layers as unknown as Array<{id:string,paint?:Record<string,unknown>}>)
        .filter(layer=>layer.id==="place-label"||layer.id==="road-label");
      // Theme-specific outlines and glows are now authored by Stage 3.
      // No longer assume all dark themes have exactly the same halo.
      expect(texts.every(layer=>{
        const width=layer.paint?.["text-halo-width"];
        return typeof width==="number"&&Number.isFinite(width)&&width>=0;
      })).toBe(true);
      if(preset.id==="minimal-dark"||preset.id==="tokyo-neon"){
        expect(texts.every(layer=>layer.paint?.["text-halo-width"]===0)).toBe(true);
      }
      if(preset.id==="synthwave"){
        expect(texts.some(layer=>Number(layer.paint?.["text-halo-width"])>0)).toBe(true);
      }
      expect(doc.metadata?.presetDetailVersion).toBe(2);
    }
  });
  it("lets Studio exclude baked detail rules for a later custom overlay",()=>{
    const layers=inspectStyleLayers(style());
    const preset=createAtlasPresetDocument("minimal-dark",layers,{includeDetails:false});
    const normal=createAtlasPresetDocument("minimal-dark",layers);
    expect(preset.layers["road-residential"]?.paint?.["line-opacity"]).toBeUndefined();
    expect(normal.layers["road-residential"]?.paint?.["line-opacity"]).toBeDefined();
    expect(preset.layers["place-label"]?.paint?.["text-halo-width"]).toBe(0);
  });
});
