import {describe,it,expect} from "vitest";
import {ATLAS_STYLE_PRESETS,createAtlasPresetDocument} from "./presets";
import {reskinAtlasPreset} from "./palette";
import {getAtlasPresetAdvancedSettings,createAdvancedOverrides,
  mergeAdvancedOverrides,deriveAdvancedOverrides,ATLAS_ADVANCED_PROFILE_VERSION
} from "./presetAdvanced";
import {validateAdvancedStyleSettings,applyAdvancedStyleControls} from "./advancedStyle";
import {createEmptyStyleDocument,compileAtlasStyle,inspectStyleLayers,validateStyleDocument} from "./index";
const provider={
  version:8,
  sources:{osm:{type:"vector",url:"https://example.org/roads.json"}},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#ffffff"}},
    {id:"road-primary",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#ffffff","line-width":3}},
    {id:"road-secondary",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#eeeeee","line-opacity":1}},
    {id:"road-residential",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#eeeeee"}},
    {id:"road-path",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#aaaaaa"}},
    {id:"city-label",type:"symbol",source:"osm","source-layer":"place",
      layout:{"text-field":["get","name"],"text-font":["Noto Sans Regular"],"text-size":15},
      paint:{"text-color":"#333333","text-halo-width":2}},
    {id:"road-name",type:"symbol",source:"osm","source-layer":"transportation_name",
      layout:{"text-field":["get","name"],"text-size":13,"text-font":["Noto Sans Regular"]}},
    {id:"poi-shop",type:"symbol",source:"osm","source-layer":"poi",
      layout:{"text-field":["get","name"],"text-size":13,"text-font":["Noto Sans Regular"]}},
    {id:"building-fill",type:"fill",source:"osm","source-layer":"building",paint:{"fill-color":"#dddddd"}}
  ]
};
type L={id:string,paint?:Record<string,unknown>,layout?:Record<string,unknown>,minzoom?:number};
const layer=(style:Record<string,unknown>,id:string)=>(style.layers as unknown as L[]).find(x=>x.id===id)!;
describe("All 81 cartographic presets v3",()=>{
  it("has a valid and independent advanced design profile for every preset",()=>{
    expect(ATLAS_STYLE_PRESETS.length).toBe(81);
    expect(ATLAS_ADVANCED_PROFILE_VERSION).toBe(3);
    const fingerprints=new Set<string>();
    for(const preset of ATLAS_STYLE_PRESETS){
      const profile=getAtlasPresetAdvancedSettings(preset.id);
      expect(validateAdvancedStyleSettings(profile)).toEqual([]);
      expect(Object.values(profile.roads)).toHaveLength(5);
      expect(Object.values(profile.labels)).toHaveLength(4);
      expect(Object.values(profile.features)).toHaveLength(9);
      expect(profile.roads.primary.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(profile.labels.city.color).toMatch(/^#[0-9A-F]{6}$/);
      fingerprints.add(JSON.stringify(profile));
      const another=getAtlasPresetAdvancedSettings(preset.id);
      another.roads.primary.width=24;
      expect(getAtlasPresetAdvancedSettings(preset.id).roads.primary.width).not.toBe(24);
    }
    expect(fingerprints.size).toBe(81);
  });
  it("preserves intended differences between navigation, hiking, minimal and futuristic themes",()=>{
    const nav=getAtlasPresetAdvancedSettings("navigation");
    const hike=getAtlasPresetAdvancedSettings("hiking");
    const minimal=getAtlasPresetAdvancedSettings("minimal-light");
    const neon=getAtlasPresetAdvancedSettings("synthwave");
    expect(nav.roads.primary.width!).toBeGreaterThan(hike.roads.primary.width!);
    expect(nav.labels.road.sizeScale!).toBeGreaterThan(hike.labels.road.sizeScale!);
    expect(hike.roads.paths.dash).toBe("dashed");
    expect(hike.roads.paths.width!).toBeGreaterThan(nav.roads.paths.width!);
    expect(minimal.roads.local.zoom.min).toBeGreaterThan(nav.roads.local.zoom.min!);
    expect(neon.labels.city.spacing!).toBeGreaterThan(minimal.labels.city.spacing!);
  });
  it("custom palettes recolour the advanced road and label hierarchy, never retaining stale colours",()=>{
    const layers=inspectStyleLayers(provider);
    const inputs=["#102030","#4a88cc","#66b788","#edc28c","#e584b0"];
    const original=createAtlasPresetDocument("blueprint",layers,{baseStyle:provider});
    const recoloured=reskinAtlasPreset("blueprint",inputs,layers,{baseStyle:provider});
    const oldRoad=original.layers["road-secondary"]?.paint?.["line-color"];
    const newRoad=recoloured.layers["road-secondary"]?.paint?.["line-color"];
    expect(newRoad).not.toEqual(oldRoad);
    expect(recoloured.layers["city-label"]?.paint?.["text-color"])
      .toBe(recoloured.groups.labels?.color);
    expect(recoloured.layers["road-secondary"]?.paint?.["line-width"]).toBeDefined();
    expect(validateStyleDocument(recoloured)).toEqual([]);
  });
  it("keeps sparse manual edits after preset switches while untouched properties follow each theme",()=>{
    const starting=getAtlasPresetAdvancedSettings("minimal-light");
    const wanted=JSON.parse(JSON.stringify(starting)) as typeof starting;
    wanted.roads.secondary.color="#993355";
    wanted.roads.local.zoom.min=17;
    wanted.labels.city.spacing=.12;
    const overrides=deriveAdvancedOverrides(starting,wanted);
    expect(overrides.roads.secondary?.color).toBe("#993355");
    expect(overrides.roads.local?.zoom?.min).toBe(17);
    expect(overrides.labels.city?.spacing).toBe(.12);
    const navigation=getAtlasPresetAdvancedSettings("navigation");
    const merged=mergeAdvancedOverrides(navigation,overrides);
    expect(merged.roads.secondary.color).toBe("#993355");
    expect(merged.roads.local.zoom.min).toBe(17);
    expect(merged.labels.city.spacing).toBe(.12);
    expect(merged.roads.primary.width).toBe(navigation.roads.primary.width);
    expect(merged.labels.road.sizeScale).toBe(navigation.labels.road.sizeScale);
    const restored=mergeAdvancedOverrides(navigation,createAdvancedOverrides());
    expect(restored).toEqual(navigation);
    expect(starting.roads.secondary.color).not.toBe("#993355");
  });
  it("compiles preset-authored road, label and zoom rules without mutating the provider",()=>{
    const original=JSON.stringify(provider),layers=inspectStyleLayers(provider);
    for(const id of ["minimal-light","hiking","navigation","synthwave","accessibility-dark"]){
      const doc=createAtlasPresetDocument(id,layers,{baseStyle:provider});
      expect(validateStyleDocument(doc)).toEqual([]);
      const output=compileAtlasStyle(provider,doc).style;
      expect(layer(output,"road-primary").paint?.["line-color"]).toBeDefined();
      expect(layer(output,"road-primary").paint?.["line-width"]).toBeDefined();
      expect(layer(output,"city-label").layout?.["text-size"]).toBeDefined();
      expect(layer(output,"road-residential").minzoom).toBeGreaterThanOrEqual(10);
      if(id==="accessibility-dark"){
        expect(layer(output,"city-label").paint?.["text-halo-width"]).toBe(0);
      }
    }
    expect(JSON.stringify(provider)).toBe(original);
  });
  it("can apply just the advanced overlay to a hand-authored map document",()=>{
    const doc=createEmptyStyleDocument("test","positron");
    doc.groups.land={color:"#cccccc"};
    const source=JSON.stringify(doc);
    const styled=applyAdvancedStyleControls(doc,inspectStyleLayers(provider),
      getAtlasPresetAdvancedSettings("navigation"),provider);
    expect(styled.layers["road-primary"]).toBeDefined();
    expect(styled.groups.land?.color).toBe("#cccccc");
    expect(JSON.stringify(doc)).toBe(source);
  });
});
