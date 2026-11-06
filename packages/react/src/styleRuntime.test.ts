import {describe,it,expect,vi} from "vitest";
import {createEmptyStyleDocument} from "@atlas/style-core";
import {applyAtlasStyleDocument,editableLayerInventory} from "./styleRuntime";
import type {Map as MapLibreMap} from "maplibre-gl";
function base(){
  return {version:8,sources:{},layers:[
    {id:"background",type:"background",paint:{"background-color":"#ffffff"}},
    {id:"road-primary",type:"line",paint:{"line-color":"#cccccc","line-width":["interpolate",["linear"],["zoom"],4,0.5,18,10]},layout:{visibility:"visible"}},
    {id:"atlas-outline",type:"line",paint:{"line-color":"#00ff00"}},
  ]};
}
function renderer(){
  const map={setPaintProperty:vi.fn(),setLayoutProperty:vi.fn(),setFilter:vi.fn(),setLayerZoomRange:vi.fn(),getStyle:vi.fn(()=>base())};
  return map as unknown as Pick<MapLibreMap,"setPaintProperty"|"setLayoutProperty"|"setFilter"|"setLayerZoomRange"|"getStyle">;
}
describe("MapLibre incremental authoring adapter",()=>{
  it("lists actual map layers, not Atlas-owned overlays",()=>{
    expect(editableLayerInventory(base()).map(x=>x.id)).toEqual(["background","road-primary"]);
  });
  it("changes only the targeted paint property and never calls setStyle",()=>{
    const map=renderer();
    const doc=createEmptyStyleDocument("test","positron");
    doc.layers["road-primary"]={paint:{"line-color":"#224466"}};
    const result=applyAtlasStyleDocument(map,base(),doc);
    expect(result.propertyChanges).toBe(1);
    expect(map.setPaintProperty).toHaveBeenCalledExactlyOnceWith("road-primary","line-color","#224466");
    expect(map.setLayoutProperty).not.toHaveBeenCalled();
    expect(map.setFilter).not.toHaveBeenCalled();
  });
  it("restores source expression when a layer override is removed",()=>{
    const map=renderer();
    const original=base();
    const doc=createEmptyStyleDocument("test","positron");
    doc.layers["road-primary"]={paint:{"line-width":6}};
    const first=applyAtlasStyleDocument(map,original,doc);
    const reset=createEmptyStyleDocument("reset","positron");
    applyAtlasStyleDocument(map,original,reset,first.appliedStyle);
    expect(map.setPaintProperty).toHaveBeenLastCalledWith("road-primary","line-width",["interpolate",["linear"],["zoom"],4,0.5,18,10]);
  });
  it("lets exact overrides win over semantic group values",()=>{
    const map=renderer();
    const doc=createEmptyStyleDocument("test","positron");
    doc.groups.roads={color:"#112233"};
    doc.bindings.roads=["road-primary"];
    doc.layers["road-primary"]={paint:{"line-color":"#445566"}};
    const result=applyAtlasStyleDocument(map,base(),doc);
    expect(result.propertyChanges).toBe(1);
    expect(map.setPaintProperty).toHaveBeenCalledWith("road-primary","line-color","#445566");
  });
  it("updates visibility, filter and zoom without replacing the map",()=>{
    const map=renderer();
    const doc=createEmptyStyleDocument("test","positron");
    doc.layers["road-primary"]={layout:{visibility:"none"},filter:["==",["get","class"],"primary"],minzoom:7,maxzoom:14};
    const result=applyAtlasStyleDocument(map,base(),doc);
    expect(result.propertyChanges).toBe(3);
    expect(map.setLayoutProperty).toHaveBeenCalledWith("road-primary","visibility","none");
    expect(map.setFilter).toHaveBeenCalledWith("road-primary",["==",["get","class"],"primary"]);
    expect(map.setLayerZoomRange).toHaveBeenCalledWith("road-primary",7,14);
  });
  it("catches rejected property without hiding failure or corrupting next diff state",()=>{
    const map=renderer();
    vi.mocked(map.setPaintProperty).mockImplementation(()=>{throw Error("unsupported");});
    const doc=createEmptyStyleDocument("test","positron");
    doc.layers["road-primary"]={paint:{"line-color":"#112233"}};
    const result=applyAtlasStyleDocument(map,base(),doc);
    expect(result.diagnostics.map(d=>d.code)).toContain("PATCH_REJECTED");
    expect(map.getStyle).toHaveBeenCalled();
  });
});
