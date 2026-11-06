import type {RoadTier} from "./detailControls";

/**
 * Readability bounds for pastel/light Atlas map recipes. They are intentionally
 * lower than text AA thresholds: roads are non-text cartographic strokes.
 *
 * Calculate the *displayed* contrast after the preset's road opacity is
 * composited over land, rather than comparing opaque palette swatches.
 */
export const LIGHT_LAND_LUMINANCE=.48;
const blend=(a:string,b:string,fraction:number):string=>{
  const t=Math.min(1,Math.max(0,fraction));
  return "#"+[1,3,5].map(i=>{
    const x=parseInt(a.slice(i,i+2),16),y=parseInt(b.slice(i,i+2),16);
    return Math.round(x+(y-x)*t).toString(16).padStart(2,"0");
  }).join("").toUpperCase();
};
const channels=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function relativeRoadLuminance(hex:string):number{
  const [r,g,b]=channels(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*r!+.7152*g!+.0722*b!;
}
export function roadContrastRatio(a:string,b:string):number{
  const u=relativeRoadLuminance(a),v=relativeRoadLuminance(b);
  return (Math.max(u,v)+.05)/(Math.min(u,v)+.05);
}
export function isLightMapSurface(land:string):boolean{
  return relativeRoadLuminance(land)>=LIGHT_LAND_LUMINANCE;
}
export const LIGHT_ROAD_OPACITY_FLOOR:Readonly<Record<RoadTier,number>>={
  motorway:97,primary:94,secondary:82,local:58,paths:48
};
export const LIGHT_ROAD_MIN_CONTRAST:Readonly<Record<RoadTier,number>>={
  motorway:2.3,primary:2.05,secondary:1.72,local:1.44,paths:1.28
};
export function visibleRoadContrast(color:string,land:string,opacity:number):number{
  return roadContrastRatio(blend(land,color,Math.min(1,Math.max(0,opacity))),land);
}
/**
 * For light maps only: retain the theme's hue as long as possible, then draw
 * it toward the theme's label ink until the road survives opacity blending.
 * Never brighten strokes toward white on an already pale background.
 * Ink remains theme-specific, with a neutral deep-ink fallback.
 */
export function ensureLightRoadContrast(
  proposed:string,land:string,labelInk:string,opacity:number,tier:RoadTier
):string{
  if(!isLightMapSurface(land))return proposed;
  const target=LIGHT_ROAD_MIN_CONTRAST[tier];
  if(visibleRoadContrast(proposed,land,opacity)>=target)return proposed;
  const darkInk=relativeRoadLuminance(labelInk)<.23?labelInk:"#263645";
  for(let step=1;step<=40;step++){
    const candidate=blend(proposed,darkInk,step/40);
    if(visibleRoadContrast(candidate,land,opacity)>=target)return candidate;
  }
  const fallback="#152230";
  for(let step=1;step<=40;step++){
    const candidate=blend(darkInk,fallback,step/40);
    if(visibleRoadContrast(candidate,land,opacity)>=target)return candidate;
  }
  return fallback;
}
