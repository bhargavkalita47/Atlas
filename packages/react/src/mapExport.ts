import type {Map as MapLibreMap} from "maplibre-gl";
import type {MarkerData} from "@atlas/core";

const escapeXml=(value:string)=>value.replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"
}[c]!));
const markerColor=(value:string|undefined)=>value&&/^#[0-9a-f]{6}$/i.test(value)?value:"#5365da";
const attribution=(map:MapLibreMap)=>
  map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.textContent?.trim()||
  "© OpenStreetMap contributors";
const targetSize=(map:MapLibreMap)=>{
  const canvas=map.getCanvas();
  return {width:canvas.clientWidth||map.getContainer().clientWidth,
    height:canvas.clientHeight||map.getContainer().clientHeight};
};

/** SVG geometry comes from the actual styled vector data, not a PNG data URI. */
export async function exportVectorSvg(map:MapLibreMap,markers:readonly MarkerData[]):Promise<Blob>{
  if(!map.isStyleLoaded())throw new Error("Map style is still loading. Try again when the map is ready.");
  const {width,height}=targetSize(map);
  if(width<=0||height<=0)throw new Error("Map viewport is not visible.");
  // Keep the large SVG engine out of the initial map bundle.
  const {renderToSVG}=await import("@versatiles/svg-renderer");
  const center=map.getCenter();
  let svg=await renderToSVG({
    style:map.getStyle(),width,height,lon:center.lng,lat:center.lat,zoom:map.getZoom()
  });
  if(!svg.includes("</svg>"))throw new Error("SVG renderer returned an invalid map.");
  const elements:string[]=[];
  for(const marker of markers){
    const p=map.project([marker.point.lng,marker.point.lat]);
    if(p.x<0||p.y<0||p.x>width||p.y>height)continue;
    const color=markerColor(marker.color);
    elements.push(`<g transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})"><circle r="11" cy="-8" fill="${escapeXml(color)}" stroke="#ffffff" stroke-width="3"/><circle r="3" cy="-8" fill="#ffffff"/></g>`);
  }
  elements.push(`<g aria-label="Map attribution"><rect x="0" y="${height-22}" width="${width}" height="22" fill="#ffffff" fill-opacity=".86"/><text x="${width-8}" y="${height-7}" font-size="11" font-family="sans-serif" fill="#202a32" text-anchor="end">${escapeXml(attribution(map))}</text></g>`);
  svg=svg.replace(/<\/svg>\s*$/,`<g id="atlas-export-overlays">${elements.join("")}</g></svg>`);
  return new Blob([svg],{type:"image/svg+xml;charset=utf-8"});
}

/** Copy the GL frame *during* a render callback to avoid keeping the costly
 * WebGL preserveDrawingBuffer mode enabled during ordinary Atlas interaction. */
export async function exportVectorPng(map:MapLibreMap,markers:readonly MarkerData[]):Promise<Blob>{
  if(!map.isStyleLoaded())throw new Error("Map style is still loading. Try again when the map is ready.");
  const source=map.getCanvas();
  const {width,height}=targetSize(map);
  if(!width||!height)throw new Error("Map viewport is not visible.");
  const pixelRatio=Math.max(1,source.width/width);
  const composite=document.createElement("canvas");
  composite.width=source.width;
  composite.height=source.height;
  const context=composite.getContext("2d");
  if(!context)throw new Error("2D canvas export is unavailable.");
  await new Promise<void>((resolve,reject)=>{
    const deadline=window.setTimeout(()=>reject(new Error("Map capture timed out; retry after tiles load.")),8000);
    map.once("render",()=>{
      window.clearTimeout(deadline);
      try{context.drawImage(source,0,0,composite.width,composite.height);resolve();}
      catch(error){reject(error);}
    });
    map.triggerRepaint();
  });
  context.save();
  context.scale(pixelRatio,pixelRatio);
  for(const marker of markers){
    const p=map.project([marker.point.lng,marker.point.lat]);
    if(p.x<0||p.y<0||p.x>width||p.y>height)continue;
    context.fillStyle=markerColor(marker.color);
    context.strokeStyle="#ffffff";context.lineWidth=3;
    context.beginPath();context.arc(p.x,p.y-8,11,0,Math.PI*2);context.fill();context.stroke();
    context.fillStyle="#ffffff";
    context.beginPath();context.arc(p.x,p.y-8,3,0,Math.PI*2);context.fill();
  }
  context.font="11px sans-serif";
  const credit=attribution(map);
  const textWidth=context.measureText(credit).width;
  context.fillStyle="rgba(255,255,255,0.88)";
  context.fillRect(Math.max(0,width-textWidth-20),height-22,Math.min(width,textWidth+20),22);
  context.fillStyle="#202a32";
  context.textAlign="right";
  context.fillText(credit,width-8,height-7,width-16);
  context.restore();
  return await new Promise<Blob>((resolve,reject)=>composite.toBlob(
    blob=>blob?resolve(blob):reject(new Error("PNG encoding failed.")),"image/png"
  ));
}
