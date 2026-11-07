import {describe,it,expect} from "vitest";
import {ATLAS_STYLE_PRESETS,createAtlasPresetDocument} from "./presets";
import {getAtlasPresetAdvancedSettings} from "./presetAdvanced";
import {reskinAtlasPreset} from "./palette";
import {applyAdvancedStyleControls} from "./advancedStyle";
import {ATLAS_SEMANTIC_PROFILE_VERSION,getAtlasPresetSemanticSettings,
 createSemanticOverrides,mergeSemanticOverrides,deriveSemanticOverrides} from "./presetSemantic";
import {SEMANTIC_KEYS,validateSemanticFeatureSettings,applySemanticFeatureControls} from "./semanticFeatures";
import {SEMANTIC_PROVIDER_FIXTURES} from "./semanticProviderFixtures";
import {compileAtlasStyle,inspectStyleLayers,validateStyleDocument} from "./index";
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;

describe("81 Stage 3 semantic theme recipes",()=>{
 it("authors 81 independent valid maps with 23 coloured feature classes",()=>{
   expect(ATLAS_SEMANTIC_PROFILE_VERSION).toBe(1);
   expect(ATLAS_STYLE_PRESETS).toHaveLength(81);
   const fingerprints=new Set<string>();
   for(const p of ATLAS_STYLE_PRESETS){
     const result=getAtlasPresetSemanticSettings(p.id);
     expect(validateSemanticFeatureSettings(result),p.id).toEqual([]);
     expect(SEMANTIC_KEYS).toHaveLength(23);
     for(const k of SEMANTIC_KEYS){
       expect(result[k].color,p.id+" "+k).toMatch(/^#[A-F0-9]{6}$/);
       expect(result[k].opacity,p.id+" "+k).toBeGreaterThanOrEqual(0);
       expect(result[k].opacity,p.id+" "+k).toBeLessThanOrEqual(100);
     }
     fingerprints.add(JSON.stringify(result));
     result.forests.color="#ABCD12";
     expect(getAtlasPresetSemanticSettings(p.id).forests.color).not.toBe("#ABCD12");
   }
   expect(fingerprints.size).toBe(81);
 });
 it("gives contrasting geographic priorities to actual theme purposes",()=>{
   const minimal=getAtlasPresetSemanticSettings("minimal-light"),
    nav=getAtlasPresetSemanticSettings("navigation"),
    hiking=getAtlasPresetSemanticSettings("hiking"),
    maritime=getAtlasPresetSemanticSettings("maritime"),
    survey=getAtlasPresetSemanticSettings("survey"),
    transit=getAtlasPresetSemanticSettings("transit-map");
   expect(minimal.poiShopping.visible).toBe(false);
   expect(nav.poiTransit.iconSize!).toBeGreaterThan(minimal.poiTransit.iconSize!);
   expect(hiking.forests.opacity!).toBeGreaterThan(nav.forests.opacity!);
   expect(maritime.rivers.width!).toBeGreaterThan(nav.rivers.width!);
   expect(survey.countryBorders.width!).toBeGreaterThan(minimal.countryBorders.width!);
   expect(transit.railways.width!).toBeGreaterThan(nav.railways.width!);
   expect(getAtlasPresetSemanticSettings("emergency").poiHealth.visible).toBe(true);
 });
 it("tunes every preset with class-level feature density and functional zoom hierarchy",()=>{
   for(const preset of ATLAS_STYLE_PRESETS){
     const profile=getAtlasPresetSemanticSettings(preset.id);
     expect(profile.poiTransit.zoom.min,preset.id).toBeLessThan(profile.poiShopping.zoom.min!);
     expect(profile.poiHealth.zoom.min,preset.id).toBeLessThan(profile.poiFood.zoom.min!);
     expect(profile.buildings.zoom.min,preset.id).toBeGreaterThanOrEqual(12);
     expect(profile.localBorders.zoom.min,preset.id).toBeGreaterThanOrEqual(8);
     expect(profile.railways.zoom.min,preset.id).toBeGreaterThanOrEqual(9);
   }
   const editorial=getAtlasPresetSemanticSettings("museum");
   const minimal=getAtlasPresetSemanticSettings("minimal-light");
   expect(editorial.buildings.outlineColor).toMatch(/^#[A-F0-9]{6}$/);
   expect(minimal.buildings.outlineColor).toBeNull();
   expect(getAtlasPresetSemanticSettings("high-contrast").poiHealth.iconSize)
     .toBeGreaterThan(minimal.poiHealth.iconSize!);
   expect(getAtlasPresetSemanticSettings("pastel-city").gardens.opacity)
     .toBeGreaterThan(minimal.gardens.opacity!);
   expect(getAtlasPresetSemanticSettings("mint-pop").parks.opacity).toBe(100);
   expect(getAtlasPresetSemanticSettings("graphite-mono").poiShopping.visible).toBe(false);
 });
 it("recolours every secondary shade when a custom palette changes",()=>{
   const old=getAtlasPresetSemanticSettings("paper-ink");
   const fresh=getAtlasPresetSemanticSettings("paper-ink",{
     land:"#151F34",water:"#3D88C9",parks:"#4B9785",buildings:"#34445A",
     labels:"#F5F8FE",boundaries:"#B5D1ED",poi:"#F29B80",transit:"#7FA8E4"
   });
   for(const key of ["waterBodies","rivers","forests","buildings","commercial",
     "poiLandmarks","countryBorders","railways"] as const)
     expect(fresh[key].color,key).not.toBe(old[key].color);
   expect(fresh.waterBodies.color).toBe("#3D88C9");
   expect(validateSemanticFeatureSettings(fresh)).toEqual([]);
 });
 it("rebases only explicitly edited properties on preset switch or reskin",()=>{
   const start=getAtlasPresetSemanticSettings("minimal-light"),target=clone(start);
   target.residential.color="#123ABC";
   target.rivers.width=3.25;
   target.poiFood.visible=true;
   target.poiHealth.zoom.min=11;
   const changes=deriveSemanticOverrides(start,target);
   expect(Object.keys(changes).sort()).toEqual(["residential","rivers","poiFood","poiHealth"].sort());
   const nav=getAtlasPresetSemanticSettings("navigation");
   const merged=mergeSemanticOverrides(nav,changes);
   expect(merged.residential.color).toBe("#123ABC");
   expect(merged.rivers.width).toBe(3.25);
   expect(merged.poiFood.visible).toBe(true);
   expect(merged.poiHealth.zoom.min).toBe(11);
   expect(merged.forests.color).toBe(nav.forests.color);
   const reskin=getAtlasPresetSemanticSettings("navigation",{water:"#B8A3EC",parks:"#65BCA5"});
   expect(mergeSemanticOverrides(reskin,changes).waterBodies.color).toBe("#B8A3EC");
   expect(mergeSemanticOverrides(reskin,changes).forests.color).toBe(reskin.forests.color);
   expect(mergeSemanticOverrides(nav,createSemanticOverrides())).toEqual(nav);
   expect(start.residential.color).not.toBe("#123ABC");
 });
 it("compiles all presets on real Positron and selected themes on three other providers",()=>{
   for(const [provider,base] of Object.entries(SEMANTIC_PROVIDER_FIXTURES)){
     const layers=inspectStyleLayers(base);
     const original=JSON.stringify(base);
     const ids=provider==="positron"?ATLAS_STYLE_PRESETS.map(p=>p.id):
       ["minimal-light","paper-ink","synthwave","hiking","navigation","survey"];
     for(const id of ids){
       const authored=createAtlasPresetDocument(id,layers,{baseStyle:base,includeDetails:false});
       const advanced=applyAdvancedStyleControls(
         authored,layers,getAtlasPresetAdvancedSettings(id),base);
       const applied=applySemanticFeatureControls(
         advanced,layers,getAtlasPresetSemanticSettings(id),base);
       expect(validateStyleDocument(applied),id).toEqual([]);
       expect(applied.metadata?.semanticFeatureVersion).toBe(1);
       const rendered=compileAtlasStyle(base,applied).style;
       expect(rendered.layers.length,provider+" "+id).toBe(base.layers.length);
       expect(Object.keys(rendered.sources)).toEqual(Object.keys(base.sources));
     }
     expect(JSON.stringify(base)).toBe(original);
   }
 });
 it("packages the full semantic design into portable built-in and reskinned style documents",()=>{
   const provider=SEMANTIC_PROVIDER_FIXTURES.bright,layers=inspectStyleLayers(provider);
   const complete=createAtlasPresetDocument("hiking",layers,{baseStyle:provider});
   expect(complete.metadata?.presetSemanticVersion).toBe(1);
   expect(complete.metadata?.semanticFeatureVersion).toBe(1);
   const forestColor=getAtlasPresetSemanticSettings("hiking").forests.color;
   expect(JSON.stringify(complete.layers["landcover-wood"]?.paint)).toContain(forestColor!);
   const custom=reskinAtlasPreset("hiking",
     ["#192737","#6DA7D3","#6CA68C","#F6D6A0","#BD819A"],layers,{baseStyle:provider});
   expect(custom.metadata?.presetSemanticVersion).toBe(1);
   expect(custom.metadata?.semanticFeatureVersion).toBe(1);
   const waterColor=custom.groups.water?.color;
   expect(JSON.stringify(custom.layers["water"]?.paint)).toContain(waterColor!);
   expect(JSON.stringify(complete.layers["water"]?.paint))
     .not.toBe(JSON.stringify(custom.layers["water"]?.paint));
   expect(validateStyleDocument(custom)).toEqual([]);
 });
 it("preserves the Tokyo Neon road and type revert, while updating features",()=>{
   const tokyo=getAtlasPresetAdvancedSettings("tokyo-neon");
   expect(tokyo.labels.city.outline).toBeNull();
   expect(tokyo.labels.city.halo).toBeNull();
   expect(tokyo.roads.local.width).toBe(1.3);
   expect(getAtlasPresetSemanticSettings("tokyo-neon").railways.opacity).toBe(91);
 });
 it("uses crisp, halo-free and glowing typography where intended",()=>{
   const minimal=getAtlasPresetAdvancedSettings("minimal-light");
   const editorial=getAtlasPresetAdvancedSettings("paper-ink");
   const neon=getAtlasPresetAdvancedSettings("synthwave");
   const accessible=getAtlasPresetAdvancedSettings("accessibility-dark");
   expect(minimal.labels.city.outline).toBe(false);
   expect(minimal.labels.city.halo).toBe(false);
   expect(editorial.labels.city.outline).toBe(true);
   expect(editorial.labels.city.halo).toBe(false);
   expect(neon.labels.city.halo).toBe(true);
   expect(accessible.labels.city.outline).toBe(true);
   const arcade=getAtlasPresetAdvancedSettings("arcade");
   const eighties=getAtlasPresetAdvancedSettings("eighties-grid");
   const archive=getAtlasPresetAdvancedSettings("sepia-archive");
   const noir=getAtlasPresetAdvancedSettings("film-noir");
   expect(arcade.labels.city.halo).toBe(true);
   expect(arcade.labels.city.outline).toBe(false);
   expect(eighties.labels.locality.halo).toBe(true);
   expect(eighties.labels.road.halo).toBe(false);
   expect(archive.labels.city.halo).toBe(false);
   expect(archive.labels.city.outline).toBe(true);
   expect(noir.labels.city.outline).toBe(false);
   expect(noir.labels.city.halo).toBe(false);
 });
});
