import {describe,expect,it} from "vitest";
import {parseAtlasGeoJSON,toAtlasGeoJSON} from "./geojson";
import type {MarkerData,Shape} from "./index";
describe("Atlas GeoJSON interchange",()=>{
  const markers:MarkerData[]=[{id:"p1",title:"Test pin",point:{lat:26.17,lng:91.76},color:"#5365da"}];
  const shapes:Shape[]=[
    {id:"circle",kind:"circle",center:{lat:26,lng:91},radiusMeters:500,color:"#f3a45b"},
    {id:"line",kind:"polyline",points:[{lat:1,lng:2},{lat:3,lng:4}],color:"#5365da"},
    {id:"poly",kind:"polygon",points:[{lat:1,lng:2},{lat:3,lng:4},{lat:5,lng:6}],color:"#5365da"}
  ];
  it("exports valid coordinates in [longitude, latitude] order",()=>{
    const result=toAtlasGeoJSON(markers,shapes);
    expect(result.features[0]?.geometry.coordinates).toEqual([91.76,26.17]);
    expect(result.features).toHaveLength(4);
  });
  it("roundtrips markers, circles, lines and closed polygons",()=>{
    const imported=parseAtlasGeoJSON(toAtlasGeoJSON(markers,shapes),{idFactory:i=>"new-"+i});
    expect(imported.markers).toHaveLength(1);
    expect(imported.shapes.map(s=>s.kind)).toEqual(["circle","polyline","polygon"]);
    expect(imported.shapes.find(s=>s.kind==="polygon"&&s.points.length===3)).toBeDefined();
    expect(imported.shapes.find(s=>s.kind==="circle"&&s.radiusMeters===500)).toBeDefined();
  });
  it("rejects invalid coordinate features rather than accepting partial data",()=>{
    const parsed=parseAtlasGeoJSON({type:"FeatureCollection",features:[
      {type:"Feature",geometry:{type:"Point",coordinates:[200,100]},properties:{name:"Invalid"}},
      {type:"Feature",geometry:{type:"Point",coordinates:[91.7,26.1]},properties:{color:"red;evil",name:"Valid"}},
    ]});
    expect(parsed.skipped).toBe(1);
    expect(parsed.markers).toHaveLength(1);
    expect(parsed.markers[0]?.color).toBe("#5365da");
  });
  it("caps the number of imported features",()=>{
    const source=toAtlasGeoJSON(markers,[]);
    const raw={type:"FeatureCollection",features:Array(2000).fill(source.features[0])};
    const parsed=parseAtlasGeoJSON(raw,{maxFeatures:10});
    expect(parsed.markers).toHaveLength(10);
    expect(parsed.skipped).toBe(1990);
  });
  it("rejects invalid document",()=>{
    expect(()=>parseAtlasGeoJSON({features:[]})).toThrow("Expected");
  });
});
