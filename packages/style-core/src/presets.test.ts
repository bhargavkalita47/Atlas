import {describe,expect,it} from "vitest";
import {
  ATLAS_STYLE_PRESETS,createAtlasPresetDocument,getAtlasPreset,
  getAtlasPresetCoreColors
} from "./presets";
import {
  compileAtlasStyle,inspectStyleLayers,stringifyAtlasStyleDocument,
  parseAtlasStyleDocument,validateStyleDocument
} from "./index";

const base=()=>({
  version:8,sources:{osm:{type:"vector",url:"https://example.org/tiles.json"}},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#ffffff"}},
    {id:"water-main",type:"fill",source:"osm","source-layer":"water",paint:{"fill-color":"#def"}},
    {id:"park-nature",type:"fill",source:"osm","source-layer":"landuse",paint:{"fill-color":"#abc"}},
    {id:"road-primary",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#ccc","line-width":3}},
    {id:"road-residential",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#aaa","line-width":2}},
    {id:"building",type:"fill",source:"osm","source-layer":"building",paint:{"fill-color":"#eee"}},
    {id:"place-label",type:"symbol",source:"osm","source-layer":"place",paint:{"text-color":"#111"}},
    {id:"poi-icon",type:"symbol",source:"osm","source-layer":"poi",paint:{"text-color":"#555"}}
  ]
});
describe("Atlas preset catalog",()=>{
  it("is diverse, unique, valid and fully six-color backed",()=>{
    expect(ATLAS_STYLE_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ATLAS_STYLE_PRESETS.map(p=>p.id)).size).toBe(ATLAS_STYLE_PRESETS.length);
    for(const preset of ATLAS_STYLE_PRESETS){
      expect(["positron","liberty","dark","bright"]).toContain(preset.baseStyle);
      expect(Object.values(getAtlasPresetCoreColors(preset.id))).toHaveLength(6);
      expect(Object.values(getAtlasPresetCoreColors(preset.id)).every(c=>/^#[0-9a-f]{6}$/i.test(c))).toBe(true);
      const doc=createAtlasPresetDocument(preset.id);
      expect(validateStyleDocument(doc)).toEqual([]);
      expect(doc.layers).toEqual({});
    }
  });
  it("preserves strict style JSON roundtrip and never mutates fixture",()=>{
    const style=base();
    const frozen=JSON.stringify(style);
    for(const preset of ATLAS_STYLE_PRESETS){
      const doc=createAtlasPresetDocument(preset.id,inspectStyleLayers(style));
      const compiled=compileAtlasStyle(style,doc);
      expect(JSON.stringify(style)).toBe(frozen);
      expect(compiled.style.version).toBe(8);
      expect(compiled.changedLayerIds).toContain("background");
      expect(stringifyAtlasStyleDocument(parseAtlasStyleDocument(stringifyAtlasStyleDocument(doc))))
        .toBe(stringifyAtlasStyleDocument(doc));
    }
  });
  it("uses semantic opacity and POI visibility only on matching layers",()=>{
    const doc=createAtlasPresetDocument("minimal-light",inspectStyleLayers(base()));
    expect(doc.groups.poi?.visible).toBe(false);
    expect(doc.bindings.poi).toEqual(["poi-icon"]);
    const compiled=compileAtlasStyle(base(),doc);
    const layers=compiled.style.layers as unknown as Array<{id:string,layout?:{visibility?:string}}>;
    expect(layers.find(l=>l.id==="poi-icon")?.layout?.visibility).toBe("none");
    expect(layers.find(l=>l.id==="place-label")?.layout?.visibility).toBeUndefined();
  });
  it("uses zoom-aware widths selectively for prominent roads",()=>{
    const doc=createAtlasPresetDocument("blueprint",inspectStyleLayers(base()));
    expect(doc.layers["road-primary"]?.paint?.["line-width"]).toEqual(["interpolate",["linear"],["zoom"],5,0.6,10,1.4,15,3.5,19,8]);
    expect(doc.layers["road-residential"]?.paint?.["line-opacity"]).toBeDefined();
    const compiled=compileAtlasStyle(base(),doc);
    const layers=compiled.style.layers as unknown as Array<{id:string,paint?:Record<string,unknown>}>;
    expect(layers.find(l=>l.id==="road-primary")?.paint?.["line-width"]).toEqual(doc.layers["road-primary"]?.paint?.["line-width"]);
  });
  it("recreates a fresh independent document every time",()=>{
    const doc=createAtlasPresetDocument("pastel-city",inspectStyleLayers(base()));
    doc.groups.water!.color="#000000";
    doc.layers["road-primary"]={paint:{"line-color":"#123456"}};
    const second=createAtlasPresetDocument("pastel-city",inspectStyleLayers(base()));
    expect(second.groups.water?.color).not.toBe("#000000");
    expect(second.layers["road-primary"]?.paint?.["line-color"]).not.toBe("#123456");
  });
  it("rejects unknown IDs instead of returning a wrong preset",()=>{
    expect(()=>getAtlasPreset("not-real")).toThrow("Unknown Atlas style preset");
  });
});
