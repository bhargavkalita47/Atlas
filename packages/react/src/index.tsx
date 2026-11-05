import {createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type CSSProperties} from "react";
import L from "leaflet";
import type {LatLng, MapBounds, MarkerData, Shape} from "@atlas/core";
import {escapeHtml, safeHex, validPoint} from "@atlas/core";

export interface TileSource { url: string; attribution: string; maxZoom?: number; subdomains?: string }
export interface ViewState { center: LatLng; zoom: number; bounds: MapBounds }
export interface AtlasMapHandle {
  flyTo(point: LatLng, zoom?: number): void;
  setView(point: LatLng, zoom?: number): void;
  fitTo(points: LatLng[]): void;
  zoomIn(): void;
  zoomOut(): void;
  getView(): ViewState | null;
}
export interface AtlasMapProps {
  center: LatLng; zoom?: number; tile: TileSource;
  children?: ReactNode;
  className?: string; style?: CSSProperties; tileFilter?: string;
  onClick?: (point: LatLng) => void;
  onViewChange?: (view: ViewState) => void;
  onReady?: () => void;
}
const Context = createContext<L.Map|null>(null);
export function useAtlasMap(): L.Map|null { return useContext(Context); }
function readView(map: L.Map): ViewState {
  const p = map.getCenter(), b = map.getBounds();
  return {
    center:{lat:p.lat,lng:p.lng},zoom:map.getZoom(),
    bounds:{north:b.getNorth(),south:b.getSouth(),east:b.getEast(),west:b.getWest()}
  };
}
export const AtlasMap = forwardRef<AtlasMapHandle, AtlasMapProps>(function AtlasMap({
  center,zoom=13,tile,children,className,style,tileFilter="none",onClick,onViewChange,onReady
},ref) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<L.Map|null>(null);
  const layer = useRef<L.TileLayer|null>(null);
  const latest = useRef({onClick,onViewChange,onReady});
  latest.current={onClick,onViewChange,onReady};
  const [map,setMap] = useState<L.Map|null>(null);
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current,{
      center:[center.lat,center.lng],zoom,
      zoomControl:false,attributionControl:true,
      preferCanvas:true
    });
    instance.current=m; setMap(m);
    m.attributionControl.setPrefix(false);
    m.on("click",e=>latest.current.onClick?.({lat:e.latlng.lat,lng:e.latlng.lng}));
    const changed=()=>latest.current.onViewChange?.(readView(m));
    m.on("moveend zoomend",changed);
    m.whenReady(()=>{changed();latest.current.onReady?.();});
    const observer=new ResizeObserver(()=>m.invalidateSize({pan:false}));
    observer.observe(host.current);
    return ()=>{observer.disconnect();instance.current=null;setMap(null);m.remove();};
  },[]);
  useEffect(()=>{
    const m=instance.current;
    if(!m)return;
    layer.current?.remove();
    layer.current=L.tileLayer(tile.url,{
      attribution:tile.attribution,maxZoom:tile.maxZoom??19,
      subdomains:tile.subdomains??"abc",updateWhenIdle:true,keepBuffer:1,
      className:"atlas-base-tile"
    }).addTo(m);
    return ()=>{layer.current?.remove();layer.current=null;};
  },[tile.url,tile.attribution,tile.maxZoom,tile.subdomains]);
  useImperativeHandle(ref,()=>({
    flyTo(point,z){instance.current?.flyTo([point.lat,point.lng],z??instance.current.getZoom(),{duration:.5});},
    setView(point,z){instance.current?.setView([point.lat,point.lng],z??instance.current.getZoom());},
    fitTo(points){if(!points.length)return;instance.current?.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lng] as [number,number])),{padding:[75,75],maxZoom:16});},
    zoomIn(){instance.current?.zoomIn();},zoomOut(){instance.current?.zoomOut();},
    getView(){return instance.current?readView(instance.current):null;}
  }),[]);
  return <Context.Provider value={map}>
    <div className={["atlas-map",className].filter(Boolean).join(" ")} style={{...style,["--atlas-tile-filter" as string]:tileFilter}}>
      <div ref={host} className="atlas-map-host" style={{position:"absolute",inset:0}}/>
      {children}
      <style>{".atlas-map .atlas-base-tile{filter:var(--atlas-tile-filter,none)}.atlas-map{position:relative;min-height:220px;overflow:hidden}.atlas-pin{width:34px;height:40px;display:flex;align-items:flex-start;justify-content:center;filter:drop-shadow(0 4px 5px #101b2c3d)}.atlas-pin-core{background:var(--pin-color);border:3px solid white;width:30px;height:30px;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);box-shadow:0 0 0 1px #1e274433}.atlas-pin-core:after{content:'';position:absolute;width:8px;height:8px;border-radius:50%;background:#fff;left:8px;top:8px}.atlas-pin.selected .atlas-pin-core{box-shadow:0 0 0 4px #f9b66a,0 0 0 6px #0f172a}"}</style>
    </div>
  </Context.Provider>;
});
export interface MarkerLayerProps {
  markers: MarkerData[]; selectedId?: string|null;
  onSelect?: (id:string)=>void;
  onDrag?: (id:string, point:LatLng)=>void;
}
export function MarkerLayer({markers,selectedId,onSelect,onDrag}:MarkerLayerProps){
  const map=useAtlasMap(),layers=useRef<L.LayerGroup|null>(null);
  const callbacks=useRef({onSelect,onDrag});callbacks.current={onSelect,onDrag};
  useEffect(()=>{
    if(!map)return;
    const group=L.layerGroup().addTo(map);layers.current=group;
    return ()=>{group.remove();layers.current=null;};
  },[map]);
  useEffect(()=>{
    const group=layers.current;
    if(!group)return;
    group.clearLayers();
    for(const marker of markers){
      if(!validPoint(marker.point))continue;
      const icon=L.divIcon({
        className:"atlas-pin"+(marker.id===selectedId?" selected":""),
        html:'<div class="atlas-pin-core" style="--pin-color:'+safeHex(marker.color)+'"></div>',
        iconSize:[34,40],iconAnchor:[17,37]
      });
      const item=L.marker([marker.point.lat,marker.point.lng],{
        icon,draggable:!!marker.draggable,
        title:marker.title,alt:marker.title
      }).addTo(group);
      if(marker.title) item.bindTooltip(escapeHtml(marker.title),{direction:"top",offset:[0,-23]});
      item.on("click",()=>callbacks.current.onSelect?.(marker.id));
      if(marker.draggable)item.on("dragend",()=>{
        const p=item.getLatLng();
        callbacks.current.onDrag?.(marker.id,{lat:p.lat,lng:p.lng});
      });
    }
  },[map,markers,selectedId]);
  return null;
}
export function ShapeLayer({shapes}:{shapes:Shape[]}){
  const map=useAtlasMap(),group=useRef<L.LayerGroup|null>(null);
  useEffect(()=>{
    if(!map)return;
    const g=L.layerGroup().addTo(map);group.current=g;
    return ()=>{g.remove();group.current=null;};
  },[map]);
  useEffect(()=>{
    if(!group.current)return;
    group.current.clearLayers();
    for(const shape of shapes){
      const color=safeHex(shape.color);
      if(shape.kind==="circle"){
        if(!validPoint(shape.center)||!Number.isFinite(shape.radiusMeters))continue;
        L.circle([shape.center.lat,shape.center.lng],{
          radius:shape.radiusMeters,color,fillColor:color,fillOpacity:.12,weight:3
        }).addTo(group.current).bindTooltip(escapeHtml(shape.label??"Circle"));
      }else{
        const pts=shape.points.filter(validPoint).map(p=>[p.lat,p.lng] as [number,number]);
        if(pts.length < (shape.kind==="polygon"?3:2))continue;
        const layer=shape.kind==="polygon"?
          L.polygon(pts,{color,weight:3,fillOpacity:.16}):
          L.polyline(pts,{color,weight:4,dashArray:"7 7"});
        layer.addTo(group.current).bindTooltip(escapeHtml(shape.label??shape.kind));
      }
    }
  },[map,shapes]);
  return null;
}
