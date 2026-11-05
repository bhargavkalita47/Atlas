import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import {
  Map as MapLibreMap, Marker as MapLibreMarker,
  type GeoJSONSource,
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
  markers: readonly MarkerData[];
  shapes: readonly Shape[];
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
function asGeoJson(shapes: readonly Shape[]): GeoJSON.FeatureCollection {
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
type ManagedMarker = {
  marker: MapLibreMarker;
  element: HTMLButtonElement;
  title: string;
  color: string;
  draggable: boolean;
  point: LatLng;
};

/**
 * MapLibre renderer. A map instance is created only on mount; style changes
 * update it in place, so its camera, pins, and event subscriptions survive.
 *
 * Consumers using Vite must register MapLibre's v6 worker URL once in their
 * application's entry point before mounting this component.
 */
export const AtlasVectorMap = forwardRef<AtlasMapHandle,AtlasVectorMapProps>(function AtlasVectorMap({
  center, zoom=13, styleUrl=KEYLESS_VECTOR_STYLES.liberty,
  theme,markers,shapes,selectedId,onSelect,onDrag,onClick,
  onViewChange,onReady,onError,className,style,
},ref){
  const host=useRef<HTMLDivElement>(null);
  const map=useRef<MapLibreMap|null>(null);
  const markerElements=useRef(new Map<string,ManagedMarker>());
  const currentStyleUrl=useRef(styleUrl);
  const restartStyleWatchdog=useRef<(()=>void)|null>(null);
  const reportFatalStyleError=useRef<((message:string)=>void)|null>(null);
  const latest=useRef({onClick,onSelect,onDrag,onViewChange,onReady,onError});
  latest.current={onClick,onSelect,onDrag,onViewChange,onReady,onError};
  const shapesRef=useRef(shapes);
  shapesRef.current=shapes;
  const themeRef=useRef(theme);
  themeRef.current=theme;

  useEffect(()=>{
    if(!host.current)return;
    let disposed=false;
    let failed=false;
    let ready=false;
    let lastError="";
    let watchdog:ReturnType<typeof setTimeout>|undefined;
    const fail=(message:string)=>{
      if(disposed||failed)return;
      failed=true;
      if(watchdog)clearTimeout(watchdog);
      latest.current.onError?.(message);
    };
    const armWatchdog=()=>{
      lastError="";
      if(watchdog)clearTimeout(watchdog);
      watchdog=setTimeout(()=>{
        if(disposed||failed)return;
        fail(lastError||"Vector style could not load within 20 seconds.");
      },20_000);
    };
    let instance:MapLibreMap;
    try{
      instance=new MapLibreMap({
        container:host.current!,
        style:styleUrl,
        center:[center.lng,center.lat],
        zoom,
        maxZoom:19,
      });
    }catch(error){
      fail(error instanceof Error?error.message:"WebGL map initialization failed.");
      return;
    }
    map.current=instance;
    restartStyleWatchdog.current=armWatchdog;
    reportFatalStyleError.current=fail;
    const emit=()=>latest.current.onViewChange?.(viewOf(instance));
    const installOverlays=()=>{
      if(disposed||failed)return;
      try{
        installShapeLayers(instance);
        const source=instance.getSource(shapeSource) as GeoJSONSource|undefined;
        source?.setData(asGeoJson(shapesRef.current));
        applyVectorTheme(instance,themeRef.current);
        if(watchdog)clearTimeout(watchdog);
        if(!ready){
          ready=true;
          latest.current.onReady?.();
        }
        emit();
      }catch(error){
        lastError=error instanceof Error?error.message:"Unable to install vector overlays.";
      }
    };
    instance.on("moveend",emit);
    instance.on("zoomend",emit);
    instance.on("click",event=>latest.current.onClick?.({lat:event.lngLat.lat,lng:event.lngLat.lng}));
    instance.on("error",event=>{
      const message=event.error?.message||"Vector resource failed to load.";
      lastError=message;
      // A single missing glyph or transient tile error must not destroy the
      // map. Workers, WebGL, and unrecoverable style initialization do.
      if(/worker.*(?:fail|load|url|module)|(?:fail|load).*worker|webgl|context lost/i.test(message)){
        fail(message);
      }
    });
    // style.load is the correct boundary after every setStyle(): sources and
    // layers owned by the app must be reattached to the fresh style.
    instance.on("style.load",installOverlays);
    armWatchdog();
    const resize=()=>instance.resize();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;
    if(observer)observer.observe(host.current);
    else window.addEventListener("resize",resize);
    return()=>{
      disposed=true;
      if(watchdog)clearTimeout(watchdog);
      restartStyleWatchdog.current=null;
      reportFatalStyleError.current=null;
      observer?.disconnect();
      if(!observer)window.removeEventListener("resize",resize);
      for(const entry of markerElements.current.values())entry.marker.remove();
      markerElements.current.clear();
      map.current=null;
      instance.remove();
    };
  },[]);

  // Unlike the previous implementation, this does not immediately reload the
  // same style after construction, nor does it destroy markers/camera state.
  useEffect(()=>{
    if(currentStyleUrl.current===styleUrl)return;
    currentStyleUrl.current=styleUrl;
    const instance=map.current;
    if(!instance)return;
    try{
      restartStyleWatchdog.current?.();
      instance.setStyle(styleUrl);
    }catch(error){
      reportFatalStyleError.current?.(error instanceof Error?error.message:"Unable to load map style.");
    }
  },[styleUrl]);

  // The style.load handler re-applies the most recent theme after a style
  // change, including changes requested while style data was still loading.
  useEffect(()=>{
    const instance=map.current;
    if(instance&&instance.isStyleLoaded())applyVectorTheme(instance,theme);
  },[theme]);

  useEffect(()=>{
    const instance=map.current;
    if(!instance||!instance.isStyleLoaded())return;
    const source=instance.getSource(shapeSource) as GeoJSONSource|undefined;
    source?.setData(asGeoJson(shapes));
  },[shapes]);

  // Reconcile markers by stable id. Selecting a pin or dragging one must not
  // recreate every marker node and its attached event listeners.
  useEffect(()=>{
    const instance=map.current;
    if(!instance)return;
    const wanted=new Set<string>();
    for(const value of markers){
      if(!validPoint(value.point)||!value.id)continue;
      wanted.add(value.id);
      const color=safeHex(value.color);
      const draggable=!!value.draggable;
      const existing=markerElements.current.get(value.id);
      if(existing){
        if(existing.point.lat!==value.point.lat||existing.point.lng!==value.point.lng){
          existing.marker.setLngLat([value.point.lng,value.point.lat]);
          existing.point=value.point;
        }
        if(existing.color!==color){
          existing.element.style.setProperty("--pin-color",color);
          existing.color=color;
        }
        if(existing.title!==value.title){
          existing.title=value.title;
          existing.element.setAttribute("aria-label",value.title);
          existing.element.title=value.title;
        }
        if(existing.draggable!==draggable){
          existing.marker.setDraggable(draggable);
          existing.draggable=draggable;
        }
        continue;
      }
      const element=document.createElement("button");
      element.type="button";
      element.className="atlas-vector-pin";
      element.style.setProperty("--pin-color",color);
      element.setAttribute("aria-label",value.title);
      element.title=value.title;
      const inner=document.createElement("span");
      inner.setAttribute("aria-hidden","true");
      element.appendChild(inner);
      const id=value.id;
      element.addEventListener("click",event=>{
        event.stopPropagation();
        latest.current.onSelect?.(id);
      });
      const instanceMarker=new MapLibreMarker({
        element,draggable,anchor:"bottom",
      }).setLngLat([value.point.lng,value.point.lat]).addTo(instance);
      instanceMarker.on("dragend",()=>{
        const p=instanceMarker.getLngLat();
        latest.current.onDrag?.(id,{lat:p.lat,lng:p.lng});
      });
      markerElements.current.set(id,{
        marker:instanceMarker,element,title:value.title,color,draggable,point:value.point,
      });
    }
    for(const [id,item] of markerElements.current){
      if(!wanted.has(id)){
        item.marker.remove();
        markerElements.current.delete(id);
      }
    }
    for(const [id,item] of markerElements.current){
      item.element.classList.toggle("selected",id===selectedId);
    }
  },[markers]);

  useEffect(()=>{
    for(const [id,item] of markerElements.current){
      item.element.classList.toggle("selected",id===selectedId);
    }
  },[selectedId]);

  useImperativeHandle(ref,()=>({
    flyTo(p,z){
      if(validPoint(p))map.current?.flyTo({center:[p.lng,p.lat],zoom:z??map.current.getZoom(),duration:500});
    },
    setView(p,z){
      if(validPoint(p))map.current?.jumpTo({center:[p.lng,p.lat],zoom:z??map.current.getZoom()});
    },
    fitTo(points){
      const valid=points.filter(validPoint);
      if(!valid.length||!map.current)return;
      if(valid.length===1){
        map.current.flyTo({center:[valid[0]!.lng,valid[0]!.lat],zoom:15,duration:500});
        return;
      }
      const lngs=valid.map(p=>p.lng),lats=valid.map(p=>p.lat);
      map.current.fitBounds([
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
