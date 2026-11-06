import {describe,expect,it} from "vitest";
import {createAtlasPresetDocument} from "./presets";
import {getAtlasPresetAdvancedSettings} from "./presetAdvanced";
import {getAtlasPresetDetailSettings} from "./presetDetails";
import {visibleRoadContrast} from "./roadLegibility";
import {ROAD_TIERS} from "./detailControls";
import {compileAtlasStyle,inspectStyleLayers,validateStyleDocument} from "./index";

/**
 * Four actual roadway layers from OpenFreeMap's Dark and Positron styles.
 * The provider filters matter: in Tokyo many roads are "minor" and "service",
 * not necessarily separate "residential" layers. Fixtures are source-level
 * JSON, not synthetic id names constructed to satisfy Atlas heuristics.
 */
const providerStyles = [{"version":8,"sources":{"openmaptiles":{"type":"vector","url":"https://example.org/planet"}},"layers":[{"id":"highway_minor","type":"line","source":"openmaptiles","source-layer":"transportation","minzoom":8,"filter":["all",["match",["geometry-type"],["LineString","MultiLineString"],true,false],["match",["get","class"],["minor","service","track"],true,false]],"layout":{"line-cap":"round","line-join":"round"},"paint":{"line-color":"#181818","line-opacity":0.9,"line-width":["interpolate",["exponential",1.55],["zoom"],13,1.8,20,20]}},{"id":"highway_major_inner","type":"line","source":"openmaptiles","source-layer":"transportation","minzoom":11,"filter":["all",["match",["geometry-type"],["LineString","MultiLineString"],true,false],["match",["get","class"],["primary","secondary","tertiary","trunk"],true,false]],"layout":{"line-cap":"round","line-join":"round"},"paint":{"line-color":"hsl(0,0%,7%)","line-width":["interpolate",["exponential",1.3],["zoom"],10,2,20,20]}},{"id":"highway_motorway_inner","type":"line","source":"openmaptiles","source-layer":"transportation","minzoom":6,"filter":["all",["match",["geometry-type"],["LineString","MultiLineString"],true,false],["==",["get","class"],"motorway"]],"layout":{"line-cap":"round","line-join":"round"},"paint":{"line-color":["interpolate",["linear"],["zoom"],5.8,"hsla(0,0%,85%,0.53)",6,"#000"],"line-width":["interpolate",["exponential",1.4],["zoom"],4,2,6,1.3,20,30]}},{"id":"highway_path","type":"line","source":"openmaptiles","source-layer":"transportation","filter":["all",["match",["geometry-type"],["LineString","MultiLineString"],true,false],["==",["get","class"],"path"]],"layout":{"line-cap":"round","line-join":"round"},"paint":{"line-color":"rgb(27 ,27 ,29)","line-dasharray":[1.5,1.5],"line-opacity":0.9,"line-width":["interpolate",["exponential",1.2],["zoom"],13,1,20,10]}}]},{"version":8,"sources":{"openmaptiles":{"type":"vector","url":"https://example.org/planet"}},"layers":[{"id":"highway_minor","type":"line","source":"openmaptiles","source-layer":"transportation","minzoom":8,"filter":["all",["match",["geometry-type"],["LineString","MultiLineString"],true,false],["match",["get","class"],["minor","service","track"],true,false]],"layout":{"line-cap":"round","line-join":"round"},"paint":{"line-color":"hsl(0,0%,88%)","line-opacity":0.9,"line-width":["interpolate",["exponential",1.55],["zoom"],13,1.8,20,20]}},{"id":"highway_major_inner","type":"line","source":"openmaptiles","source-layer":"transportation","minzoom":11,"filter":["all",["match",["geometry-type"],["LineString","MultiLineString"],true,false],["match",["get","class"],["primary","secondary","tertiary","trunk"],true,false]],"layout":{"line-cap":"round","line-join":"round"},"paint":{"line-color":"#fff","line-width":["interpolate",["exponential",1.3],["zoom"],10,2,20,20]}},{"id":"highway_motorway_inner","type":"line","source":"openmaptiles","source-layer":"transportation","minzoom":6,"filter":["all",["match",["geometry-type"],["LineString","MultiLineString"],true,false],["all",["match",["get","brunnel"],["bridge","tunnel"],false,true],["==",["get","class"],"motorway"]]],"layout":{"line-cap":"round","line-join":"round"},"paint":{"line-color":["interpolate",["linear"],["zoom"],5.8,"hsla(0,0%,85%,0.53)",6,"#fff"],"line-width":["interpolate",["exponential",1.4],["zoom"],4,2,6,1.3,20,30]}},{"id":"highway_path","type":"line","source":"openmaptiles","source-layer":"transportation","filter":["all",["match",["geometry-type"],["LineString","MultiLineString"],true,false],["==",["get","class"],"path"]],"layout":{"line-cap":"round","line-join":"round"},"paint":{"line-color":"rgb(234, 234, 234)","line-opacity":0.9,"line-width":["interpolate",["exponential",1.2],["zoom"],13,1,20,10]}}]}] as const;

