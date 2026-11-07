import {describe,expect,it} from "vitest";
import {ATLAS_STYLE_PRESETS,getAtlasPreset} from "./presets";
import {getAtlasPresetAdvancedSettings,mergeAdvancedOverrides,
  createAdvancedOverrides} from "./presetAdvanced";
import {getAtlasPresetDetailSettings} from "./presetDetails";
import {
  ensureLightRoadContrast,isLightMapSurface,visibleRoadContrast,
  LIGHT_ROAD_MIN_CONTRAST,LIGHT_ROAD_OPACITY_FLOOR
} from "./roadLegibility";
import {ROAD_TIERS} from "./detailControls";
import {reskinAtlasPreset,deriveSemanticPalette} from "./palette";

describe("Light map road readability",()=>{
  it("keeps every preset on a readable road hierarchy at its intended opacity",()=>{
    let count=0;
    for(const preset of ATLAS_STYLE_PRESETS){
      const light=isLightMapSurface(preset.palette.land);
      const design=getAtlasPresetAdvancedSettings(preset.id);
      const details=getAtlasPresetDetailSettings(preset.id);
      if(!light)continue;
      count++;
      for(const tier of ROAD_TIERS){
        expect(details.roads[tier],preset.id+" "+tier+" opacity").toBeGreaterThanOrEqual(
          LIGHT_ROAD_OPACITY_FLOOR[tier]
        );
        const color=design.roads[tier].color!;
        const visible=visibleRoadContrast(color,preset.palette.land,
          details.roads[tier]/100*(preset.settings?.roadsOpacity??1));
        expect(visible,preset.id+" "+tier+" display contrast").toBeGreaterThanOrEqual(
          LIGHT_ROAD_MIN_CONTRAST[tier]-.018
        );
        const minimumWidth={motorway:3,primary:2.25,secondary:1.65,local:1.05,paths:.85}[tier];
        expect(design.roads[tier].width,preset.id+" "+tier+" px width")
          .toBeGreaterThanOrEqual(minimumWidth);
      }
      expect(design.roads.local.zoom.min,preset.id+" city roads").toBeLessThanOrEqual(12);
      expect(design.roads.secondary.zoom.min,preset.id+" secondary roads").toBeLessThanOrEqual(9);
    }
    expect(count).toBeGreaterThan(30);
  });
  it("preserves the existing dark-theme colour, opacity and width defaults",()=>{
    const preset=getAtlasPreset("minimal-dark");
    expect(isLightMapSurface(preset.palette.land)).toBe(false);
    const info=getAtlasPresetDetailSettings("minimal-dark");
    expect(info.roads.local).toBe(30);
    expect(info.roads.paths).toBe(10);
    const design=getAtlasPresetAdvancedSettings("minimal-dark");
    expect(design.roads.local.width).toBe(.6);
    expect(design.roads.paths.width).toBe(.45);
    expect(ensureLightRoadContrast("#d5dadd",preset.palette.land,preset.palette.labels,.5,"local"))
      .toBe("#d5dadd");
  });
  it("recalculates road contrast when a custom light palette is supplied",()=>{
    const seeds=["#f8f5f1","#bdd1df","#d9e7d7","#ffeeee","#7795bb"];
    const theme=deriveSemanticPalette("minimal-light",seeds);
    const detail=getAtlasPresetDetailSettings("minimal-light");
    expect(isLightMapSurface(theme.land)).toBe(true);
    const advanced=getAtlasPresetAdvancedSettings("minimal-light",theme);
    for(const tier of ROAD_TIERS){
      const ratio=visibleRoadContrast(advanced.roads[tier].color!,theme.land,detail.roads[tier]/100);
      expect(ratio).toBeGreaterThanOrEqual(LIGHT_ROAD_MIN_CONTRAST[tier]-.018);
    }
    const doc=reskinAtlasPreset("minimal-light",seeds);
    expect(doc.groups.land?.color).toBe(theme.land);
  });
  it("does not override a designer's explicit pale road colour",()=>{
    const base=getAtlasPresetAdvancedSettings("minimal-light");
    const merged=mergeAdvancedOverrides(base,{
      ...createAdvancedOverrides(),
      roads:{primary:{color:"#ffffff"}}
    });
    expect(merged.roads.primary.color).toBe("#ffffff");
    expect(base.roads.primary.color).not.toBe("#ffffff");
  });
  it("uses an opacity-aware contrast test rather than colour alone",()=>{
    const land="#f8f8f5",lightStroke="#fefefd",ink="#364758";
    const chosen=ensureLightRoadContrast(lightStroke,land,ink,.75,"secondary");
    expect(chosen).not.toBe(lightStroke);
    expect(visibleRoadContrast(chosen,land,.75)).toBeGreaterThanOrEqual(
      LIGHT_ROAD_MIN_CONTRAST.secondary-.018
    );
  });
});
