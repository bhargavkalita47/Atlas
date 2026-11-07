import {
  createAtlasPresetDocument,getAtlasPreset,
  type AtlasPresetDefinition,type AtlasPresetDocumentOptions
} from "./presets";
import type {AtlasStyleDocument,StyleGroup,StyleLayerDescriptor} from "./index";
import {applyMapDetailControls} from "./detailControls";
import {getAtlasPresetDetailSettings} from "./presetDetails";
import {applyAdvancedStyleControls} from "./advancedStyle";
import {getAtlasPresetAdvancedSettings} from "./presetAdvanced";

/**
 * Atlas Palette Reskin Engine v1. Works only on CSS-free, opaque sRGB hex
 * seeds and style v2 semantic colours; it does not modify provider data.
 * Input order is retained as a creative ordering fallback. Role detection is
 * automatic; labels are adjusted to meet 4.5:1 contrast against the land.
 */
export type PaletteSlots=readonly [string,string,string,string,...string[]];
export const PALETTE_MIN_COLORS=4;
export const PALETTE_MAX_COLORS=6;
export function normalizeHexColor(value:string):string {
  const s=value.trim();
  if(/^#[0-9a-f]{3}$/i.test(s))return "#"+s.slice(1).split("").map(c=>c+c).join("").toUpperCase();
  if(/^#[0-9a-f]{6}$/i.test(s))return s.toUpperCase();
  throw new Error("Invalid hex colour: "+value);
}
export function validatePaletteSeeds(values:readonly string[]):string[]{
  if(values.length<4||values.length>6)
    throw new Error("A palette must contain 4 to 6 colours.");
  return values.map(normalizeHexColor);
}
export function parseHexPalette(text:string):string[]{
  if(text.length>1024)throw new Error("Palette text is too long.");
  const tokens=text.trim().split(/[\s,;|]+/).filter(Boolean);
  return validatePaletteSeeds(tokens);
}
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const rgb=(hex:string):[number,number,number]=>{
  const s=normalizeHexColor(hex);
  return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255) as [number,number,number];
};
const srgbToLinear=(x:number)=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
const linearToSrgb=(x:number)=>x<=.0031308?12.92*x:1.055*Math.pow(Math.max(0,x),1/2.4)-.055;
const toOKLab=(color:string):[number,number,number]=>{
  const [r,g,b]=rgb(color).map(srgbToLinear);
  const l=Math.cbrt(.4122214708*r!+.5363325363*g!+.0514459929*b!);
  const m=Math.cbrt(.2119034982*r!+.6806995451*g!+.1073969566*b!);
  const s=Math.cbrt(.0883024619*r!+.2817188376*g!+.6299787005*b!);
  return [.2104542553*l+.793617785*m-.0040720468*s,
    1.9779984951*l-2.428592205*m+.4505937099*s,
    .0259040371*l+.7827717662*m-.808675766*s];
};
const fromOKLab=(lab:readonly number[]):string=>{
  const [L,a,b]=lab;
  const l=(L!+.3963377774*a!+.2158037573*b!)**3;
  const m=(L!-.1055613458*a!-.0638541728*b!)**3;
  const s=(L!-.0894841775*a!-1.291485548*b!)**3;
  const channels=[
    +4.0767416621*l-3.3077115913*m+.2309699292*s,
    -1.2684380046*l+2.6097574011*m-.3413193965*s,
    -.0041960863*l-.7034186147*m+1.707614701*s
  ];
  return "#"+channels.map(c=>Math.round(clamp(linearToSrgb(c))*255).toString(16).padStart(2,"0")).join("").toUpperCase();
};
export function mixPaletteColors(a:string,b:string,weight:number):string{
  const w=clamp(weight);
  if(w===0)return normalizeHexColor(a);
  if(w===1)return normalizeHexColor(b);
  const x=toOKLab(a),y=toOKLab(b);
  return fromOKLab(x.map((v,i)=>v*(1-w)+y[i]!*w));
}
export function relativeLuminance(hex:string):number{
  const [r,g,b]=rgb(hex).map(srgbToLinear);
  return .2126*r!+.7152*g!+.0722*b!;
}
export function contrastRatio(a:string,b:string):number{
  const x=relativeLuminance(a),y=relativeLuminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
function hue(hex:string):number{
  const [r,g,b]=rgb(hex);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),diff=max-min;
  if(diff<.0001)return 0;
  let angle=max===r?((g!-b!)/diff)%6:max===g?(b!-r!)/diff+2:(r!-g!)/diff+4;
  if(angle<0)angle+=6;
  return angle*60;
}
function chroma(hex:string):number{
  const lab=toOKLab(hex);
  return Math.sqrt(lab[1]!*lab[1]!+lab[2]!*lab[2]!);
}
function pickHue(colors:readonly string[],target:number,backup:number):string{
  let best:string|undefined;
  let score=10000;
  for(const color of colors){
    const distance=Math.abs(hue(color)-target);
    const hueDelta=Math.min(distance,360-distance);
    const penalty=chroma(color)<.045?150:0;
    if(hueDelta+penalty<score){score=hueDelta+penalty;best=color;}
  }
  return score<=75&&best?best:colors[backup%colors.length]!;
}
function accessibleInk(surface:string,chosen:string,dark:boolean):string{
  const extreme=dark?"#FFFFFF":"#080D16";
  if(contrastRatio(surface,chosen)>=4.5)return chosen;
  for(let i=1;i<=30;i++){
    const candidate=mixPaletteColors(chosen,extreme,i/30);
    if(contrastRatio(surface,candidate)>=4.5)return candidate;
  }
  return extreme;
}
export type SemanticPalette=Record<StyleGroup,string>;
export function deriveSemanticPalette(presetId:string,input:readonly string[]):SemanticPalette{
  const colors=validatePaletteSeeds(input);
  const preset=getAtlasPreset(presetId);
  const dark=relativeLuminance(preset.palette.land)<.22;
  const sorted=[...colors].sort((a,b)=>relativeLuminance(a)-relativeLuminance(b));
  const darkest=sorted[0]!,lightest=sorted[sorted.length-1]!;
  const landAnchor=dark?darkest:lightest;
  // Retain the selected preset's overall tonality, even if the input palette
  // contains only saturated or similarly light-coloured swatches.
  const surface=mixPaletteColors(
    mixPaletteColors(preset.palette.land,landAnchor,.65),
    dark?"#0D141C":"#FAFAF8",dark?.37:.43
  );
  const blue=mixPaletteColors(colors[1]!,pickHue(colors,210,1),.52);
  const green=mixPaletteColors(colors[2]!,pickHue(colors,130,2),.52);
  const secondary=colors[Math.min(3,colors.length-1)]!;
  const accent=colors[colors.length-1]!;
  const water=mixPaletteColors(surface,blue,dark?.66:.51);
  const parks=mixPaletteColors(surface,green,dark?.57:.43);
  const buildings=mixPaletteColors(surface,secondary,dark?.45:.33);
  const roads=dark
    ?mixPaletteColors(surface,lightest,preset.family==="utility"?.72:.48)
    :mixPaletteColors(surface,"#FFFFFF",preset.family==="utility"?.94:.77);
  const labels=accessibleInk(surface,dark?lightest:darkest,dark);
  return {
    land:surface,
    water,
    parks,
    roads,
    buildings,
    labels,
    boundaries:mixPaletteColors(mixPaletteColors(surface,labels,dark?.68:.46),colors[0]!, .22),
    transit:mixPaletteColors(surface,colors[Math.min(4,colors.length-1)]!,dark?.85:.75),
    poi:mixPaletteColors(surface,accent,dark?.88:.76),
    terrain:mixPaletteColors(surface,colors[2]!,dark?.38:.28),
  };
}
export function reskinAtlasPreset(
  presetId:string,
  input:readonly string[],
  layers:readonly StyleLayerDescriptor[]=[],
  options:AtlasPresetDocumentOptions={}
):AtlasStyleDocument {
  const colors=validatePaletteSeeds(input);
  const document=createAtlasPresetDocument(presetId,layers,{...options,includeDetails:false});
  const roles=deriveSemanticPalette(presetId,colors);
  for(const [role,color] of Object.entries(roles))
    document.groups[role as StyleGroup]={...document.groups[role as StyleGroup],color};
  document.id=presetId+"-palette";
  document.name=getAtlasPreset(presetId).name+" · Custom palette";
  document.metadata={...document.metadata,preset:presetId,customPalette:colors,
    paletteEngineVersion:1,paletteReskin:true};
  if(options.includeDetails===false)return document;
  const styled=applyMapDetailControls(document,layers,getAtlasPresetDetailSettings(presetId),options.baseStyle);
  return applyAdvancedStyleControls(styled,layers,getAtlasPresetAdvancedSettings(presetId,roles),options.baseStyle);
}
