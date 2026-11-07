import type {Map as MapLibreMap} from "maplibre-gl";
import type {MarkerData} from "@atlas/core";

const escapeXml=(value:string)=>value.replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"
}[c]!));
const markerColor=(value:string|undefined)=>value&&/^#[0-9a-f]{6}$/i.test(value)?value:"#5365da";
const attribution=(map:MapLibreMap)=>{
  const raw=map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.textContent?.trim()||"";
  const extra=raw.replace(/^MapLibre\\s*/i,"").trim();
  return /OpenStreetMap/i.test(extra)?extra:
    "© OpenStreetMap contributors"+(extra?" · "+extra:"");
};
const targetSize=(map:MapLibreMap)=>{
  const canvas=map.getCanvas();
  return {width:canvas.clientWidth||map.getContainer().clientWidth,
    height:canvas.clientHeight||map.getContainer().clientHeight};
};

/**
 * Some third-party vector providers and inline GeoJSON sources are not
 * supported by the independent SVG tile renderer. In that case export
 * the features already rendered in MapLibre as genuine projected SVG
 * geometry rather than returning a blank SVG or embedding a bitmap.
 * Symbol placement and expression-driven paints remain approximate.
 */
function renderVisibleFeaturesSvg(map:MapLibreMap,width:number,height:number):string{
  const style=map.getStyle();
  const background=style.layers?.find(layer=>layer.type==="background");
  const bgValue=(background?.paint as Record<string,unknown>|undefined)?.["background-color"];
  const color=(value:unknown,fallback:string):string=>
    typeof value==="string"&&/^(?:#[a-fA-F0-9]{3,8}|rgba?\\([0-9.,%\\s]+\\))$/.test(value)?value:fallback;
  const fill=color(bgValue,"#F7F7F5");
  const px=(coord:readonly number[])=>{
    const p=map.project([coord[0]!,coord[1]!]);
    return p.x.toFixed(2)+" "+p.y.toFixed(2);
  };
  const linePath=(coords:readonly (readonly number[])[],close=false):string=>
    coords.length?"M"+coords.map(px).join(" L")+(close?" Z":""):"";
  const elements:string[]=[];
  // Query results are top-first. Reverse for correct paint order.
  const features=map.queryRenderedFeatures().slice(0,16000).reverse();
  for(const feature of features){
    const layer=feature.layer;
    if(layer.type!=="fill"&&layer.type!=="line"&&layer.type!=="circle")continue;
    const paint=(layer.paint??{}) as Record<string,unknown>;
    const type=feature.geometry.type;
    const geom=feature.geometry;
    if(layer.type==="circle"&&(type==="Point"||type==="MultiPoint")){
      const positions=type==="Point"?[geom.coordinates]:(geom.coordinates as number[][]);
      const r=typeof paint["circle-radius"]==="number"?paint["circle-radius"]:4;
      const ink=color(paint["circle-color"],"#5877A5");
      for(const p of positions){
        const center=map.project([p[0]!,p[1]!]);
        elements.push(`<circle cx="${center.x.toFixed(2)}" cy="${center.y.toFixed(2)}" r="${Math.max(0,r)}" fill="${ink}"/>`);
      }
      continue;
    }
    const paths:string[]=[];
    if(geom.type==="LineString")paths.push(linePath(geom.coordinates));
    else if(geom.type==="MultiLineString")for(const line of geom.coordinates)paths.push(linePath(line));
    else if(geom.type==="Polygon")for(const ring of geom.coordinates)paths.push(linePath(ring,true));
    else if(geom.type==="MultiPolygon")for(const poly of geom.coordinates)for(const ring of poly)paths.push(linePath(ring,true));
    if(!paths.length)continue;
    if(layer.type==="fill"){
      const ink=color(paint["fill-color"],"#DCE4DF");
      elements.push(`<path d="${paths.join(" ")}" fill="${ink}" fill-rule="evenodd"/>`);
    }else if(layer.type==="line"){
      const ink=color(paint["line-color"],"#8D9A9F");
      const w=typeof paint["line-width"]==="number"?Math.max(0,paint["line-width"]):1.5;
      elements.push(`<path d="${paths.join(" ")}" fill="none" stroke="${ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
  }
  if(!elements.length)throw new Error("No exportable vector features are visible. Try another zoom or provider.");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="atlas-export-clip"><rect width="${width}" height="${height}"/></clipPath></defs><rect width="${width}" height="${height}" fill="${fill}"/><g id="atlas-rendered-features" clip-path="url(#atlas-export-clip)">${elements.join("")}</g></svg>`;
}

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
  // A renderer can resolve successfully but silently skip unsupported sources.
  // Detect empty geometry and convert MapLibre's *visible* features instead.
  if(!/<(?:path|rect|circle|polygon|polyline|image|text)\\b/i.test(svg))
    svg=renderVisibleFeaturesSvg(map,width,height);
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
