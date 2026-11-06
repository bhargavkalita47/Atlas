import {describe,expect,it} from "vitest";
import {ATLAS_STYLE_PRESETS,type StyleLayerDescriptor} from "@atlas/style-core";
import {StudioPresetCache} from "./studioCache";

const layer=(id:string,group:StyleLayerDescriptor["suggestedGroup"]):StyleLayerDescriptor=>({
  id,type:id.includes("road")?"line":"fill",suggestedGroup:group,suggestionOnly:true,
  source:"test",sourceLayer:id
});
const layers=[layer("background","land"),layer("road-primary","roads"),layer("river","water")];

describe("Atlas Lab studio preset memory cache",()=>{
  it("warms the whole library for one loaded base and avoids style switches",()=>{
    const cache=new StudioPresetCache();
    expect(cache.ready).toBe(false);
    expect(cache.prepare("positron",layers)).toBe(true);
    expect(cache.size).toBe(ATLAS_STYLE_PRESETS.length);
    expect(cache.prepare("positron",layers)).toBe(false);
    for(const preset of ATLAS_STYLE_PRESETS){
      const doc=cache.get(preset.id);
      expect(doc.baseStyle).toBe("positron");
      expect(doc.bindings.roads).toEqual(["road-primary"]);
      expect(doc.groups.land?.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("keeps cached originals immutable when an editor changes the returned document",()=>{
    const cache=new StudioPresetCache();
    cache.prepare("liberty",layers);
    const first=cache.get("paper-ink");
    first.groups.land!.color="#000000";
    first.layers["road-primary"]={paint:{"line-width":99}};
    const second=cache.get("paper-ink");
    expect(second.groups.land!.color).not.toBe("#000000");
    expect(second.layers["road-primary"]).toBeUndefined();
  });
  it("reuses custom palette results and invalidates when the user changes a base",()=>{
    const cache=new StudioPresetCache();
    cache.prepare("positron",layers);
    const colors=["#f6f0de","#84aabb","#a3c9a5","#d7928c","#354754"];
    const doc=cache.get("blueprint",colors);
    doc.groups.water!.color="#000000";
    const next=cache.get("blueprint",colors);
    expect(next.groups.water?.color).not.toBe("#000000");
    expect(next.baseStyle).toBe("positron");
    cache.prepare("bright",layers);
    expect(cache.get("blueprint",colors).baseStyle).toBe("bright");
  });
  it("refreshes layer bindings if the provider changes the layer inventory",()=>{
    const cache=new StudioPresetCache();
    cache.prepare("positron",layers);
    cache.prepare("positron",[...layers,layer("district","boundaries")]);
    expect(cache.get("minimal-light").bindings.boundaries).toEqual(["district"]);
  });
});