describe("Tokyo Neon road display regression",()=>{
  it("restores a visible hierarchy including local and service roads",()=>{
    const advanced=getAtlasPresetAdvancedSettings("tokyo-neon");
    const detail=getAtlasPresetDetailSettings("tokyo-neon");
    const land="#15152D";
    const minima={motorway:5,primary:4.4,secondary:3.6,local:2.8,paths:2.1};
    for(const tier of ROAD_TIERS){
      const visual=visibleRoadContrast(advanced.roads[tier].color!,land,detail.roads[tier]/100);
      expect(visual,tier+" composite contrast").toBeGreaterThanOrEqual(minima[tier]-.02);
    }
    expect(detail.roads.local).toBeGreaterThanOrEqual(85);
    expect(detail.roads.paths).toBeGreaterThanOrEqual(70);
    expect(advanced.roads.local.width).toBeGreaterThanOrEqual(1.9);
    expect(advanced.roads.local.zoom.min).toBeLessThanOrEqual(10);
  });
  it("keeps real OpenFreeMap major/minor/path road layers drawable",()=>{
    for(const base of providerStyles){
      const available=inspectStyleLayers(base);
      const doc=createAtlasPresetDocument("tokyo-neon",available,{baseStyle:base});
      expect(validateStyleDocument(doc)).toEqual([]);
      const output=compileAtlasStyle(base,doc).style;
      const lines=output.layers as unknown as Array<{
        id:string;type:string;minzoom?:number;
        paint?:Record<string,unknown>;filter?:unknown
      }>;
      for(const name of ["highway_minor","highway_major_inner","highway_motorway_inner","highway_path"]){
        const layer=lines.find(l=>l.id===name)!;
        const original=base.layers.find(l=>l.id===name)!;
        expect(layer.type).toBe("line");
        expect(layer.filter).toEqual(original.filter);
        expect(layer.paint?.["line-width"]).toBeDefined();
        expect(layer.paint?.["line-color"]).toBeDefined();
        expect(layer.minzoom??0).toBeLessThanOrEqual(13);
      }
      const minor=lines.find(l=>l.id==="highway_minor")!;
      // This real filter covers the "minor" and "service" roads Tokyo uses.
      expect(JSON.stringify(minor.filter)).toContain("minor");
      expect(JSON.stringify(minor.filter)).toContain("service");
      expect(JSON.stringify(minor.paint?.["line-color"])).toContain("minor");
      expect(JSON.stringify(minor.paint?.["line-opacity"])).toContain("minor");
    }
  });
  it("retains other dark presets unchanged and recolours Tokyo custom palettes",()=>{
    const before=getAtlasPresetAdvancedSettings("minimal-dark");
    const custom=getAtlasPresetAdvancedSettings("tokyo-neon",{
      land:"#12182C",roads:"#4D5988",labels:"#F9D4FE"
    });
    expect(custom.roads.local.color).not.toBe(getAtlasPresetAdvancedSettings("tokyo-neon").roads.local.color);
    expect(visibleRoadContrast(custom.roads.local.color!,"#12182C",.9)).toBeGreaterThanOrEqual(2.78);
    expect(getAtlasPresetAdvancedSettings("minimal-dark")).toEqual(before);
  });
});
