import type {Map as MapLibreMap} from "maplibre-gl";

/** Physical canvas pixel density; geographical zoom and tile detail are unchanged. */
export type ResolutionQuality="balanced"|"high";
export type ResolutionPhase="moving"|"idle";
export interface ResolutionState{
  phase:ResolutionPhase;
  pixelRatio:number;
}
export interface AdaptiveResolutionOptions{
  quality:ResolutionQuality;
  enabled?:boolean;
  devicePixelRatio?:number;
  /** Only reduce resolution during sustained pan, never during zoom. */
  activationDelayMs?:number;
  /** Restore after a quiet interval, avoiding repeated GPU reallocations. */
  restoreDelayMs?:number;
  onChange?:(state:ResolutionState)=>void;
}
export interface AdaptiveResolutionController{
  update(options:Pick<AdaptiveResolutionOptions,"quality"|"enabled">):void;
  dispose():void;
}
export function basePixelRatio(quality:ResolutionQuality,deviceRatio:number):number{
  const device=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
  return quality==="high"?device:Math.min(device,1.5);
}

/**
 * Calling MapLibre's setPixelRatio reallocates the WebGL canvas and calls
 * map.resize(). Resizing in the middle of a fast wheel/pinch zoom can stall the
 * browser, so adaptive downscaling is limited to sustained *non-zooming* pans.
 *
 * A 420 ms quiet period also coalesces rapid gesture reversals. Both pixel
 * ratio changes and event-handler callbacks are bounded to one transition
 * per long pan and one restoration after it fully ends.
 */
export function createAdaptiveResolutionController(
  map:MapLibreMap,options:AdaptiveResolutionOptions
):AdaptiveResolutionController{
  let quality=options.quality;
  let enabled=options.enabled??true;
  const device=Number.isFinite(options.devicePixelRatio)
    ? options.devicePixelRatio!
    : typeof window!=="undefined"?(window.devicePixelRatio||1):1;
  const activationDelay=Math.max(0,options.activationDelayMs??140);
  const restoreDelay=Math.max(0,options.restoreDelayMs??420);
  let applied=map.getPixelRatio();
  let moving=false;
  let zooming=false;
  let reduced=false;
  let disposed=false;
  let changing=false;
  let activation:ReturnType<typeof setTimeout>|undefined;
  let restoration:ReturnType<typeof setTimeout>|undefined;
  const cancelActivation=()=>{
    if(activation!==undefined){clearTimeout(activation);activation=undefined;}
  };
  const cancelRestoration=()=>{
    if(restoration!==undefined){clearTimeout(restoration);restoration=undefined;}
  };
  const setRatio=()=>{
    // Never resize the framebuffer during an active zoom animation.
    if(disposed||zooming||changing)return;
    const baseline=basePixelRatio(quality,device);
    const next=enabled&&reduced?Math.min(baseline,1):baseline;
    if(Math.abs(next-applied)<.01)return;
    changing=true;
    try{
      map.setPixelRatio(next);
      applied=next;
      options.onChange?.({phase:enabled&&reduced?"moving":"idle",pixelRatio:next});
    }finally{changing=false;}
  };
  const scheduleActivation=()=>{
    if(disposed||!enabled||reduced||zooming||!moving||activation!==undefined)return;
    activation=setTimeout(()=>{
      activation=undefined;
      if(disposed||!moving||zooming||!enabled)return;
      reduced=true;
      setRatio();
    },activationDelay);
  };
  const scheduleRestore=()=>{
    cancelRestoration();
    // Delay even if not reduced: a quality toggle during zoom is applied when
    // zoom settles, without triggering an expensive resize mid-animation.
    restoration=setTimeout(()=>{
      restoration=undefined;
      if(disposed||moving||zooming)return;
      reduced=false;
      setRatio();
    },restoreDelay);
  };
  const startMove=()=>{
    if(disposed||changing)return;
    moving=true;
    cancelRestoration();
    scheduleActivation();
  };
  const endMove=()=>{
    if(disposed||changing)return;
    moving=false;
    cancelActivation();
    if(!zooming)scheduleRestore();
  };
  const startZoom=()=>{
    if(disposed||changing)return;
    zooming=true;
    cancelActivation();
    cancelRestoration();
  };
  const endZoom=()=>{
    if(disposed||changing)return;
    zooming=false;
    if(!moving)scheduleRestore();
    // If the user is panning as the pinch finishes, the next pan segment can
    // downscale, but never while a zoom animation remains active.
    else scheduleActivation();
  };
  map.on("movestart",startMove);
  map.on("moveend",endMove);
  map.on("zoomstart",startZoom);
  map.on("zoomend",endZoom);
  // A mid-gesture map.resize() may interrupt MapLibre's drag handler before
  // it emits moveend. Always release the pending downshift after pointerup,
  // even when that movement-end event is missed.
  const ownerWindow=map.getCanvas?.()?.ownerDocument?.defaultView;
  const releasePointer=()=>{
    if(moving)endMove();
  };
  ownerWindow?.addEventListener("pointerup",releasePointer,{passive:true});
  ownerWindow?.addEventListener("pointercancel",releasePointer,{passive:true});
  ownerWindow?.addEventListener("touchend",releasePointer,{passive:true});
  ownerWindow?.addEventListener("mouseup",releasePointer,{passive:true});
  ownerWindow?.addEventListener("blur",releasePointer);
  options.onChange?.({phase:"idle",pixelRatio:applied});

  return{
    update(next){
      if(disposed)return;
      quality=next.quality;
      enabled=next.enabled??true;
      if(!enabled){
        cancelActivation();
        reduced=false;
        // Do not force a canvas resize during a pinch/scroll zoom.
        if(zooming)scheduleRestore();
        else setRatio();
      }else if(zooming){
        // Quality changes while zooming are deferred until the last zoomend.
        scheduleRestore();
      }else{
        scheduleActivation();
        setRatio();
      }
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      cancelActivation();
      cancelRestoration();
      map.off("movestart",startMove);
      map.off("moveend",endMove);
      map.off("zoomstart",startZoom);
      map.off("zoomend",endZoom);
      ownerWindow?.removeEventListener("pointerup",releasePointer);
      ownerWindow?.removeEventListener("pointercancel",releasePointer);
      ownerWindow?.removeEventListener("touchend",releasePointer);
      ownerWindow?.removeEventListener("mouseup",releasePointer);
      ownerWindow?.removeEventListener("blur",releasePointer);
    }
  };
}
