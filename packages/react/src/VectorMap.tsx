import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import {
  Map as MapLibreMap, Marker as MapLibreMarker,
  type StyleSpecification,
} from "maplibre-gl";
import type { LatLng, MarkerData, Shape } from "@atlas/core";
import { escapeHtml, safeHex, validPoint } from "@atlas/core";
import type { AtlasMapHandle, ViewState } from "./index";

export type VectorTheme = {
  land: string;
  water: string;
  parks: string;
  roads: string;
  buildings: string;
  labels: string;
};

export const DEFAULT_VECTOR_THEME: VectorTheme = {
  land: "#f2f2ed",
  water: "#b9dbe9",
  parks: "#c8dfc1",
  roads: "#ffffff",
  buildings: "#deddea",
  labels: "#364555",
};

export const KEYLESS_VECTOR_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  positron: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

type EditableCategory = keyof VectorTheme;
function categorize(id: string, sourceLayer: string | undefined, layerType: string): EditableCategory | null {
  const label = id.toLowerCase().replace(/_/g, "-");
  const source = (sourceLayer ?? "").toLowerCase();
  if (layerType === "background") return "land";
  if (layerType === "symbol") {
    if (/label|place|poi|text|name|road/.test(label) || /place|transportation|poi/.test(source)) return "labels";
    return null;
  }
  if (/water|ocean|river|lake|sea/.test(label) || /water/.test(source)) return "water";
  if (/park|forest|grass|landcover|wood|natural|green/.test(label) || /park|landcover|landuse/.test(source)) return "parks";
  if (/building/.test(label) || /building/.test(source)) return "buildings";
  if (/road|street|highway|motorway|transportation|bridge|tunnel/.test(label) ||
      /transportation/.test(source)) return "roads";
  return null;
}
export function applyVectorTheme(map: MapLibreMap, theme: VectorTheme): void {
  if (!map.isStyleLoaded()) return;
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
    const category = categorize(layer.id, sourceLayer, layer.type);
    if (!category) continue;
    const color = safeHex(theme[category], DEFAULT_VECTOR_THEME[category]);
    const property = layer.type === "background" ? "background-color"
      : layer.type === "fill" ? "fill-color"
      : layer.type === "line" ? "line-color"
      : layer.type === "symbol" ? "text-color"
      : layer.type === "fill-extrusion" ? "fill-extrusion-color"
      : null;
    if (!property || (layer.type === "symbol" && category !== "labels")) continue;
    try { map.setPaintProperty(layer.id, property, color); }
    catch { /* Unsupported layer-specific properties remain untouched. */ }
  }
}

