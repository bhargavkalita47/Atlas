import {describe,expect,it} from "vitest";
import {
  MINIMAL_LIGHT_PALETTE,STYLE_DOCUMENT_VERSION,compileAtlasStyle,createEmptyStyleDocument,
  createMinimalLightDocument,inspectStyleLayers,migrateLegacyColorTheme,
  parseAtlasStyleDocument,stringifyAtlasStyleDocument,validateStyleDocument,
} from "./index";

const base = () => ({
  version:8,
  name:"example",
  glyphs:"https://example.org/{fontstack}/{range}.pbf",
  sources:{osm:{type:"vector",url:"https://example.org/tiles.json"}},
  customProperty:{arbitrary:["retained",42]},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#c0c0c0"}},
    {id:"natural-water",type:"fill",source:"osm","source-layer":"water",paint:{"fill-color":"#0000ff"}},
    {id:"road-main",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":["get","colour"],"line-width":2}},
    {id:"place-city-label",type:"symbol",source:"osm","source-layer":"place",layout:{"text-field":["get","name"]},paint:{"text-color":"#222222"}},
    {id:"unknown",type:"fill",source:"osm","source-layer":"custom",paint:{"fill-pattern":"dots"}},
  ]
});
describe("style-core v2",()=>{
  it("exports a versioned, renderer-independent contract",()=>{
    expect(STYLE_DOCUMENT_VERSION).toBe(2);
    expect(Object.keys(MINIMAL_LIGHT_PALETTE)).toContain("roadOutline");
  });
  it("only suggests categorisation and does not discard unmapped layers",()=>{
    const layers=inspectStyleLayers(base());
    expect(layers.find(l=>l.id==="natural-water")?.suggestedGroup).toBe("water");
    expect(layers.find(l=>l.id==="road-main")?.suggestedGroup).toBe("roads");
    expect(layers.find(l=>l.id==="unknown")?.suggestedGroup).toBe(null);
    expect(layers.every(l=>l.suggestionOnly)).toBe(true);
  });
  it("creates Minimal Light with reviewable exact bindings",()=>{
    const doc=createMinimalLightDocument(base(),"positron");
    expect(doc.baseStyle).toBe("positron");
    expect(doc.bindings.water).toEqual(["natural-water"]);
    expect(doc.groups.water?.color).toBe("#DCE9EB");
    expect(validateStyleDocument(doc)).toEqual([]);
  });
  it("compiles exact groups then individual overrides, preserving foreign properties",()=>{
    const original=base();
    const old=JSON.stringify(original);
    const doc=createMinimalLightDocument(original,"positron");
    doc.layers["road-main"]={paint:{"line-color":["case",["get","important"],"#123456","#654321"],"line-width":3},layout:{visibility:"none"},minzoom:4};
    const {style,changedLayerIds}=compileAtlasStyle(original,doc);
    const layers=style.layers as unknown as Array<Record<string,any>>;
    expect((layers[1]!.paint as Record<string,unknown>)["fill-color"]).toBe("#DCE9EB");
    expect((layers[2]!.paint as Record<string,unknown>)["line-color"]).toEqual(["case",["get","important"],"#123456","#654321"]);
    expect((layers[2]!.paint as Record<string,unknown>)["line-width"]).toBe(3);
    expect(layers[2]!.minzoom).toBe(4);
    expect(layers[2]!.layout).toEqual({visibility:"none"});
    expect(style.customProperty).toEqual({arbitrary:["retained",42]});
    expect((layers[4]!.paint as Record<string,unknown>)["fill-pattern"]).toBe("dots");
    expect(JSON.stringify(original)).toBe(old);
    expect(changedLayerIds).toContain("road-main");
    expect(changedLayerIds).not.toContain("unknown");
  });
  it("diagnoses missing layer IDs without inventing them",()=>{
    const doc=createEmptyStyleDocument("custom","positron");
    doc.bindings.roads=["absent"];
    doc.groups.roads={color:"#aabbcc"};
    doc.layers.missing={layout:{visibility:"none"}};
    const result=compileAtlasStyle(base(),doc);
    expect(result.diagnostics.map(d=>d.code)).toContain("MISSING_BINDING");
    expect(result.diagnostics.map(d=>d.code)).toContain("MISSING_LAYER");
    expect(result.changedLayerIds).toEqual([]);
  });
  it("supports deterministic JSON round trips",()=>{
    const doc=createMinimalLightDocument(base(),"positron");
    doc.layers["road-main"]={paint:{"line-width":["interpolate",["linear"],["zoom"],5,0.5,15,4]}};
    const first=stringifyAtlasStyleDocument(doc);
    expect(stringifyAtlasStyleDocument(parseAtlasStyleDocument(first))).toBe(first);
  });
  it("migrates six-field legacy themes without losing the binding context",()=>{
    const colors={land:"#111111",water:"#222222",parks:"#333333",roads:"#444444",buildings:"#555555",labels:"#666666"};
    const doc=migrateLegacyColorTheme({version:1,renderer:"maplibre",colors},base(),"positron");
    expect(doc.groups.roads?.color).toBe("#444444");
    expect(doc.bindings.roads).toContain("road-main");
    expect(doc.metadata?.migratedFrom).toBe(1);
  });
  it("rejects prototype-polluting and non-JSON property input",()=>{
    const doc=createEmptyStyleDocument("bad","positron");
    doc.layers["road-main"]={paint:JSON.parse('{"__proto__":{"danger":1}}')};
    expect(validateStyleDocument(doc).map(d=>d.code)).toContain("PROPERTY");
    expect(()=>compileAtlasStyle(base(),doc)).toThrow("Invalid Atlas style document");
  });
  it("rejects unsupported group color/opacity and invalid zoom spans",()=>{
    const doc=createEmptyStyleDocument("bad","positron");
    doc.groups.roads={color:"var(--css)",opacity:3};
    doc.layers["road-main"]={minzoom:18,maxzoom:4};
    expect(validateStyleDocument(doc).map(d=>d.code)).toEqual(expect.arrayContaining(["COLOR","OPACITY","ZOOM_RANGE"]));
  });
  it("rejects duplicate layer IDs in source styles",()=>{
    const style=base();style.layers.push({...style.layers[0]!});
    expect(()=>inspectStyleLayers(style)).toThrow("duplicate layer id");
  });
});
