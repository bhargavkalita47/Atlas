import {describe,it,expect} from "vitest";
import {SEMANTIC_PROVIDER_FIXTURES} from "./semanticProviderFixtures";
import {SEMANTIC_KEYS,createSemanticFeatureSettings,
  inspectSemanticCoverage,validateSemanticFeatureSettings,applySemanticFeatureControls
} from "./semanticFeatures";
import {createEmptyStyleDocument,compileAtlasStyle,inspectStyleLayers,validateStyleDocument} from "./index";
import {createAdvancedStyleSettings,applyAdvancedStyleControls} from "./advancedStyle";
import {createAtlasPresetDocument,ATLAS_STYLE_PRESETS} from "./presets";
type L={id:string;paint?:Record<string,unknown>;layout?:Record<string,unknown>};
const find=(style:unknown,id:string)=>((style as {layers:L[]}).layers).find(l=>l.id===id)!;
function edited(base:unknown,edit:(s:ReturnType<typeof createSemanticFeatureSettings>)=>void){
  const s=createSemanticFeatureSettings();edit(s);
  const doc=applySemanticFeatureControls(createEmptyStyleDocument("test","positron"),
    inspectStyleLayers(base),s,base);
  return {doc,style:compileAtlasStyle(base,doc).style};
}
describe("Stage 3 provider-aware semantic styling",()=>{
  it("defines 23 independent feature categories with valid default inheritance",()=>{
    expect(SEMANTIC_KEYS).toHaveLength(23);
    const a=createSemanticFeatureSettings(),b=createSemanticFeatureSettings();
    expect(validateSemanticFeatureSettings(a)).toEqual([]);
    b.rivers.color="#5577AA";b.rivers.opacity=30;b.rivers.zoom={min:7,max:18};
    expect(a.rivers.color).toBeNull();expect(b.streams.color).toBeNull();
    b.rivers.zoom={min:19,max:3};
    expect(validateSemanticFeatureSettings(b)).toContain("rivers invalid zoom");
  });
  it("audits actual Dark, Positron, Bright, Liberty geographic layer coverage",()=>{
    for(const [name,base] of Object.entries(SEMANTIC_PROVIDER_FIXTURES)){
      const coverage=inspectSemanticCoverage(inspectStyleLayers(base),base);
      expect(coverage.buildings.layers,name).toBeGreaterThan(0);
      expect(coverage.waterBodies.layers,name).toBeGreaterThan(0);
      expect(coverage.residential.layers,name).toBeGreaterThan(0);
      expect(coverage.forests.layers,name).toBeGreaterThan(0);
      expect(coverage.countryBorders.layers,name).toBeGreaterThan(0);
      if(name==="dark"||name==="positron")expect(coverage.poiFood.layers,name).toBe(0);
      else expect(coverage.poiFood.layers,name).toBeGreaterThan(0);
    }
  });
  it("keeps river/stream edits confined to their classes on a mixed waterway layer",()=>{
    const base=SEMANTIC_PROVIDER_FIXTURES.dark,original=JSON.stringify(base);
    const x=edited(base,s=>{
      s.rivers.color="#4477AA";s.rivers.width=4;
      s.streams.color="#AACCED";s.streams.visible=false;
    });
    const l=JSON.stringify(find(x.style,"waterway").paint);
    expect(l).toContain("#4477AA");expect(l).toContain("#AACCED");
    expect(l).toContain("river");expect(l).toContain("stream");
    expect(l).toContain('"line-opacity"');
    expect(JSON.stringify(base)).toBe(original);
    expect(validateStyleDocument(x.doc)).toEqual([]);
  });
  it("does not recolour forests when residential areas or parks are edited",()=>{
    const b=SEMANTIC_PROVIDER_FIXTURES.bright;
    const x=edited(b,s=>{
      s.residential.color="#AABBCC";
      s.commercial.opacity=20;
      s.industrial.visible=false;
      s.parks.color="#55AA66";
      s.forests.color="#336644";
    });
    const wood=JSON.stringify(find(x.style,"landcover-wood").paint);
    const residential=JSON.stringify(find(x.style,"landuse-residential").paint);
    expect(wood).toContain("#336644");
    expect(wood).not.toContain("#AABBCC");
    expect(residential).toContain("#AABBCC");
    expect(JSON.stringify(find(x.style,"landuse-commercial").paint)).toContain("0.2");
    expect(JSON.stringify(find(x.style,"landuse-industrial").paint)).toContain("0");
    expect(validateStyleDocument(x.doc)).toEqual([]);
  });
  it("applies class-specific POI properties within shared rank-filtered provider layers",()=>{
    const x=edited(SEMANTIC_PROVIDER_FIXTURES.bright,s=>{
      s.poiHealth.color="#EE6677";
      s.poiFood.visible=false;
      s.poiShopping.iconSize=1.5;
    });
    const p=JSON.stringify(find(x.style,"poi_r20"));
    expect(p).toContain("hospital");
    expect(p).toContain("restaurant");
    expect(p).toContain("#EE6677");
    expect(p).toContain("shop");
    expect(validateStyleDocument(x.doc)).toEqual([]);
  });
  it("styles state/district administrative boundaries without changing country borders",()=>{
    const x=edited(SEMANTIC_PROVIDER_FIXTURES.positron,s=>{
      s.regionBorders.color="#5577AA";s.regionBorders.width=3;
      s.localBorders.visible=false;s.countryBorders.color="#445566";
    });
    const local=JSON.stringify(find(x.style,"boundary_3").paint);
    expect(local).toContain("#5577AA");
    expect(local).toContain("admin_level");
    expect(local).toContain("0");
    expect(JSON.stringify(find(x.style,"boundary_2").paint)).toContain("#445566");
    expect(validateStyleDocument(x.doc)).toEqual([]);
  });
  it("scales 3D buildings only if a height-bearing extrusion source already exists",()=>{
    const b=SEMANTIC_PROVIDER_FIXTURES.liberty;
    const x=edited(b,s=>{s.buildings.heightScale=1.3;});
    expect(find(x.style,"building-3d").paint?.["fill-extrusion-height"])
      .toEqual(["*",find(b,"building-3d").paint?.["fill-extrusion-height"],1.3]);
  });
  it("does not modify 81 preset documents with inherited feature settings",()=>{
    const b=SEMANTIC_PROVIDER_FIXTURES.positron,layers=inspectStyleLayers(b);
    for(const p of ATLAS_STYLE_PRESETS){
      const d=createAtlasPresetDocument(p.id,layers,{baseStyle:b,includeDetails:false});
      expect(applySemanticFeatureControls(d,layers,createSemanticFeatureSettings(),b)).toEqual(d);
    }
  });
  it("toggles crisp text outlines and soft halos, including dark presets",()=>{
    const b=SEMANTIC_PROVIDER_FIXTURES.dark,layers=inspectStyleLayers(b);
    const d=createAtlasPresetDocument("minimal-dark",layers,{baseStyle:b,includeDetails:false});
    const cfg=createAdvancedStyleSettings();
    const compile=()=>compileAtlasStyle(b,applyAdvancedStyleControls(d,layers,cfg,b)).style;
    expect(find(compile(),"place_city").paint?.["text-halo-width"]).toBe(0);
    cfg.labels.city.outline=true;cfg.labels.city.halo=false;
    expect(Number(find(compile(),"place_city").paint?.["text-halo-width"])).toBeGreaterThan(0);
    expect(find(compile(),"place_city").paint?.["text-halo-blur"]).toBe(0);
    cfg.labels.city.halo=true;
    expect(Number(find(compile(),"place_city").paint?.["text-halo-blur"])).toBeGreaterThan(0);
    cfg.labels.city.outline=false;cfg.labels.city.halo=false;
    expect(find(compile(),"place_city").paint?.["text-halo-width"]).toBe(0);
  });
});
