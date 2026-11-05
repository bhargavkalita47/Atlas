import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {Map as MapLibreMap} from "maplibre-gl";
import {
  basePixelRatio,createAdaptiveResolutionController,type ResolutionState
} from "./adaptiveResolution";

class FakeMap{
  ratio:number;
  writes:number[]=[];
  eventWindow=new EventTarget();
  handlers=new Map<string,Set<()=>void>>();
  getCanvas(){return {ownerDocument:{defaultView:this.eventWindow}};}
  constructor(ratio:number){this.ratio=ratio;}
  on(event:string,fn:()=>void){
    const handlers=this.handlers.get(event)??new Set<()=>void>();
    handlers.add(fn);
    this.handlers.set(event,handlers);
    return this;
  }
  off(event:string,fn:()=>void){
    this.handlers.get(event)?.delete(fn);
    return this;
  }
  getPixelRatio(){return this.ratio;}
  setPixelRatio(value:number){
    this.ratio=value;
    this.writes.push(value);
    // MapLibre setPixelRatio calls map.resize, which synchronously emits
    // movestart/moveend. Guard against unintended self-triggered transitions.
    this.fire("movestart");
    this.fire("moveend");
  }
  fire(event:"movestart"|"moveend"|"zoomstart"|"zoomend"){
    for(const callback of this.handlers.get(event)??[])callback();
  }
}
const asMap=(fake:FakeMap)=>fake as unknown as MapLibreMap;