export interface AtlasVectorMapProps {
  center: LatLng;
  zoom?: number;
  styleUrl?: string;
  theme: VectorTheme;
  markers: MarkerData[];
  shapes: Shape[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDrag?: (id: string, point: LatLng) => void;
  onClick?: (point: LatLng) => void;
  onViewChange?: (view: ViewState) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  className?: string;
  style?: CSSProperties;
}
function viewOf(map: MapLibreMap): ViewState {
  const p = map.getCenter();
  const b = map.getBounds();
  if (!b) return {
    center: { lat: p.lat, lng: p.lng }, zoom: map.getZoom(),
    bounds: { north: p.lat, south: p.lat, west: p.lng, east: p.lng },
  };
  return {
    center: { lat: p.lat, lng: p.lng }, zoom: map.getZoom(),
    bounds: { north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() },
  };
}
function circleRing(center: LatLng, radiusMeters: number): [number,number][] {
  const coords: [number,number][] = [];
  const latRadius = radiusMeters / 111320;
  const lngRadius = radiusMeters / (111320 * Math.max(.01, Math.cos(center.lat * Math.PI/180)));
  for (let i = 0; i <= 64; i++) {
    const angle = i * Math.PI * 2 / 64;
    coords.push([center.lng + lngRadius * Math.cos(angle),center.lat + latRadius * Math.sin(angle)]);
  }
  return coords;
}
function asGeoJson(shapes: Shape[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const shape of shapes) {
    const color = safeHex(shape.color);
    if (shape.kind === "circle") {
      if (!validPoint(shape.center) || !Number.isFinite(shape.radiusMeters) || shape.radiusMeters <= 0) continue;
      features.push({
        type:"Feature",
        properties:{id:shape.id,color,kind:"polygon"},
        geometry:{type:"Polygon",coordinates:[circleRing(shape.center,shape.radiusMeters)]},
      });
      continue;
    }
    const points = shape.points.filter(validPoint).map(p=>[p.lng,p.lat] as [number,number]);
    if (points.length < (shape.kind === "polygon" ? 3 : 2)) continue;
    const polygon = shape.kind === "polygon";
    features.push({
      type:"Feature",
      properties:{id:shape.id,color,kind:shape.kind},
      geometry: polygon
        ? {type:"Polygon",coordinates:[[...points,points[0]!]]}
        : {type:"LineString",coordinates:points},
    });
  }
  return { type:"FeatureCollection", features };
}
const shapeSource = "atlas-editable-shapes";
function installShapeLayers(map: MapLibreMap): void {
  if (map.getSource(shapeSource)) return;
  map.addSource(shapeSource, {type:"geojson",data:asGeoJson([])});
  map.addLayer({
    id:"atlas-fill",type:"fill",source:shapeSource,
    filter:["==",["geometry-type"],"Polygon"],
    paint:{"fill-color":["get","color"],"fill-opacity":.18},
  });
  map.addLayer({
    id:"atlas-outline",type:"line",source:shapeSource,
    paint:{"line-color":["get","color"],"line-width":3},
  });
}
export const AtlasVectorMap = forwardRef<AtlasMapHandle,AtlasVectorMapProps>(function AtlasVectorMap({
  center, zoom=13, styleUrl=KEYLESS_VECTOR_STYLES.liberty,
  theme,markers,shapes,selectedId,onSelect,onDrag,onClick,
  onViewChange,onReady,onError,className,style,
},ref){
  const host=useRef<HTMLDivElement>(null);
  const map=useRef<MapLibreMap|null>(null);
  const markerElements=useRef<MapLibreMarker[]>([]);
  const latest=useRef({onClick,onSelect,onDrag,onViewChange,onReady,onError});
  latest.current={onClick,onSelect,onDrag,onViewChange,onReady,onError};
  const shapesRef=useRef(shapes);
  shapesRef.current=shapes;
  const themeRef=useRef(theme);
  themeRef.current=theme;

  useEffect(()=>{
    if (!host.current) return;
    let loaded=false;
    let errors=0;
    const instance=new MapLibreMap({
      container:host.current!,
      style:styleUrl,
      center:[center.lng,center.lat],
      zoom,
      attributionControl:true,
      maxZoom:19,
    });
    map.current=instance;
    const emit=()=>latest.current.onViewChange?.(viewOf(instance));
    instance.on("moveend",emit);
    instance.on("zoomend",emit);
    instance.on("click",event=>latest.current.onClick?.({lat:event.lngLat.lat,lng:event.lngLat.lng}));
    instance.on("error",event=>{
      if (loaded) return;
      if (++errors >= 2) latest.current.onError?.(
        event.error?.message || "Vector map couldn't load; use raster fallback."
      );
    });
    instance.on("load",()=>{
      loaded=true;
      installShapeLayers(instance);
      const source=instance.getSource(shapeSource);
      if (source?.type === "geojson") source.setData(asGeoJson(shapesRef.current));
      applyVectorTheme(instance,themeRef.current);
      emit();
      latest.current.onReady?.();
    });
    instance.on("style.load",()=>{
      installShapeLayers(instance);
      const source=instance.getSource(shapeSource);
      if (source?.type==="geojson") source.setData(asGeoJson(shapesRef.current));
      applyVectorTheme(instance,themeRef.current);
    });
    const resize=new ResizeObserver(()=>instance.resize());
    resize.observe(host.current);
    return()=>{
      resize.disconnect();
      markerElements.current.forEach(m=>m.remove());
      markerElements.current=[];
      map.current=null;
      instance.remove();
    };
  },[]);
  useEffect(()=>{
    if(map.current && map.current.getStyle()?.sprite !== undefined){
      map.current.setStyle(styleUrl);
    }
  },[styleUrl]);
  useEffect(()=>{
    if(map.current)applyVectorTheme(map.current,theme);
  },[theme]);
  useEffect(()=>{
    const instance=map.current;
    if(!instance || !instance.isStyleLoaded()) return;
    const source=instance.getSource(shapeSource);
    if(source?.type==="geojson") source.setData(asGeoJson(shapes));
  },[shapes,styleUrl]);
  useEffect(()=>{
    const instance=map.current;
    if(!instance) return;
    markerElements.current.forEach(m=>m.remove());
    markerElements.current=[];
    for(const marker of markers){
      if(!validPoint(marker.point))continue;
      const el=document.createElement("button");
      el.type="button";
      el.className="atlas-vector-pin"+(marker.id===selectedId?" selected":"");
      el.style.setProperty("--pin-color",safeHex(marker.color));
      el.setAttribute("aria-label",marker.title);
      el.title=marker.title;
      el.innerHTML='<span aria-hidden="true"></span>';
      el.addEventListener("click",event=>{
        event.stopPropagation();
        latest.current.onSelect?.(marker.id);
      });
      const item=new MapLibreMarker({element:el,draggable:!!marker.draggable,anchor:"bottom"})
        .setLngLat([marker.point.lng,marker.point.lat]).addTo(instance);
      item.on("dragend",()=>{
        const p=item.getLngLat();
        latest.current.onDrag?.(marker.id,{lat:p.lat,lng:p.lng});
      });
      markerElements.current.push(item);
    }
  },[markers,selectedId]);
  useImperativeHandle(ref,()=>({
    flyTo(p,z){map.current?.flyTo({center:[p.lng,p.lat],zoom:z??map.current.getZoom(),duration:500});},
    setView(p,z){map.current?.jumpTo({center:[p.lng,p.lat],zoom:z??map.current.getZoom()});},
    fitTo(points){
      if(!points.length)return;
      const lngs=points.map(p=>p.lng),lats=points.map(p=>p.lat);
      map.current?.fitBounds([
        [Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]
      ],{padding:75,maxZoom:16});
    },
    zoomIn(){map.current?.zoomIn();},
    zoomOut(){map.current?.zoomOut();},
    getView(){return map.current?viewOf(map.current):null;},
  }),[]);
  return <div className={["atlas-map","atlas-vector-map",className].filter(Boolean).join(" ")} style={style}>
    <div ref={host} className="atlas-map-host" style={{position:"absolute",inset:0}}/>
    <style>{`
    .atlas-vector-map{position:relative;min-height:220px;overflow:hidden}
    .atlas-vector-pin{appearance:none;width:30px;height:36px;display:flex;align-items:flex-start;justify-content:center;padding:0;background:transparent;border:none;cursor:pointer;filter:drop-shadow(0 4px 4px #101b2c55)}
    .atlas-vector-pin span{width:27px;height:27px;border-radius:50% 50% 50% 5px;transform:rotate(-45deg);background:var(--pin-color,#5365da);border:3px solid white;display:block;position:relative}
    .atlas-vector-pin span:after{position:absolute;content:"";width:7px;height:7px;border-radius:50%;background:white;top:7px;left:7px}
    .atlas-vector-pin.selected span{box-shadow:0 0 0 4px #f0ab5e}
    .atlas-vector-map .maplibregl-control-container{pointer-events:auto}
    `}</style>
  </div>;
});
