import {describe,it,expect} from "vitest";
import {
  createAdvancedStyleSettings,availableProviderFonts,classifyLabelRole,
  applyAdvancedStyleControls,validateAdvancedStyleSettings
} from "./advancedStyle";
import {createEmptyStyleDocument,inspectStyleLayers,compileAtlasStyle} from "./index";
import {createMapDetailSettings,applyMapDetailControls} from "./detailControls";
const base=()=>({version:8,glyphs:"https://example.org/{fontstack}/{range}.pbf",
  sources:{osm:{type:"vector",url:"https://example.org/source.json"}},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#ffffff"}},
    {id:"road-primary",type:"line",source:"osm","source-layer":"transportation",
      paint:{"line-color":"#bbbbbb","line-width":["interpolate",["linear"],["zoom"],5,1,14,5],"line-opacity":.9}},
    {id:"road-tertiary",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#aaaaaa","line-width":2,"line-opacity":.75}},
    {id:"road-primary-casing",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#333333","line-width":6}},
    {id:"road-mixed",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#999999","line-width":3,"line-opacity":.8}},
    {id:"city-label",type:"symbol",source:"osm","source-layer":"place",
      layout:{"text-field":["get","name"],"text-font":["Noto Sans Regular"],
        "text-size":["interpolate",["linear"],["zoom"],5,11,15,19]}},
    {id:"suburb-label",type:"symbol",source:"osm","source-layer":"place",
      layout:{"text-field":["get","name"],"text-font":["Noto Sans Bold"],"text-size":13}},
    {id:"road-name",type:"symbol",source:"osm","source-layer":"transportation_name",layout:{"text-field":["get","name"]}},
    {id:"poi-shop",type:"symbol",source:"osm","source-layer":"poi",layout:{"text-field":["get","name"]}},
    {id:"building-block",type:"fill",source:"osm","source-layer":"building",minzoom:6},
    {id:"natural-water",type:"fill",source:"osm","source-layer":"water"}
  ]});
type L={id:string,paint?:Record<string,unknown>,layout?:Record<string,unknown>,minzoom?:number,maxzoom?:number};
const pick=(style:Record<string,unknown>,id:string)=>(style.layers as unknown as L[]).find(l=>l.id===id)!;
const compile=(edit:(s:ReturnType<typeof createAdvancedStyleSettings>)=>void,withDetail=false)=>{
  const style=base(),layers=inspectStyleLayers(style);
  const raw=createEmptyStyleDocument("test","positron");
  const details=createMapDetailSettings();details.roads.secondary=40;
  const doc=withDetail?applyMapDetailControls(raw,layers,details,style):raw;
  const settings=createAdvancedStyleSettings();edit(settings);
  const newDoc=applyAdvancedStyleControls(doc,layers,settings,style);
  return {style:compileAtlasStyle(style,newDoc).style,original:style,doc:newDoc};
};
describe("Advanced Atlas road, typography and zoom controls",()=>{
  it("is a no-op with inherited defaults",()=>{
    const raw=createEmptyStyleDocument("test","positron"),settings=createAdvancedStyleSettings();
    expect(applyAdvancedStyleControls(raw,inspectStyleLayers(base()),settings,base())).toEqual(raw);
    expect(validateAdvancedStyleSettings(settings)).toEqual([]);
  });
  it("styles major and minor roads independently and edits real casing layers",()=>{
    const r=compile(s=>{
      s.roads.primary.color="#dd8833";s.roads.primary.width=8;
      s.roads.primary.outlineColor="#443322";s.roads.primary.outlineWidth=10;
      s.roads.secondary.color="#225599";s.roads.secondary.width=2;s.roads.secondary.visible=false;
    });
    expect(pick(r.style,"road-primary").paint?.["line-color"]).toBe("#dd8833");
    expect(pick(r.style,"road-primary").paint?.["line-width"]).toBe(8);
    expect(pick(r.style,"road-primary-casing").paint?.["line-color"]).toBe("#443322");
    expect(pick(r.style,"road-primary-casing").paint?.["line-width"]).toBe(10);
    expect(pick(r.style,"road-tertiary").paint?.["line-color"]).toBe("#225599");
    expect(pick(r.style,"road-tertiary").layout?.visibility).toBe("none");
    expect(pick(r.original as unknown as Record<string,unknown>,"road-primary").paint?.["line-color"]).toBe("#bbbbbb");
  });
  it("uses class expressions and a zoom step for mixed roads",()=>{
    const r=compile(s=>{
      s.roads.paths.dash="dashed";s.roads.secondary.color="#225599";
      s.roads.local.zoom.min=12;s.roads.paths.visible=false;
    },true);
    expect((pick(r.style,"road-mixed").paint?.["line-color"] as unknown[])[0]).toBe("match");
    expect((pick(r.style,"road-mixed").paint?.["line-dasharray"] as unknown[])[0]).toBe("match");
    expect((pick(r.style,"road-mixed").paint?.["line-opacity"] as unknown[])[0]).toBe("step");
    expect((pick(r.style,"road-mixed").paint?.["line-opacity"] as unknown[])[1]).toEqual(["zoom"]);
    expect(pick(r.style,"road-primary").paint?.["line-opacity"]).toBe(.9);
  });
  it("scales zoom-responsive city labels with valid provider fonts",()=>{
    const r=compile(s=>{
      s.labels.city.color="#aabbcc";s.labels.city.sizeScale=1.5;s.labels.city.spacing=.07;
      s.labels.city.fontStack=["Noto Sans Bold"];s.labels.city.zoom.min=7;
      s.labels.road.visible=false;s.labels.poi.color="#dd8877";
    });
    const city=pick(r.style,"city-label");
    expect(city.paint?.["text-color"]).toBe("#aabbcc");
    expect(city.layout?.["text-size"]).toEqual(["interpolate",["linear"],["zoom"],5,16.5,15,28.5]);
    expect(city.layout?.["text-font"]).toEqual(["Noto Sans Bold"]);
    expect(city.layout?.["text-letter-spacing"]).toBe(.07);
    expect(city.minzoom).toBe(7);
    expect(pick(r.style,"road-name").layout?.visibility).toBe("none");
    expect(pick(r.style,"poi-shop").paint?.["text-color"]).toBe("#dd8877");
    expect(availableProviderFonts(base())).toHaveLength(2);
    expect(classifyLabelRole(inspectStyleLayers(base()).find(l=>l.id==="city-label")!)).toBe("city");
  });
  it("applies independent road, label and building zoom thresholds",()=>{
    const r=compile(s=>{
      s.features.buildings.min=9;s.features.buildings.max=17;
      s.features.poi.min=14;s.roads.primary.zoom.min=6;s.roads.primary.zoom.max=18;
    });
    expect(pick(r.style,"building-block").minzoom).toBe(9);
    expect(pick(r.style,"building-block").maxzoom).toBe(17);
    expect(pick(r.style,"poi-shop").minzoom).toBe(14);
    expect(pick(r.style,"road-primary").minzoom).toBe(6);
    expect(pick(r.style,"road-primary").maxzoom).toBe(18);
    expect(pick(r.style,"natural-water").minzoom).toBeUndefined();
  });
  it("ignores unadvertised fonts and rejects invalid zoom ranges",()=>{
    const r=compile(s=>{s.labels.city.fontStack=["Unknown UltraBold"];});
    expect(pick(r.style,"city-label").layout?.["text-font"]).toEqual(["Noto Sans Regular"]);
    expect(r.doc.metadata?.advancedStyleWarnings).toBeDefined();
    const s=createAdvancedStyleSettings();s.features.buildings.min=18;s.features.buildings.max=12;
    expect(validateAdvancedStyleSettings(s).length).toBeGreaterThan(0);
  });
});
