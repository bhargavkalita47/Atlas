import type {Map as MapLibreMap} from "maplibre-gl";

/** Physical canvas pixel density. This never changes the map's logical zoom. */
export type ResolutionQuality = "balanced" | "high";
export type ResolutionPhase = "moving" | "idle";
export interface ResolutionState {
  phase: ResolutionPhase;
  pixelRatio: number;
}
export interface AdaptiveResolutionOptions {
  quality: ResolutionQuality;
  enabled?: boolean;
  /** Captured at construction so device scaling is consistent. */
  devicePixelRatio?: number;
  /** Ignore very brief moves so canvas resizes aren't more expensive than the move. */
  activationDelayMs?: number;
  /** Wait after a gesture finishes to avoid toggling rapidly. */
  restoreDelayMs?: number;
  onChange?: (state:ResolutionState)=>void;
}
export interface AdaptiveResolutionController {
  update(options:Pick<AdaptiveResolutionOptions,"quality"|"enabled">):void;
  dispose():void;
}
export function basePixelRatio(quality:ResolutionQuality,deviceRatio:number):number{
  const device=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
  return quality==="high"?device:Math.min(device,1.5);
}

/**
 * Use MapLibre's native pixel-ratio override instead of CSS scaling.
 * Map.setPixelRatio triggers a synchronous resize that may itself fire
 * movestart/moveend; the reentrancy guard is essential to avoid feedback.
 *
 * Runs only when the camera actually moves, not on every render frame.
 * There is one downshift at most per long gesture, then one restoration.
 */
export function createAdaptiveResolutionController(
  map:MapLibreMap, options:AdaptiveResolutionOptions
):AdaptiveResolutionController {
  let quality=options.quality;
  let enabled=options.enabled??true;
  const device=Number.isFinite(options.devicePixelRatio)
    ? options.devicePixelRatio!
    : typeof window!=="undefined"?(window.devicePixelRatio||1):1;
  const startDelay=Math.max(0,options.activationDelayMs??70);
  const endDelay=Math.max(0,options.restoreDelayMs??180);
  let applied=map.getPixelRatio();
  let moving=false;
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
    if(disposed)return;
    const base=basePixelRatio(quality,device);
    const desired=reduced&&enabled?Math.min(base,1):base;
    if(Math.abs(desired-applied)<.01)return;
    changing=true;
    try{
      map.setPixelRatio(desired);
      applied=desired;
      options.onChange?.({phase:reduced&&enabled?"moving":"idle",pixelRatio:desired});
    }finally{changing=false;}
  };
  const begin=()=>{
    if(disposed||changing)return;
    moving=true;
    cancelRestoration();
    if(!enabled||reduced||activation!==undefined)return;
    activation=setTimeout(()=>{
      activation=undefined;
      if(disposed||!moving||!enabled)return;
      reduced=true;
      setRatio();
    },startDelay);
  };
  const end=()=>{
    if(disposed||changing)return;
    moving=false;
    cancelActivation();
    if(!reduced)return;
    cancelRestoration();
    restoration=setTimeout(()=>{
      restoration=undefined;
      if(disposed||moving)return;
      reduced=false;
      setRatio();
    },endDelay);
  };
  map.on("movestart",begin);
  map.on("moveend",end);
  options.onChange?.({phase:"idle",pixelRatio:applied});

  return {
    update(next){
      if(disposed)return;
      quality=next.quality;
      const wasEnabled=enabled;
      enabled=next.enabled??true;
      if(!enabled){
        cancelActivation();
        cancelRestoration();
        reduced=false;
        setRatio();
      }else if(moving&&!reduced){
        // Enabling adaptive scaling during an active gesture starts the timer.
        if(!wasEnabled)begin();
        setRatio();
      }else{
        setRatio();
      }
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      cancelActivation();
      cancelRestoration();
      map.off("movestart",begin);
      map.off("moveend",end);
    }
  };
}
