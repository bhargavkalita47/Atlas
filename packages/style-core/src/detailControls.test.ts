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
  it("controls visibility and opacity by semantic feature, preserving the background",()=>{
    const s=createMapDetailSettings();
    s.features.buildings={visible:false,opacity:40};
    s.features.poi={visible:false,opacity:100};
    s.features.roadLabels={visible:false,opacity:100};
    s.features.water={visible:true,opacity:50};
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
