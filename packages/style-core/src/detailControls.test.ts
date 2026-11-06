import {describe,expect,it} from "vitest";
import {applyMapDetailControls,classifyRoadLayer,createMapDetailSettings,ROAD_TIERS} from "./detailControls";
import {compileAtlasStyle,inspectStyleLayers,createEmptyStyleDocument,validateStyleDocument} from "./index";

const base=()=>({
  version:8,sources:{roads:{type:"vector",url:"https://example.org/roads.json"}},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#ffffff"}},
    {id:"road-motorway",type:"line",source:"roads","source-layer":"transportation",paint:{"line-opacity":0.85,"line-width":4}},
    {id:"road-secondary",type:"line",source:"roads","source-layer":"transportation",paint:{"line-opacity":0.8}},
    {id:"road-mixed",type:"line",source:"roads","source-layer":"transportation",paint:{"line-opacity":0.65}},
    {id:"railway-tram",type:"line",source:"roads","source-layer":"transportation",paint:{"line-opacity":0.9}},
    {id:"road-name",type:"symbol",source:"roads","source-layer":"transportation_name",layout:{"text-field":["get","name"]}},
    {id:"place-label",type:"symbol",source:"roads","source-layer":"place"},
    {id:"poi-label",type:"symbol",source:"roads","source-layer":"poi"},
    {id:"building-fill",type:"fill",source:"roads","source-layer":"building",paint:{"fill-opacity":0.8}},
    {id:"lake",type:"fill",source:"roads","source-layer":"water"}
  ]
});
const compiled=(settings:ReturnType<typeof createMapDetailSettings>)=>{
  const style=base(),layers=inspectStyleLayers(style);
  const doc=createEmptyStyleDocument("test","positron");
  const result=applyMapDetailControls(doc,layers,settings,style);
  return {doc:result,style:compileAtlasStyle(style,result).style};
};
const layer=(style:ReturnType<typeof compiled>["style"],id:string)=>{
  const layers=style.layers as unknown as Array<{id:string,paint?:Record<string,unknown>,layout?:Record<string,unknown>}>;
  return layers.find(x=>x.id===id)!;
};
describe("Atlas map density / road hierarchy",()=>{
  it("full detail is exactly a no-op and preserves all original paint expressions",()=>{
    const style=base();const doc=createEmptyStyleDocument("test","positron");
    const result=applyMapDetailControls(doc,inspectStyleLayers(style),createMapDetailSettings(),style);
    expect(result).toEqual(doc);
    expect(validateStyleDocument(result)).toEqual([]);
  });
  it("can fade secondary roads without affecting motorway line opacity",()=>{
    const settings=createMapDetailSettings();
    settings.roads.secondary=25;
    const result=compiled(settings);
    expect(layer(result.style,"road-motorway").paint?.["line-opacity"]).toBe(.85);
    expect(layer(result.style,"road-secondary").paint?.["line-opacity"]).toBe(.2);
    expect(layer(result.style,"road-mixed").paint?.["line-opacity"]).toEqual([
      "match",["to-string",["coalesce",["get","class"],["get","highway"],["get","type"],""]],
      ["motorway","trunk","freeway","motorway_link","trunk_link","expressway"],.65,
      ["primary","primary_link","highway"],.65,
      ["secondary","tertiary","secondary_link","tertiary_link","collector"],.1625,
      ["residential","minor","unclassified","living_street","living","street","local"],.65,
      ["service","track","path","footway","cycleway","pedestrian","steps","trail","bridleway"],.65,.65
    ]);
  });
  it("preserves provider zoom-dependent opacity when fading a road class",()=>{
    const src=base();
    const interpolated=["interpolate",["linear"],["zoom"],5,0.2,14,0.8];
    const mixed=src.layers.find(l=>l.id==="road-mixed")!;
    mixed.paint!["line-opacity"]=interpolated;
    const settings=createMapDetailSettings();
    settings.roads.secondary=40;
    const doc=applyMapDetailControls(createEmptyStyleDocument("test","positron"),inspectStyleLayers(src),settings,src);
    const output=compileAtlasStyle(src,doc).style;
    const expr=layer(output,"road-mixed").paint?.["line-opacity"];
    expect(Array.isArray(expr)).toBe(true);
    expect((expr as unknown[])[0]).toBe("interpolate");
    expect((expr as unknown[])[2]).toEqual(["zoom"]);
    expect((expr as unknown[])[4]).toEqual(expect.arrayContaining(["*"]));
    expect(JSON.stringify(src.layers.find(l=>l.id==="road-mixed")!.paint!["line-opacity"])).toBe(JSON.stringify(interpolated));
  });
  it("controls visibility and opacity by semantic feature, preserving the background",()=>{
    const s=createMapDetailSettings();
    s.features.buildings={visible:false,opacity:40};
    s.features.poi={visible:false,opacity:100};
    s.features.roadLabels={visible:false,opacity:100};
    s.features.water={visible:null,opacity:50};
    const r=compiled(s);
    expect(layer(r.style,"building-fill").layout?.visibility).toBe("none");
    expect(layer(r.style,"building-fill").paint?.["fill-opacity"]).toBe(.32);
    expect(layer(r.style,"poi-label").layout?.visibility).toBe("none");
    expect(layer(r.style,"road-name").layout?.visibility).toBe("none");
    expect(layer(r.style,"place-label").layout?.visibility).toBeUndefined();
    expect(layer(r.style,"lake").paint?.["fill-opacity"]).toBe(.5);
    expect(layer(r.style,"background").layout?.visibility).toBeUndefined();
    expect(validateStyleDocument(r.doc)).toEqual([]);
  });
  it("can force a preset-hidden feature visible, or inherit its original visibility",()=>{
    const style=base(),layers=inspectStyleLayers(style);
    const doc=createEmptyStyleDocument("test","positron");
    doc.groups.poi={visible:false};doc.bindings.poi=["poi-label"];
    const controls=createMapDetailSettings();
    const inherited=compileAtlasStyle(style,applyMapDetailControls(doc,layers,controls,style)).style;
    expect(layer(inherited,"poi-label").layout?.visibility).toBe("none");
    controls.features.poi={visible:true,opacity:100};
    const shown=compileAtlasStyle(style,applyMapDetailControls(doc,layers,controls,style)).style;
    expect(layer(shown,"poi-label").layout?.visibility).toBe("visible");
    controls.features.poi={visible:false,opacity:100};
    const hidden=compileAtlasStyle(style,applyMapDetailControls(doc,layers,controls,style)).style;
    expect(layer(hidden,"poi-label").layout?.visibility).toBe("none");
  });
  it("treats tram/rail layers as transit even if provider calls the source transportation",()=>{
    const settings=createMapDetailSettings();
    settings.roads.local=0;
    settings.features.transit={visible:false,opacity:50};
    const result=compiled(settings);
    expect(layer(result.style,"railway-tram").layout?.visibility).toBe("none");
    expect(layer(result.style,"railway-tram").paint?.["line-opacity"]).toBe(.45);
    const style=base();
    expect(classifyRoadLayer(inspectStyleLayers(style).find(x=>x.id==="railway-tram")!)).toBeNull();
  });
  it("preserves original documents and restores the original style when reset",()=>{
    const style=base(),original=JSON.stringify(style);
    const doc=createEmptyStyleDocument("test","positron");
    const detail=createMapDetailSettings("essential");
    const changed=applyMapDetailControls(doc,inspectStyleLayers(style),detail,style);
    expect(changed.layers["road-mixed"]).toBeDefined();
    expect(JSON.stringify(style)).toBe(original);
    const full=applyMapDetailControls(doc,inspectStyleLayers(style),createMapDetailSettings(),style);
    expect(full.layers).toEqual({});
  });
  it("recognizes distinct road layer classes without confusing road labels",()=>{
    const layers=inspectStyleLayers(base());
    expect(classifyRoadLayer(layers.find(x=>x.id==="road-motorway")!)).toBe("motorway");
    expect(classifyRoadLayer(layers.find(x=>x.id==="road-secondary")!)).toBe("secondary");
    expect(classifyRoadLayer(layers.find(x=>x.id==="road-mixed")!)).toBeNull();
    expect(ROAD_TIERS).toHaveLength(5);
  });
});

import {mergeMapDetailOverrides,deriveMapDetailOverrides} from "./detailControls";
describe("sparse manual map-detail adjustments",()=>{
  it("inherits new preset profiles while persisting only changed controls",()=>{
    const baseline=createMapDetailSettings("quiet");
    const wanted=mergeMapDetailOverrides(baseline,{
      roads:{secondary:25},features:{poi:{visible:true}}
    });
    const changes=deriveMapDetailOverrides(baseline,wanted);
    expect(changes.roads).toEqual({secondary:25});
    expect(changes.features.poi).toEqual({visible:true});
    const alternate=createMapDetailSettings("balanced");
    const merged=mergeMapDetailOverrides(alternate,changes);
    expect(merged.roads.secondary).toBe(25);
    expect(merged.roads.local).toBe(80);
    expect(merged.features.poi.visible).toBe(true);
    expect(baseline.features.poi.visible).toBe(false);
  });
});