describe("Atlas adaptive WebGL resolution",()=>{
  beforeEach(()=>vi.useFakeTimers());
  afterEach(()=>vi.useRealTimers());
  it("computes balanced and high baselines without invalid pixel ratios",()=>{
    expect(basePixelRatio("balanced",3)).toBe(1.5);
    expect(basePixelRatio("high",3)).toBe(3);
    expect(basePixelRatio("high",0)).toBe(1);
    expect(basePixelRatio("balanced",Number.NaN)).toBe(1);
  });
  it("lowers resolution only after sustained movement and restores after a pause",()=>{
    const fake=new FakeMap(1.5);
    const changes:ResolutionState[]=[];
    const ctrl=createAdaptiveResolutionController(asMap(fake),{
      quality:"balanced",devicePixelRatio:3,onChange:change=>changes.push(change)
    });
    expect(changes[0]).toEqual({phase:"idle",pixelRatio:1.5});
    fake.fire("movestart");
    vi.advanceTimersByTime(139);
    expect(fake.writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fake.writes).toEqual([1]);
    fake.fire("moveend");
    vi.advanceTimersByTime(419);
    expect(fake.writes).toEqual([1]);
    vi.advanceTimersByTime(1);
    expect(fake.writes).toEqual([1,1.5]);
    expect(changes.slice(1)).toEqual([
      {phase:"moving",pixelRatio:1},{phase:"idle",pixelRatio:1.5}
    ]);
    ctrl.dispose();
  });
  it("does not oscillate or schedule duplicate changes on rapid gestures",()=>{
    const fake=new FakeMap(1.5);
    const ctrl=createAdaptiveResolutionController(asMap(fake),{
      quality:"balanced",devicePixelRatio:3
    });
    fake.fire("movestart");
    vi.advanceTimersByTime(145);
    expect(fake.writes).toEqual([1]);
    fake.fire("moveend");
    vi.advanceTimersByTime(100);
    fake.fire("movestart");
    vi.advanceTimersByTime(250);
    expect(fake.writes).toEqual([1]); // first restoration was canceled
    fake.fire("moveend");
    vi.advanceTimersByTime(420);
    expect(fake.writes).toEqual([1,1.5]);
    ctrl.dispose();
  });
  it("honors quality changes and disable/enable without rebuilding a map",()=>{
    const fake=new FakeMap(1.5);
    const ctrl=createAdaptiveResolutionController(asMap(fake),{
      quality:"balanced",devicePixelRatio:3
    });
    ctrl.update({quality:"high",enabled:true});
    expect(fake.ratio).toBe(3);
    fake.fire("movestart");
    vi.advanceTimersByTime(140);
    expect(fake.ratio).toBe(1);
    ctrl.update({quality:"balanced",enabled:false});
    expect(fake.ratio).toBe(1.5);
    vi.advanceTimersByTime(1000);
    expect(fake.ratio).toBe(1.5);
    fake.fire("moveend");
    ctrl.update({quality:"balanced",enabled:true});
    fake.fire("movestart");
    vi.advanceTimersByTime(140);
    expect(fake.ratio).toBe(1);
    fake.fire("moveend");
    vi.advanceTimersByTime(420);
    expect(fake.ratio).toBe(1.5);
    ctrl.dispose();
  });
  it("recovers from a missing moveend using pointer release",()=>{
    const fake=new FakeMap(1.5);
    const ctrl=createAdaptiveResolutionController(asMap(fake),{
      quality:"balanced",devicePixelRatio:3
    });
    fake.fire("movestart");
    vi.advanceTimersByTime(140);
    expect(fake.ratio).toBe(1);
    // Emulate a drag-handler interruption after a framebuffer resize:
    // no MapLibre moveend event arrives.
    fake.eventWindow.dispatchEvent(new Event("pointerup"));
    vi.advanceTimersByTime(419);
    expect(fake.ratio).toBe(1);
    vi.advanceTimersByTime(1);
    expect(fake.ratio).toBe(1.5);
    ctrl.dispose();
  });
  it("never reallocates the canvas during bursts of zoom in/out",()=>{
    const fake=new FakeMap(1.5);
    const ctrl=createAdaptiveResolutionController(asMap(fake),{
      quality:"balanced",devicePixelRatio:3
    });
    for(let i=0;i<30;i++){
      fake.fire("movestart");
      fake.fire("zoomstart");
      vi.advanceTimersByTime(155);
      fake.fire("zoomend");
      fake.fire("moveend");
      vi.advanceTimersByTime(50);
    }
    expect(fake.writes).toEqual([]);
    vi.advanceTimersByTime(600);
    expect(fake.writes).toEqual([]);
    ctrl.dispose();
  });
  it("defer quality changes until zoom animation settles",()=>{
    const fake=new FakeMap(1.5);
    const changes:ResolutionState[]=[];
    const ctrl=createAdaptiveResolutionController(asMap(fake),{
      quality:"balanced",devicePixelRatio:3,onChange:s=>changes.push(s)
    });
    fake.fire("zoomstart");
    ctrl.update({quality:"high",enabled:true});
    vi.advanceTimersByTime(700);
    expect(fake.writes).toEqual([]);
    fake.fire("zoomend");
    vi.advanceTimersByTime(419);
    expect(fake.writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fake.writes).toEqual([3]);
    expect(changes[changes.length-1]).toEqual({phase:"idle",pixelRatio:3});
    ctrl.dispose();
  });
  it("keeps an already reduced pan canvas unchanged through a pinch zoom",()=>{
    const fake=new FakeMap(1.5);
    const ctrl=createAdaptiveResolutionController(asMap(fake),{
      quality:"balanced",devicePixelRatio:3
    });
    fake.fire("movestart");
    vi.advanceTimersByTime(140);
    expect(fake.writes).toEqual([1]);
    fake.fire("zoomstart");
    fake.fire("moveend");
    vi.advanceTimersByTime(650);
    expect(fake.writes).toEqual([1]);
    fake.fire("zoomend");
    vi.advanceTimersByTime(420);
    expect(fake.writes).toEqual([1,1.5]);
    ctrl.dispose();
  });
  it("does no resizing when a one-pixel-ratio device is already at its limit",()=>{
    const fake=new FakeMap(1);
    const ctrl=createAdaptiveResolutionController(asMap(fake),{
      quality:"balanced",devicePixelRatio:1
    });
    fake.fire("movestart");
    vi.advanceTimersByTime(100);
    fake.fire("moveend");
    vi.advanceTimersByTime(500);
    expect(fake.writes).toEqual([]);
    ctrl.dispose();
  });
  it("cleans up event handlers and timers on unmount",()=>{
    const fake=new FakeMap(1.5);
    const ctrl=createAdaptiveResolutionController(asMap(fake),{
      quality:"balanced",devicePixelRatio:3
    });
    fake.fire("movestart");
    ctrl.dispose();
    vi.advanceTimersByTime(1000);
    fake.fire("movestart");
    fake.fire("moveend");
    expect(fake.writes).toEqual([]);
    expect(fake.handlers.get("movestart")?.size).toBe(0);
    expect(fake.handlers.get("moveend")?.size).toBe(0);
    expect(fake.handlers.get("zoomstart")?.size).toBe(0);
    expect(fake.handlers.get("zoomend")?.size).toBe(0);
  });
});
