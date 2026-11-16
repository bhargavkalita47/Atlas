import {describe,expect,it} from "vitest";
import {
  CIVICWATCH_STYLE_PRESETS,ATLAS_STYLE_PRESETS,getAtlasPreset,
  createAtlasPresetDocument
} from "./presets";
import {contrastRatio} from "./palette";
import {getAtlasPresetDetailSettings} from "./presetDetails";
import {getAtlasPresetAdvancedSettings} from "./presetAdvanced";
import {getAtlasPresetSemanticSettings} from "./presetSemantic";
import {compileAtlasStyle,inspectStyleLayers,validateStyleDocument} from "./index";

const ids=[
  "civicwatch-lavender",
  "civicwatch-coral-paper",
  "civicwatch-clear-streets",
  "civicwatch-night-teal"
] as const;
const provider=()=>({
  version:8,
  sources:{osm:{type:"vector",url:"https://example.test/tiles.json"}},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#FFFFFF"}},
    {id:"water",type:"fill",source:"osm","source-layer":"water",paint:{"fill-color":"#BBEEDD"}},
    {id:"park",type:"fill",source:"osm","source-layer":"landuse",paint:{"fill-color":"#CCEEDD"}},
    {id:"building",type:"fill",source:"osm","source-layer":"building",paint:{"fill-color":"#DDEEFF"}},
    {id:"road-primary",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#DDDDDD"}},
    {id:"road-residential",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#EEEEEE"}},
    {id:"place-label",type:"symbol",source:"osm","source-layer":"place",
      layout:{"text-field":["get","name"]},paint:{"text-color":"#111111"}},
    {id:"poi-icon",type:"symbol",source:"osm","source-layer":"poi",
      layout:{"text-field":["get","name"]},paint:{"text-color":"#111111"}}
  ]
});
describe("CivicWatch Atlas companion styles",()=>{
  it("provides four discoverable unique presets in the main gallery",()=>{
    expect(CIVICWATCH_STYLE_PRESETS.map(p=>p.id)).toEqual([...ids]);
    expect(ATLAS_STYLE_PRESETS.slice(0,4)).toEqual(CIVICWATCH_STYLE_PRESETS);
    expect(ATLAS_STYLE_PRESETS).toHaveLength(85);
    expect(new Set(ATLAS_STYLE_PRESETS.map(p=>p.id)).size).toBe(85);
    for(const id of ids){
      const p=getAtlasPreset(id);
      expect(p.collection).toBe("civicwatch");
      expect(p.name).toMatch(/^CivicWatch /);
      expect(Object.values(p.palette).every(c=>/^#[A-F0-9]{6}$/i.test(c))).toBe(true);
    }
  });
  it("retains readable land labels and reserves prominence for separate report pins",()=>{
    for(const id of ids){
      const p=getAtlasPreset(id);
      expect(contrastRatio(p.palette.labels,p.palette.land),id).toBeGreaterThanOrEqual(7);
      expect(getAtlasPresetDetailSettings(id).features.poi.visible).toBe(false);
      expect(getAtlasPresetAdvancedSettings(id).labels.poi.visible).toBe(false);
      const semantic=getAtlasPresetSemanticSettings(id);
      expect(semantic.poiShopping.visible).toBe(false);
      expect(semantic.poiFood.visible).toBe(false);
    }
    expect(getAtlasPreset("civicwatch-night-teal").baseStyle).toBe("dark");
    expect(getAtlasPreset("civicwatch-lavender").baseStyle).toBe("positron");
  });
  it("compiles all four against actual inspected layers without changing sources",()=>{
    const style=provider(),before=JSON.stringify(style);
    const layers=inspectStyleLayers(style);
    for(const id of ids){
      const doc=createAtlasPresetDocument(id,layers,{baseStyle:style});
      expect(validateStyleDocument(doc),id).toEqual([]);
      expect(doc.bindings.roads).toContain("road-primary");
      expect(doc.bindings.labels).toContain("place-label");
      const result=compileAtlasStyle(style,doc);
      expect(result.style.version).toBe(8);
      expect(result.style.sources).toEqual(style.sources);
      expect(result.changedLayerIds).toContain("background");
      expect((result.style.layers as unknown[]).length).toBe(style.layers.length);
    }
    expect(JSON.stringify(style)).toBe(before);
  });
  it("gives Clear Streets more local detail than Lavender",()=>{
    const streets=getAtlasPresetDetailSettings("civicwatch-clear-streets");
    const lavender=getAtlasPresetDetailSettings("civicwatch-lavender");
    expect(streets.roads.local).toBeGreaterThan(lavender.roads.local);
    expect(streets.features.roadLabels.opacity).toBeGreaterThan(lavender.features.roadLabels.opacity);
    expect(getAtlasPresetAdvancedSettings("civicwatch-clear-streets").labels.road.sizeScale)
      .toBeGreaterThan(getAtlasPresetAdvancedSettings("civicwatch-lavender").labels.road.sizeScale);
  });
});
