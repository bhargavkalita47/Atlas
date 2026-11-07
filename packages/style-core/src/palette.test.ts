import {describe,expect,it} from "vitest";
import {
  PALETTE_MAX_COLORS,PALETTE_MIN_COLORS,contrastRatio,
  deriveSemanticPalette,normalizeHexColor,parseHexPalette,
  reskinAtlasPreset,validatePaletteSeeds
} from "./palette";
import {ATLAS_STYLE_PRESETS} from "./presets";
import {inspectStyleLayers,compileAtlasStyle,stringifyAtlasStyleDocument,parseAtlasStyleDocument} from "./index";
const input=["#123","#4A8BBE","#D0A080","#B8CF5A","#EE6688"];
const fixture={version:8,sources:{},layers:[
  {id:"background",type:"background",paint:{"background-color":"#ffffff"}},
  {id:"road-primary",type:"line",paint:{"line-color":"#333333","line-width":3}},
  {id:"natural-water",type:"fill",paint:{"fill-color":"#0000ff"}},
  {id:"place-label",type:"symbol",paint:{"text-color":"#222222"}},
]};
describe("palette reskin engine",()=>{
  it("accepts 4-6 colours, including short hex and pasted lists",()=>{
    expect(PALETTE_MIN_COLORS).toBe(4);
    expect(PALETTE_MAX_COLORS).toBe(6);
    expect(normalizeHexColor("#fab")).toBe("#FFAABB");
    expect(parseHexPalette(" #fab, #a1b2c3\n#444; #ffffff ")).toEqual(["#FFAABB","#A1B2C3","#444444","#FFFFFF"]);
    const six=[...input,"#334466"];
    for(let n=4;n<=6;n++)expect(validatePaletteSeeds(six.slice(0,n))).toHaveLength(n);
    expect(()=>validatePaletteSeeds(input.slice(0,3))).toThrow("4 to 6");
    expect(()=>validatePaletteSeeds([...input,"#FFFFFF","#000000"])).toThrow("4 to 6");
    expect(()=>parseHexPalette("red #FFFFFF #222222 #abcdef")).toThrow();
    expect(()=>normalizeHexColor("transparent")).toThrow();
  });
  it("produces 10 deterministic, valid semantic colours with readable labels for every preset",()=>{
    const base=[...input,"#113C49"];
    for(const preset of ATLAS_STYLE_PRESETS){
      for(const length of [4,5,6]){
        const roles=deriveSemanticPalette(preset.id,base.slice(0,length));
        expect(Object.values(roles)).toHaveLength(10);
        expect(Object.values(roles).every(c=>/^#[0-9A-F]{6}$/.test(c))).toBe(true);
        expect(contrastRatio(roles.labels,roles.land)).toBeGreaterThanOrEqual(4.5);
        expect(deriveSemanticPalette(preset.id,base.slice(0,length))).toEqual(roles);
      }
    }
  });
  it("does not modify preset structure, source layers or input colours",()=>{
    const colors=[...input];
    const doc=reskinAtlasPreset("blueprint",colors,inspectStyleLayers(fixture));
    const compiled=compileAtlasStyle(fixture,doc);
    expect(colors).toEqual(input);
    expect(doc.baseStyle).toBe("dark");
    expect(doc.metadata?.customPalette).toEqual(["#112233","#4A8BBE","#D0A080","#B8CF5A","#EE6688"]);
    expect(doc.layers["road-primary"]?.paint?.["line-width"]).toBeDefined();
    expect((compiled.style.layers as unknown[]).length).toBe(4);
    expect(doc.groups.land?.color).not.toBe("#102B4B");
    expect(stringifyAtlasStyleDocument(parseAtlasStyleDocument(stringifyAtlasStyleDocument(doc)))).toBe(stringifyAtlasStyleDocument(doc));
  });
  it("retains visual differences between presets given the same palette",()=>{
    const light=deriveSemanticPalette("minimal-light",input);
    const dark=deriveSemanticPalette("minimal-dark",input);
    expect(light.land).not.toBe(dark.land);
    expect(light.roads).not.toBe(dark.roads);
  });
  it("uses every one of six supplied swatches in at least one generated role",()=>{
    const six=["#162534","#76B8DB","#8DBD88","#DFA589","#C77BAA","#E7E9D4"];
    const original=deriveSemanticPalette("minimal-light",six);
    for(let index=0;index<six.length;index++){
      const modified=[...six];
      modified[index]="#000000";
      expect(deriveSemanticPalette("minimal-light",modified)).not.toEqual(original);
    }
  });
  it("does not silently allow degenerate same-colour seeds to make labels unreadable",()=>{
    for(const preset of ["minimal-light","minimal-dark","high-contrast"]){
      const roles=deriveSemanticPalette(preset,["#777777","#777777","#777777","#777777"]);
      expect(contrastRatio(roles.land,roles.labels)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
