import {describe,it,expect} from "vitest";
import {createAtlasPresetDocument} from "./presets";
import {createAdvancedOverrides} from "./presetAdvanced";
import {createSemanticOverrides} from "./presetSemantic";
import {createAtlasThemeBundle,parseAtlasThemeBundle,stringifyAtlasThemeBundle,validateAtlasThemeBundle} from "./themeBundle";

const fixture=()=>{
  const document=createAtlasPresetDocument("minimal-light",[],{includeDetails:false});
  document.baseStyle="positron";
  document.groups.roads={...document.groups.roads,color:"#FCFAFA"};
  document.layers["highway-primary"]={paint:{"line-width":4}};
  const advanced=createAdvancedOverrides();
  advanced.roads.primary={color:"#F5AABB",outlineWidth:1.5,zoom:{min:8}};
  advanced.labels.road={halo:false,outline:true,fontStack:["Noto Sans Regular"]};
  const semantic=createSemanticOverrides();
  semantic.waterBodies={opacity:75,outlineColor:"#AACCFF"};
  return createAtlasThemeBundle({
    presetId:"minimal-light",vectorStyle:"positron",document,
    customPalette:["#112233","#223344","#334455","#445566"],
    detailOverrides:{roads:{primary:85,secondary:40},features:{water:{visible:true,opacity:85}}},
    advancedOverrides:advanced,semanticOverrides:semantic
  });
};
describe("Atlas theme export/import",()=>{
  it("round-trips every authoring layer and typography/road/semantic control",()=>{
    const first=fixture();
    const imported=parseAtlasThemeBundle(stringifyAtlasThemeBundle(first));
    expect(imported).toEqual(first);
    expect(imported.document.layers["highway-primary"]?.paint?.["line-width"]).toBe(4);
    expect(imported.advancedOverrides.labels.road?.halo).toBe(false);
    expect(imported.detailOverrides.roads.secondary).toBe(40);
    expect(imported.semanticOverrides.waterBodies?.opacity).toBe(75);
  });
  it("rejects invalid versions and unsupported providers",()=>{
    expect(validateAtlasThemeBundle({...fixture(),schemaVersion:99})).not.toEqual([]);
    expect(validateAtlasThemeBundle({...fixture(),vectorStyle:"unknown"})).not.toEqual([]);
  });
  it("rejects unsafe properties and broken overrides",()=>{
    const value=fixture() as unknown as Record<string,unknown>;
    const damaged=JSON.parse(JSON.stringify(value));
    damaged.advancedOverrides.labels.road.unknownSetting=true;
    expect(()=>parseAtlasThemeBundle(JSON.stringify(damaged))).toThrow(/Invalid/);
    expect(()=>parseAtlasThemeBundle('{"__proto__":true}')).toThrow();
  });
  it("does not confuse GeoJSON with a theme bundle",()=>{
    expect(()=>parseAtlasThemeBundle('{"type":"FeatureCollection","features":[]}')).toThrow();
  });
  it("limits imported data size",()=>{
    expect(()=>parseAtlasThemeBundle(" ".repeat(2_000_001))).toThrow(/2 MB/);
  });
});
