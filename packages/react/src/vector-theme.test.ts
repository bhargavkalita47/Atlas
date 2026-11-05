import { describe,it,expect,vi } from "vitest";
import { applyVectorTheme, DEFAULT_VECTOR_THEME, KEYLESS_VECTOR_STYLES } from "./VectorMap";
import type { Map as MapLibreMap } from "maplibre-gl";

describe("Atlas keyless vector configuration",()=>{
  it("requires no paid map API key",()=>{
    expect(Object.values(KEYLESS_VECTOR_STYLES).every(s=>
      s.startsWith("https://tiles.openfreemap.org/")
    )).toBe(true);
  });
  it("provides valid and complete default colors",()=>{
    expect(Object.entries(DEFAULT_VECTOR_THEME)).toHaveLength(6);
    expect(Object.values(DEFAULT_VECTOR_THEME).every(s=>/^#[0-9a-f]{6}$/i.test(s))).toBe(true);
  });
});

describe("Atlas theme compiler",()=>{
  function mockMap(){
    const setPaintProperty=vi.fn();
    const getStyle=vi.fn(()=>({version:8,layers:[
      {id:"background",type:"background"},
      {id:"natural-water",type:"fill","source-layer":"water"},
      {id:"park-wood",type:"fill","source-layer":"landuse"},
      {id:"building",type:"fill","source-layer":"building"},
      {id:"road-main",type:"line","source-layer":"transportation"},
      {id:"place-city-label",type:"symbol","source-layer":"place"},
      {id:"unclassified",type:"fill","source-layer":"unknown"},
    ]}));
    return {setPaintProperty,getStyle} as unknown as MapLibreMap;
  }
  it("styles roads, buildings, water, parks and labels independently",()=>{
    const map=mockMap();
    applyVectorTheme(map,{
      land:"#111111",water:"#222222",parks:"#333333",roads:"#444444",
      buildings:"#555555",labels:"#666666"
    });
    const paint=vi.mocked(map.setPaintProperty);
    expect(paint).toHaveBeenCalledWith("background","background-color","#111111");
    expect(paint).toHaveBeenCalledWith("natural-water","fill-color","#222222");
    expect(paint).toHaveBeenCalledWith("park-wood","fill-color","#333333");
    expect(paint).toHaveBeenCalledWith("building","fill-color","#555555");
    expect(paint).toHaveBeenCalledWith("road-main","line-color","#444444");
    expect(paint).toHaveBeenCalledWith("place-city-label","text-color","#666666");
    expect(paint.mock.calls.some(args=>args[0]==="unclassified")).toBe(false);
  });
  it("ignores invalid colors rather than inserting CSS expressions",()=>{
    const map=mockMap();
    applyVectorTheme(map,{...DEFAULT_VECTOR_THEME,water:"var(--malicious)"});
    expect(vi.mocked(map.setPaintProperty)).toHaveBeenCalledWith(
      "natural-water","fill-color",DEFAULT_VECTOR_THEME.water
    );
  });
});
